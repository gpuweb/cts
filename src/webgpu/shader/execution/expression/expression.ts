import { globalTestConfig } from '../../../../common/framework/test_config.js';
import { assert } from '../../../../common/util/util.js';
import { GPUTest } from '../../../gpu_test.js';
import { compare, Comparator, anyOf } from '../../../util/compare.js';
import {
  ScalarType,
  Scalar,
  Type,
  TypeVec,
  TypeU32,
  Value,
  Vector,
  VectorType,
  f32,
} from '../../../util/conversion.js';
import {
  BinaryToInterval,
  F32Interval,
  PointToInterval,
  TernaryToInterval,
  VectorPairToInterval,
  VectorPairToVector,
  VectorToInterval,
  VectorToVector,
} from '../../../util/f32_interval.js';
import { quantizeToF32 } from '../../../util/math.js';

export type Expectation = Value | F32Interval | F32Interval[] | Comparator;

/** Is this expectation actually a Comparator */
function isComparator(e: Expectation): boolean {
  return !(
    e instanceof F32Interval ||
    e instanceof Scalar ||
    e instanceof Vector ||
    e instanceof Array
  );
}

/** Helper for converting Values to Comparators */
export function toComparator(input: Expectation): Comparator {
  if (!isComparator(input)) {
    return got => compare(got, input as Value);
  }
  return input as Comparator;
}

/** Case is a single expression test case. */
export type Case = {
  // The input value(s)
  input: Value | Array<Value>;
  // The expected result, or function to check the result
  expected: Expectation;
};

/** CaseList is a list of Cases */
export type CaseList = Array<Case>;

/** The input value source */
export type InputSource =
  | 'const' // Shader creation time constant values (@const)
  | 'uniform' // Uniform buffer
  | 'storage_r' // Read-only storage buffer
  | 'storage_rw'; // Read-write storage buffer

/** All possible input sources */
export const allInputSources: InputSource[] = ['const', 'uniform', 'storage_r', 'storage_rw'];

/** Configuration for running a expression test */
export type Config = {
  // Where the input values are read from
  inputSource: InputSource;
  // If defined, scalar test cases will be packed into vectors of the given
  // width, which must be 2, 3 or 4.
  // Requires that all parameters of the expression overload are of a scalar
  // type, and the return type of the expression overload is also a scalar type.
  // If the number of test cases is not a multiple of the vector width, then the
  // last scalar value is repeated to fill the last vector value.
  vectorize?: number;
};

// Helper for returning the WGSL storage type for the given Type.
function storageType(ty: Type): Type {
  if (ty instanceof ScalarType) {
    if (ty.kind === 'bool') {
      return TypeU32;
    }
  }
  if (ty instanceof VectorType) {
    return TypeVec(ty.width, storageType(ty.elementType) as ScalarType);
  }
  return ty;
}

// Helper for converting a value of the type 'ty' from the storage type.
function fromStorage(ty: Type, expr: string): string {
  if (ty instanceof ScalarType) {
    if (ty.kind === 'bool') {
      return `${expr} != 0u`;
    }
  }
  if (ty instanceof VectorType) {
    if (ty.elementType.kind === 'bool') {
      return `${expr} != vec${ty.width}<u32>(0u)`;
    }
  }
  return expr;
}

// Helper for converting a value of the type 'ty' to the storage type.
function toStorage(ty: Type, expr: string): string {
  if (ty instanceof ScalarType) {
    if (ty.kind === 'bool') {
      return `select(0u, 1u, ${expr})`;
    }
  }
  if (ty instanceof VectorType) {
    if (ty.elementType.kind === 'bool') {
      return `select(vec${ty.width}<u32>(0u), vec${ty.width}<u32>(1u), ${expr})`;
    }
  }
  return expr;
}

// Currently all values are packed into buffers of 16 byte strides
const kValueStride = 16;

// ExpressionBuilder returns the WGSL used to test an expression.
export interface ExpressionBuilder {
  (values: Array<string>): string;
}

/**
 * Runs the list of expression tests, possibly splitting the tests into multiple
 * dispatches to keep the input data within the buffer binding limits.
 * run() will pack the scalar test cases into smaller set of vectorized tests
 * if `cfg.vectorize` is defined.
 * @param t the GPUTest
 * @param expressionBuilder the expression builder function
 * @param parameterTypes the list of expression parameter types
 * @param returnType the return type for the expression overload
 * @param cfg test configuration values
 * @param cases list of test cases
 */
export async function run(
  t: GPUTest,
  expressionBuilder: ExpressionBuilder,
  parameterTypes: Array<Type>,
  returnType: Type,
  cfg: Config = { inputSource: 'storage_r' },
  cases: CaseList
) {
  // If the 'vectorize' config option was provided, pack the cases into vectors.
  if (cfg.vectorize !== undefined) {
    const packed = packScalarsToVector(parameterTypes, returnType, cases, cfg.vectorize);
    cases = packed.cases;
    parameterTypes = packed.parameterTypes;
    returnType = packed.returnType;
  }

  // The size of the input buffer may exceed the maximum buffer binding size,
  // so chunk the tests up into batches that fit into the limits.
  const casesPerBatch = (function () {
    switch (cfg.inputSource) {
      case 'const':
        return 64; // Arbitrary limit, to ensure shaders aren't too large
      case 'uniform':
        return Math.floor(
          t.device.limits.maxUniformBufferBindingSize / (parameterTypes.length * kValueStride)
        );
      case 'storage_r':
      case 'storage_rw':
        return Math.floor(
          t.device.limits.maxStorageBufferBindingSize / (parameterTypes.length * kValueStride)
        );
    }
  })();

  // Submit all the cases in batches, each in a separate error scope.
  const checkResults: Array<Promise<void>> = [];
  for (let i = 0; i < cases.length; i += casesPerBatch) {
    const batchCases = cases.slice(i, Math.min(i + casesPerBatch, cases.length));

    t.device.pushErrorScope('validation');

    const checkBatch = submitBatch(
      t,
      expressionBuilder,
      parameterTypes,
      returnType,
      batchCases,
      cfg.inputSource
    );

    checkResults.push(
      // Check GPU validation (shader compilation, pipeline creation, etc) before checking the batch results.
      t.device.popErrorScope().then(error => {
        if (error === null) {
          checkBatch();
        } else {
          t.fail(error.message);
        }
      })
    );
  }

  // Check the results
  await Promise.all(checkResults);
}

/**
 * Submits the list of expression tests. The input data must fit within the
 * buffer binding limits of the given inputSource.
 * @param t the GPUTest
 * @param expressionBuilder the expression builder function
 * @param parameterTypes the list of expression parameter types
 * @param returnType the return type for the expression overload
 * @param cases list of test cases that fit within the binding limits of the device
 * @param inputSource the source of the input values
 * @returns a function that checks the results are as expected
 */
function submitBatch(
  t: GPUTest,
  expressionBuilder: ExpressionBuilder,
  parameterTypes: Array<Type>,
  returnType: Type,
  cases: CaseList,
  inputSource: InputSource
): () => void {
  // Construct a buffer to hold the results of the expression tests
  const outputBufferSize = cases.length * kValueStride;
  const outputBuffer = t.device.createBuffer({
    size: outputBufferSize,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
  });

  const [pipeline, group] = buildPipeline(
    t,
    expressionBuilder,
    parameterTypes,
    returnType,
    cases,
    inputSource,
    outputBuffer
  );

  const encoder = t.device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, group);
  pass.dispatchWorkgroups(1);
  pass.end();

  // Heartbeat to ensure CTS runners know we're alive.
  globalTestConfig.testHeartbeatCallback();

  t.queue.submit([encoder.finish()]);

  // Return a function that can check the results of the shader
  return () => {
    const checkExpectation = (outputData: Uint8Array) => {
      // Read the outputs from the output buffer
      const outputs = new Array<Value>(cases.length);
      for (let i = 0; i < cases.length; i++) {
        outputs[i] = returnType.read(outputData, i * kValueStride);
      }

      // The list of expectation failures
      const errs: string[] = [];

      // For each case...
      for (let caseIdx = 0; caseIdx < cases.length; caseIdx++) {
        const c = cases[caseIdx];
        const got = outputs[caseIdx];
        const cmp = toComparator(c.expected)(got);
        if (!cmp.matched) {
          errs.push(`(${c.input instanceof Array ? c.input.join(', ') : c.input})
    returned: ${cmp.got}
    expected: ${cmp.expected}`);
        }
      }

      return errs.length > 0 ? new Error(errs.join('\n\n')) : undefined;
    };

    // Heartbeat to ensure CTS runners know we're alive.
    globalTestConfig.testHeartbeatCallback();

    t.expectGPUBufferValuesPassCheck(outputBuffer, checkExpectation, {
      type: Uint8Array,
      typedLength: outputBufferSize,
    });
  };
}

/**
 * @param v either an array of T or a single element of type T
 * @param i the value index to
 * @returns the i'th value of v, if v is an array, otherwise v (i must be 0)
 */
function ith<T>(v: T | T[], i: number): T {
  if (v instanceof Array) {
    assert(i < v.length);
    return v[i];
  }
  assert(i === 0);
  return v;
}

/**
 * Constructs and returns a GPUComputePipeline and GPUBindGroup for running a
 * batch of test cases.
 * @param t the GPUTest
 * @param expressionBuilder the expression builder function
 * @param parameterTypes the list of expression parameter types
 * @param returnType the return type for the expression overload
 * @param cases list of test cases that fit within the binding limits of the device
 * @param inputSource the source of the input values
 * @param outputBuffer the buffer that will hold the output values of the tests
 */
function buildPipeline(
  t: GPUTest,
  expressionBuilder: ExpressionBuilder,
  parameterTypes: Array<Type>,
  returnType: Type,
  cases: CaseList,
  inputSource: InputSource,
  outputBuffer: GPUBuffer
): [GPUComputePipeline, GPUBindGroup] {
  // wgsl declaration of output buffer and binding
  const wgslStorageType = storageType(returnType);
  const wgslOutputs = `
struct Output {
  @size(${kValueStride}) value : ${wgslStorageType}
};
@group(0) @binding(0) var<storage, read_write> outputs : array<Output, ${cases.length}>;
`;

  switch (inputSource) {
    case 'const': {
      //////////////////////////////////////////////////////////////////////////
      // Input values are constant values in the WGSL shader
      //////////////////////////////////////////////////////////////////////////
      const wgslValues = cases.map(c => {
        const args = parameterTypes.map((_, i) => `(${ith(c.input, i).wgsl()})`);
        return `${toStorage(returnType, expressionBuilder(args))}`;
      });

      // the full WGSL shader source
      const source = `
${wgslOutputs}

const values = array<${wgslStorageType}, ${cases.length}>(
  ${wgslValues.join(',\n  ')}
);

@compute @workgroup_size(1)
fn main() {
  for (var i = 0u; i < ${cases.length}; i++) {
    outputs[i].value = values[i];
  }
}
`;

      // build the shader module
      const module = t.device.createShaderModule({ code: source });

      // build the pipeline
      const pipeline = t.device.createComputePipeline({
        layout: 'auto',
        compute: { module, entryPoint: 'main' },
      });

      // build the bind group
      const group = t.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: outputBuffer } }],
      });

      return [pipeline, group];
    }

    case 'uniform':
    case 'storage_r':
    case 'storage_rw': {
      //////////////////////////////////////////////////////////////////////////
      // Input values come from a uniform or storage buffer
      //////////////////////////////////////////////////////////////////////////

      // returns the WGSL expression to load the ith parameter of the given type from the input buffer
      const paramExpr = (ty: Type, i: number) => fromStorage(ty, `inputs[i].param${i}`);

      // resolves to the expression that calls the builtin
      const expr = toStorage(returnType, expressionBuilder(parameterTypes.map(paramExpr)));

      // input binding var<...> declaration
      const wgslInputVar = (function () {
        switch (inputSource) {
          case 'storage_r':
            return 'var<storage, read>';
          case 'storage_rw':
            return 'var<storage, read_write>';
          case 'uniform':
            return 'var<uniform>';
        }
      })();

      // the full WGSL shader source
      const source = `
struct Input {
${parameterTypes
  .map((ty, i) => `  @size(${kValueStride}) param${i} : ${storageType(ty)},`)
  .join('\n')}
};

${wgslOutputs}

@group(0) @binding(1)
${wgslInputVar} inputs : array<Input, ${cases.length}>;

@compute @workgroup_size(1)
fn main() {
  for(var i = 0; i < ${cases.length}; i++) {
    outputs[i].value = ${expr};
  }
}
`;

      // size in bytes of the input buffer
      const inputSize = cases.length * parameterTypes.length * kValueStride;

      // Holds all the parameter values for all cases
      const inputData = new Uint8Array(inputSize);

      // Pack all the input parameter values into the inputData buffer
      {
        const caseStride = kValueStride * parameterTypes.length;
        for (let caseIdx = 0; caseIdx < cases.length; caseIdx++) {
          const caseBase = caseIdx * caseStride;
          for (let paramIdx = 0; paramIdx < parameterTypes.length; paramIdx++) {
            const offset = caseBase + paramIdx * kValueStride;
            const params = cases[caseIdx].input;
            if (params instanceof Array) {
              params[paramIdx].copyTo(inputData, offset);
            } else {
              params.copyTo(inputData, offset);
            }
          }
        }
      }

      // build the input buffer
      const inputBuffer = t.makeBufferWithContents(
        inputData,
        GPUBufferUsage.COPY_SRC |
          (inputSource === 'uniform' ? GPUBufferUsage.UNIFORM : GPUBufferUsage.STORAGE)
      );

      // build the shader module
      const module = t.device.createShaderModule({ code: source });

      // build the pipeline
      const pipeline = t.device.createComputePipeline({
        layout: 'auto',
        compute: { module, entryPoint: 'main' },
      });

      // build the bind group
      const group = t.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: outputBuffer } },
          { binding: 1, resource: { buffer: inputBuffer } },
        ],
      });

      return [pipeline, group];
    }
  }
}

/**
 * Packs a list of scalar test cases into a smaller list of vector cases.
 * Requires that all parameters of the expression overload are of a scalar type,
 * and the return type of the expression overload is also a scalar type.
 * If `cases.length` is not a multiple of `vectorWidth`, then the last scalar
 * test case value is repeated to fill the vector value.
 */
function packScalarsToVector(
  parameterTypes: Array<Type>,
  returnType: Type,
  cases: CaseList,
  vectorWidth: number
): { cases: CaseList; parameterTypes: Array<Type>; returnType: Type } {
  // Validate that the parameters and return type are all vectorizable
  for (let i = 0; i < parameterTypes.length; i++) {
    const ty = parameterTypes[i];
    if (!(ty instanceof ScalarType)) {
      throw new Error(
        `packScalarsToVector() can only be used on scalar parameter types, but the ${i}'th parameter type is a ${ty}'`
      );
    }
  }
  if (!(returnType instanceof ScalarType)) {
    throw new Error(
      `packScalarsToVector() can only be used with a scalar return type, but the return type is a ${returnType}'`
    );
  }

  const packedCases: Array<Case> = [];
  const packedParameterTypes = parameterTypes.map(p => TypeVec(vectorWidth, p as ScalarType));
  const packedReturnType = new VectorType(vectorWidth, returnType);

  const clampCaseIdx = (idx: number) => Math.min(idx, cases.length - 1);

  let caseIdx = 0;
  while (caseIdx < cases.length) {
    // Construct the vectorized inputs from the scalar cases
    const packedInputs = new Array<Vector>(parameterTypes.length);
    for (let paramIdx = 0; paramIdx < parameterTypes.length; paramIdx++) {
      const inputElements = new Array<Scalar>(vectorWidth);
      for (let i = 0; i < vectorWidth; i++) {
        const input = cases[clampCaseIdx(caseIdx + i)].input;
        inputElements[i] = (input instanceof Array ? input[paramIdx] : input) as Scalar;
      }
      packedInputs[paramIdx] = new Vector(inputElements);
    }

    // Gather the comparators for the packed cases
    const comparators = new Array<Comparator>(vectorWidth);
    for (let i = 0; i < vectorWidth; i++) {
      comparators[i] = toComparator(cases[clampCaseIdx(caseIdx + i)].expected);
    }
    const packedComparator = (got: Value) => {
      let matched = true;
      const gElements = new Array<string>(vectorWidth);
      const eElements = new Array<string>(vectorWidth);
      for (let i = 0; i < vectorWidth; i++) {
        const d = comparators[i]((got as Vector).elements[i]);
        matched = matched && d.matched;
        gElements[i] = d.got;
        eElements[i] = d.expected;
      }
      return {
        matched,
        got: `${packedReturnType}(${gElements.join(', ')})`,
        expected: `${packedReturnType}(${eElements.join(', ')})`,
      };
    };

    // Append the new packed case
    packedCases.push({ input: packedInputs, expected: packedComparator });
    caseIdx += vectorWidth;
  }

  return {
    cases: packedCases,
    parameterTypes: packedParameterTypes,
    returnType: packedReturnType,
  };
}

/**
 * Generates a Case for the param and unary interval generator provided.
 * The Case will use use an interval comparator for matching results.
 * @param param the param to pass into the unary operation
 * @param ops callbacks that implement generating an acceptance interval for a unary operation
 */
export function makeUnaryToF32IntervalCase(param: number, ...ops: PointToInterval[]): Case {
  param = quantizeToF32(param);

  const intervals = ops.map(o => o(param));
  return { input: [f32(param)], expected: anyOf(...intervals) };
}

/**
 * Generates a Case for the params and binary interval generator provided.
 * The Case will use use an interval comparator for matching results.
 * @param param0 the first param or left hand side to pass into the binary operation
 * @param param1 the second param or rhs hand side to pass into the binary operation
 * @param ops callbacks that implement generating an acceptance interval for a binary operation
 */
export function makeBinaryToF32IntervalCase(
  param0: number,
  param1: number,
  ...ops: BinaryToInterval[]
): Case {
  param0 = quantizeToF32(param0);
  param1 = quantizeToF32(param1);

  const intervals = ops.map(o => o(param0, param1));
  return { input: [f32(param0), f32(param1)], expected: anyOf(...intervals) };
}

/**
 * Generates a Case for the params and ternary interval generator provided.
 * The Case will use use an interval comparator for matching results.
 * @param param0 the first param to pass into the ternary operation
 * @param param1 the second param to pass into the ternary operation
 * @param param2 the third param to pass into the ternary operation
 * @param ops callbacks that implement generating an acceptance interval for a
 *           ternary operation.
 */
export function makeTernaryToF32IntervalCase(
  param0: number,
  param1: number,
  param2: number,
  ...ops: TernaryToInterval[]
): Case {
  param0 = quantizeToF32(param0);
  param1 = quantizeToF32(param1);
  param2 = quantizeToF32(param2);

  const intervals = ops.map(o => o(param0, param1, param2));
  return {
    input: [f32(param0), f32(param1), f32(param2)],
    expected: anyOf(...intervals),
  };
}

/**
 * Generates a Case for the param and vector interval generator provided.
 * @param param the param to pass into the operation
 * @param ops callbacks that implement generating an acceptance interval for a
 *            vector.
 */
export function makeVectorToF32IntervalCase(param: number[], ...ops: VectorToInterval[]): Case {
  param = param.map(quantizeToF32);
  const param_f32 = param.map(f32);

  const intervals = ops.map(o => o(param));
  return {
    input: [new Vector(param_f32)],
    expected: anyOf(...intervals),
  };
}

/**
 * Generates a Case for the params and vector pair interval generator provided.
 * @param param0 the first param to pass into the operation
 * @param param1 the second param to pass into the operation
 * @param ops callbacks that implement generating an acceptance interval for a
 *            pair of vectors.
 */
export function makeVectorPairToF32IntervalCase(
  param0: number[],
  param1: number[],
  ...ops: VectorPairToInterval[]
): Case {
  param0 = param0.map(quantizeToF32);
  param1 = param1.map(quantizeToF32);
  const param0_f32 = param0.map(f32);
  const param1_f32 = param1.map(f32);

  const intervals = ops.map(o => o(param0, param1));
  return {
    input: [new Vector(param0_f32), new Vector(param1_f32)],
    expected: anyOf(...intervals),
  };
}

/**
 * Generates a Case for the param and vector of intervals generator provided.
 * @param param the param to pass into the operation
 * @param ops callbacks that implement generating an vector of acceptance
 *            intervals for a vector.
 */
export function makeVectorToVectorIntervalCase(param: number[], ...ops: VectorToVector[]): Case {
  param = param.map(quantizeToF32);
  const param_f32 = param.map(f32);

  const vectors = ops.map(o => o(param));
  return {
    input: [new Vector(param_f32)],
    expected: anyOf(...vectors),
  };
}

/**
 * Generates a Case for the params and vector of intervals generator provided.
 * @param param0 the first param to pass into the operation
 * @param param1 the second param to pass into the operation
 * @param ops callbacks that implement generating an vector of acceptance
 *            intervals for a pair of vectors.
 */
export function makeVectorPairToVectorIntervalCase(
  param0: number[],
  param1: number[],
  ...ops: VectorPairToVector[]
): Case {
  param0 = param0.map(quantizeToF32);
  param1 = param1.map(quantizeToF32);
  const param0_f32 = param0.map(f32);
  const param1_f32 = param1.map(f32);

  const vectors = ops.map(o => o(param0, param1));
  return {
    input: [new Vector(param0_f32), new Vector(param1_f32)],
    expected: anyOf(...vectors),
  };
}
