import { globalTestConfig } from '../../../../common/framework/test_config.js';
import { objectEquals, unreachable } from '../../../../common/util/util.js';
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
  u32,
  i32,
  Matrix,
  MatrixType,
  ScalarBuilder,
} from '../../../util/conversion.js';
import {
  BinaryToInterval,
  F32Interval,
  MatrixPairToMatrix,
  MatrixScalarToMatrix,
  MatrixToMatrix,
  MatrixToScalar,
  MatrixVectorToVector,
  PointToInterval,
  PointToVector,
  ScalarMatrixToMatrix,
  ScalarVectorToVector,
  TernaryToInterval,
  VectorMatrixToVector,
  VectorPairToInterval,
  VectorPairToVector,
  VectorScalarToVector,
  VectorToInterval,
  VectorToVector,
} from '../../../util/f32_interval.js';
import {
  cartesianProduct,
  map2DArray,
  QuantizeFunc,
  quantizeToF32,
  quantizeToI32,
  quantizeToU32,
} from '../../../util/math.js';

export type Expectation = Value | F32Interval | F32Interval[] | F32Interval[][] | Comparator;

/** Is this expectation actually a Comparator */
function isComparator(e: Expectation): boolean {
  return !(
    e instanceof F32Interval ||
    e instanceof Scalar ||
    e instanceof Vector ||
    e instanceof Matrix ||
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

// Helper for returning the stride for a given Type
function valueStride(ty: Type): number {
  if (ty instanceof MatrixType) {
    switch (ty.cols) {
      case 2:
        switch (ty.rows) {
          case 2:
            return 16;
          case 3:
            return 32;
          case 4:
            return 32;
        }
        break;
      case 3:
        switch (ty.rows) {
          case 2:
            return 32;
          case 3:
            return 64;
          case 4:
            return 64;
        }
        break;
      case 4:
        switch (ty.rows) {
          case 2:
            return 32;
          case 3:
            return 64;
          case 4:
            return 64;
        }
        break;
    }
    unreachable(
      `Attempted to get stride length for a matrix with dimensions (${ty.cols}x${ty.rows}), which isn't currently handled`
    );
  }

  // Handles scalars and vectors
  return 16;
}

// Helper for summing up all of the stride values for an array of Types
function valueStrides(tys: Type[]): number {
  return tys.map(valueStride).reduce((sum, c) => sum + c);
}

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

// A Pipeline is a map of WGSL shader source to a built pipeline
type PipelineCache = Map<String, GPUComputePipeline>;

/**
 * Searches for an entry with the given key, adding and returning the result of calling
 * @p create if the entry was not found.
 * @param map the cache map
 * @param key the entry's key
 * @param create the function used to construct a value, if not found in the cache
 * @returns the value, either fetched from the cache, or newly built.
 */
function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V) {
  const existing = map.get(key);
  if (existing !== undefined) {
    return existing;
  }
  const value = create();
  map.set(key, value);
  return value;
}

/**
 * Runs the list of expression tests, possibly splitting the tests into multiple
 * dispatches to keep the input data within the buffer binding limits.
 * run() will pack the scalar test cases into smaller set of vectorized tests
 * if `cfg.vectorize` is defined.
 * @param t the GPUTest
 * @param shaderBuilder the shader builder function
 * @param parameterTypes the list of expression parameter types
 * @param resultType the return type for the expression overload
 * @param cfg test configuration values
 * @param cases list of test cases
 */
export async function run(
  t: GPUTest,
  shaderBuilder: ShaderBuilder,
  parameterTypes: Array<Type>,
  resultType: Type,
  cfg: Config = { inputSource: 'storage_r' },
  cases: CaseList
) {
  // If the 'vectorize' config option was provided, pack the cases into vectors.
  if (cfg.vectorize !== undefined) {
    const packed = packScalarsToVector(parameterTypes, resultType, cases, cfg.vectorize);
    cases = packed.cases;
    parameterTypes = packed.parameterTypes;
    resultType = packed.resultType;
  }

  // The size of the input buffer may exceed the maximum buffer binding size,
  // so chunk the tests up into batches that fit into the limits. We also split
  // the cases into smaller batches to help with shader compilation performance.
  const casesPerBatch = (function () {
    switch (cfg.inputSource) {
      case 'const':
        // Some drivers are slow to optimize shaders with many constant values,
        // or statements. 32 is an empirically picked number of cases that works
        // well for most drivers.
        return 32;
      case 'uniform':
        // Some drivers are slow to build pipelines with large uniform buffers.
        // 2k appears to be a sweet-spot when benchmarking.
        return Math.floor(
          Math.min(1024 * 2, t.device.limits.maxUniformBufferBindingSize) /
            valueStrides(parameterTypes)
        );
      case 'storage_r':
      case 'storage_rw':
        return Math.floor(
          t.device.limits.maxStorageBufferBindingSize / valueStrides(parameterTypes)
        );
    }
  })();

  // A cache to hold built shader pipelines.
  const pipelineCache = new Map<String, GPUComputePipeline>();

  // Submit all the cases in batches, each in a separate error scope.
  const checkResults: Array<Promise<void>> = [];
  for (let i = 0; i < cases.length; i += casesPerBatch) {
    const batchCases = cases.slice(i, Math.min(i + casesPerBatch, cases.length));

    t.device.pushErrorScope('validation');

    const checkBatch = submitBatch(
      t,
      shaderBuilder,
      parameterTypes,
      resultType,
      batchCases,
      cfg.inputSource,
      pipelineCache
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
 * @param shaderBuilder the shader builder function
 * @param parameterTypes the list of expression parameter types
 * @param resultType the return type for the expression overload
 * @param cases list of test cases that fit within the binding limits of the device
 * @param inputSource the source of the input values
 * @param pipelineCache the cache of compute pipelines, shared between batches
 * @returns a function that checks the results are as expected
 */
function submitBatch(
  t: GPUTest,
  shaderBuilder: ShaderBuilder,
  parameterTypes: Array<Type>,
  resultType: Type,
  cases: CaseList,
  inputSource: InputSource,
  pipelineCache: PipelineCache
): () => void {
  // Construct a buffer to hold the results of the expression tests
  const outputBufferSize = cases.length * valueStride(resultType);
  const outputBuffer = t.device.createBuffer({
    size: outputBufferSize,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
  });

  const [pipeline, group] = buildPipeline(
    t,
    shaderBuilder,
    parameterTypes,
    resultType,
    cases,
    inputSource,
    outputBuffer,
    pipelineCache
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
        outputs[i] = resultType.read(outputData, i * valueStride(resultType));
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
 * map is a helper for returning a new array with each element of @p v
 * transformed with @p fn.
 * If @p v is not an array, then @p fn is called with (v, 0).
 */
function map<T, U>(v: T | T[], fn: (value: T, index?: number) => U): U[] {
  if (v instanceof Array) {
    return v.map(fn);
  }
  return [fn(v, 0)];
}

/**
 * ShaderBuilder is a function used to construct the WGSL shader used by an
 * expression test.
 * @param parameterTypes the list of expression parameter types
 * @param resultType the return type for the expression overload
 * @param cases list of test cases that fit within the binding limits of the device
 * @param inputSource the source of the input values
 */
export type ShaderBuilder = (
  parameterTypes: Array<Type>,
  resultType: Type,
  cases: CaseList,
  inputSource: InputSource
) => string;

/**
 * Helper that returns the WGSL to declare the output storage buffer for a shader
 */
function wgslOutputs(resultType: Type, count: number): string {
  return `
struct Output {
  @size(${valueStride(resultType)}) value : ${storageType(resultType)}
};
@group(0) @binding(0) var<storage, read_write> outputs : array<Output, ${count}>;`;
}

/**
 * Helper that returns the WGSL 'var' declaration for the given input source
 */
function wgslInputVar(inputSource: InputSource, count: number) {
  switch (inputSource) {
    case 'storage_r':
      return `@group(0) @binding(1) var<storage, read> inputs : array<Input, ${count}>;`;
    case 'storage_rw':
      return `@group(0) @binding(1) var<storage, read_write> inputs : array<Input, ${count}>;`;
    case 'uniform':
      return `@group(0) @binding(1) var<uniform> inputs : array<Input, ${count}>;`;
  }
  throw new Error(`InputSource ${inputSource} does not use an input var`);
}

/**
 * ExpressionBuilder returns the WGSL used to evaluate an expression with the
 * given input values.
 */
export type ExpressionBuilder = (values: Array<string>) => string;

/**
 * Returns a ShaderBuilder that builds a basic expression test shader.
 * @param expressionBuilder the expression builder
 */
export function basicExpressionBuilder(expressionBuilder: ExpressionBuilder): ShaderBuilder {
  return (
    parameterTypes: Array<Type>,
    resultType: Type,
    cases: CaseList,
    inputSource: InputSource
  ) => {
    if (inputSource === 'const') {
      //////////////////////////////////////////////////////////////////////////
      // Constant eval
      //////////////////////////////////////////////////////////////////////////
      let body = '';
      if (globalTestConfig.unrollConstEvalLoops) {
        body = cases.map((_, i) => `  outputs[${i}].value = values[${i}];`).join('\n  ');
      } else {
        body = `
  for (var i = 0u; i < ${cases.length}; i++) {
    outputs[i].value = values[i];
  }`;
      }

      return `
${wgslOutputs(resultType, cases.length)}

const values = array(
  ${cases
    .map(c => toStorage(resultType, expressionBuilder(map(c.input, v => v.wgsl()))))
    .join(',\n  ')}
);

@compute @workgroup_size(1)
fn main() {
${body}
}`;
    } else {
      //////////////////////////////////////////////////////////////////////////
      // Runtime eval
      //////////////////////////////////////////////////////////////////////////

      // returns the WGSL expression to load the ith parameter of the given type from the input buffer
      const paramExpr = (ty: Type, i: number) => fromStorage(ty, `inputs[i].param${i}`);

      // resolves to the expression that calls the builtin
      const expr = toStorage(resultType, expressionBuilder(parameterTypes.map(paramExpr)));

      return `
struct Input {
${parameterTypes
  .map((ty, i) => `  @size(${valueStride(ty)}) param${i} : ${storageType(ty)},`)
  .join('\n')}
};

${wgslOutputs(resultType, cases.length)}

${wgslInputVar(inputSource, cases.length)}

@compute @workgroup_size(1)
fn main() {
  for (var i = 0; i < ${cases.length}; i++) {
    outputs[i].value = ${expr};
  }
}
`;
    }
  };
}

/**
 * Returns a ShaderBuilder that builds a compound assignment operator test shader.
 * @param op the compound operator
 */
export function compoundAssignmentBuilder(op: string): ShaderBuilder {
  return (
    parameterTypes: Array<Type>,
    resultType: Type,
    cases: CaseList,
    inputSource: InputSource
  ) => {
    //////////////////////////////////////////////////////////////////////////
    // Input validation
    //////////////////////////////////////////////////////////////////////////
    if (parameterTypes.length !== 2) {
      throw new Error(`compoundBinaryOp() requires exactly two parameters values per case`);
    }
    const lhsType = parameterTypes[0];
    const rhsType = parameterTypes[1];
    if (!objectEquals(lhsType, resultType)) {
      throw new Error(
        `compoundBinaryOp() requires result type (${resultType}) to be equal to the LHS type (${lhsType})`
      );
    }
    if (inputSource === 'const') {
      //////////////////////////////////////////////////////////////////////////
      // Constant eval
      //////////////////////////////////////////////////////////////////////////
      let body = '';
      if (globalTestConfig.unrollConstEvalLoops) {
        body = cases
          .map((_, i) => {
            return `
  var ret_${i} = lhs[${i}];
  ret_${i} ${op} rhs[${i}];
  outputs[${i}].value = ${storageType(resultType)}(ret_${i});`;
          })
          .join('\n  ');
      } else {
        body = `
  for (var i = 0u; i < ${cases.length}; i++) {
    var ret = lhs[i];
    ret ${op} rhs[i];
    outputs[i].value = ${storageType(resultType)}(ret);
  }`;
      }

      const values = cases.map(c => (c.input as Value[]).map(v => v.wgsl()));

      return `
${wgslOutputs(resultType, cases.length)}

const lhs = array(
${values.map(c => `${c[0]}`).join(',\n  ')}
      );
const rhs = array(
${values.map(c => `${c[1]}`).join(',\n  ')}
);

@compute @workgroup_size(1)
fn main() {
${body}
}`;
    } else {
      //////////////////////////////////////////////////////////////////////////
      // Runtime eval
      //////////////////////////////////////////////////////////////////////////
      return `
${wgslOutputs(resultType, cases.length)}

struct Input {
  @size(${valueStride(lhsType)}) lhs : ${storageType(lhsType)},
  @size(${valueStride(rhsType)}) rhs : ${storageType(rhsType)},
}

${wgslInputVar(inputSource, cases.length)}

@compute @workgroup_size(1)
fn main() {
  for (var i = 0; i < ${cases.length}; i++) {
    var ret = ${lhsType}(inputs[i].lhs);
    ret ${op} ${rhsType}(inputs[i].rhs);
    outputs[i].value = ${storageType(resultType)}(ret);
  }
}
`;
    }
  };
}

/**
 * Constructs and returns a GPUComputePipeline and GPUBindGroup for running a
 * batch of test cases. If a pre-created pipeline can be found in
 * @p pipelineCache, then this may be returned instead of creating a new
 * pipeline.
 * @param t the GPUTest
 * @param shaderBuilder the shader builder
 * @param parameterTypes the list of expression parameter types
 * @param resultType the return type for the expression overload
 * @param cases list of test cases that fit within the binding limits of the device
 * @param inputSource the source of the input values
 * @param outputBuffer the buffer that will hold the output values of the tests
 * @param pipelineCache the cache of compute pipelines, shared between batches
 */
function buildPipeline(
  t: GPUTest,
  shaderBuilder: ShaderBuilder,
  parameterTypes: Array<Type>,
  resultType: Type,
  cases: CaseList,
  inputSource: InputSource,
  outputBuffer: GPUBuffer,
  pipelineCache: PipelineCache
): [GPUComputePipeline, GPUBindGroup] {
  cases.forEach(c => {
    const inputTypes = c.input instanceof Array ? c.input.map(i => i.type) : [c.input.type];
    if (!objectEquals(inputTypes, parameterTypes)) {
      const input_str = `[${inputTypes.join(',')}]`;
      const param_str = `[${parameterTypes.join(',')}]`;
      throw new Error(
        `case input types ${input_str} do not match provided runner parameter types ${param_str}`
      );
    }
  });

  const source = shaderBuilder(parameterTypes, resultType, cases, inputSource);

  switch (inputSource) {
    case 'const': {
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
      // Input values come from a uniform or storage buffer

      // size in bytes of the input buffer
      const inputSize = cases.length * valueStrides(parameterTypes);

      // Holds all the parameter values for all cases
      const inputData = new Uint8Array(inputSize);

      // Pack all the input parameter values into the inputData buffer
      {
        const caseStride = valueStrides(parameterTypes);
        for (let caseIdx = 0; caseIdx < cases.length; caseIdx++) {
          const caseBase = caseIdx * caseStride;
          let offset = caseBase;
          for (let paramIdx = 0; paramIdx < parameterTypes.length; paramIdx++) {
            const params = cases[caseIdx].input;
            if (params instanceof Array) {
              params[paramIdx].copyTo(inputData, offset);
            } else {
              params.copyTo(inputData, offset);
            }
            offset += valueStride(parameterTypes[paramIdx]);
          }
        }
      }

      // build the compute pipeline, if the shader hasn't been compiled already.
      const pipeline = getOrCreate(pipelineCache, source, () => {
        // build the shader module
        const module = t.device.createShaderModule({ code: source });

        // build the pipeline
        return t.device.createComputePipeline({
          layout: 'auto',
          compute: { module, entryPoint: 'main' },
        });
      });

      // build the input buffer
      const inputBuffer = t.makeBufferWithContents(
        inputData,
        GPUBufferUsage.COPY_SRC |
          (inputSource === 'uniform' ? GPUBufferUsage.UNIFORM : GPUBufferUsage.STORAGE)
      );

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
  resultType: Type,
  cases: CaseList,
  vectorWidth: number
): { cases: CaseList; parameterTypes: Array<Type>; resultType: Type } {
  // Validate that the parameters and return type are all vectorizable
  for (let i = 0; i < parameterTypes.length; i++) {
    const ty = parameterTypes[i];
    if (!(ty instanceof ScalarType)) {
      throw new Error(
        `packScalarsToVector() can only be used on scalar parameter types, but the ${i}'th parameter type is a ${ty}'`
      );
    }
  }
  if (!(resultType instanceof ScalarType)) {
    throw new Error(
      `packScalarsToVector() can only be used with a scalar return type, but the return type is a ${resultType}'`
    );
  }

  const packedCases: Array<Case> = [];
  const packedParameterTypes = parameterTypes.map(p => TypeVec(vectorWidth, p as ScalarType));
  const packedResultType = new VectorType(vectorWidth, resultType);

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
        got: `${packedResultType}(${gElements.join(', ')})`,
        expected: `${packedResultType}(${eElements.join(', ')})`,
      };
    };

    // Append the new packed case
    packedCases.push({ input: packedInputs, expected: packedComparator });
    caseIdx += vectorWidth;
  }

  return {
    cases: packedCases,
    parameterTypes: packedParameterTypes,
    resultType: packedResultType,
  };
}

/**
 * Indicates bounds that acceptance intervals need to be within to avoid inputs
 * being filtered out. This is used for const-eval tests, since going OOB will
 * cause a validation error not an execution error.
 */
export type IntervalFilter =
  | 'f32-only' // Expected to be f32 finite
  | 'unfiltered'; // No expectations

/**
 * @returns a Case for the param and unary interval generator provided
 * The Case will use use an interval comparator for matching results.
 * @param param the param to pass in
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an acceptance interval for an
 *            unary operation
 */
function makeUnaryToF32IntervalCase(
  param: number,
  filter: IntervalFilter,
  ...ops: PointToInterval[]
): Case | undefined {
  param = quantizeToF32(param);

  const intervals = ops.map(o => o(param));
  if (filter === 'f32-only' && intervals.some(i => !i.isFinite())) {
    return undefined;
  }
  return { input: [f32(param)], expected: anyOf(...intervals) };
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param params array of inputs to try
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an acceptance interval for an
 *            unary operation
 */
export function generateUnaryToF32IntervalCases(
  params: number[],
  filter: IntervalFilter,
  ...ops: PointToInterval[]
): Case[] {
  return params.reduce((cases, e) => {
    const c = makeUnaryToF32IntervalCase(e, filter, ...ops);
    if (c !== undefined) {
      cases.push(c);
    }
    return cases;
  }, new Array<Case>());
}

/**
 * @returns a Case for the params and binary interval generator provided
 * The Case will use use an interval comparator for matching results.
 * @param param0 the first param or left hand side to pass in
 * @param param1 the second param or rhs hand side to pass in
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an acceptance interval for a
 *            binary operation
 */
function makeBinaryToF32IntervalCase(
  param0: number,
  param1: number,
  filter: IntervalFilter,
  ...ops: BinaryToInterval[]
): Case | undefined {
  param0 = quantizeToF32(param0);
  param1 = quantizeToF32(param1);

  const intervals = ops.map(o => o(param0, param1));
  if (filter === 'f32-only' && intervals.some(i => !i.isFinite())) {
    return undefined;
  }
  return { input: [f32(param0), f32(param1)], expected: anyOf(...intervals) };
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param param0s array of inputs to try for the first param
 * @param param1s array of inputs to try for the second param
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an acceptance interval for a
 *            binary operation
 */
export function generateBinaryToF32IntervalCases(
  param0s: number[],
  param1s: number[],
  filter: IntervalFilter,
  ...ops: BinaryToInterval[]
): Case[] {
  return cartesianProduct(param0s, param1s).reduce((cases, e) => {
    const c = makeBinaryToF32IntervalCase(e[0], e[1], filter, ...ops);
    if (c !== undefined) {
      cases.push(c);
    }
    return cases;
  }, new Array<Case>());
}

/**
 * @returns a Case for the params and ternary interval generator provided
 * The Case will use use an interval comparator for matching results.
 * @param param0 the first param to pass in
 * @param param1 the second param to pass in
 * @param param2 the third param to pass in
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an acceptance interval for a
 *            ternary operation.
 */
function makeTernaryToF32IntervalCase(
  param0: number,
  param1: number,
  param2: number,
  filter: IntervalFilter,
  ...ops: TernaryToInterval[]
): Case | undefined {
  param0 = quantizeToF32(param0);
  param1 = quantizeToF32(param1);
  param2 = quantizeToF32(param2);

  const intervals = ops.map(o => o(param0, param1, param2));
  if (filter === 'f32-only' && intervals.some(i => !i.isFinite())) {
    return undefined;
  }
  return {
    input: [f32(param0), f32(param1), f32(param2)],
    expected: anyOf(...intervals),
  };
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param param0s array of inputs to try for the first param
 * @param param1s array of inputs to try for the second param
 * @param param2s array of inputs to try for the third param
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an acceptance interval for a
 *            ternary operation.
 */
export function generateTernaryToF32IntervalCases(
  param0s: number[],
  param1s: number[],
  param2s: number[],
  filter: IntervalFilter,
  ...ops: TernaryToInterval[]
): Case[] {
  return cartesianProduct(param0s, param1s, param2s).reduce((cases, e) => {
    const c = makeTernaryToF32IntervalCase(e[0], e[1], e[2], filter, ...ops);
    if (c !== undefined) {
      cases.push(c);
    }
    return cases;
  }, new Array<Case>());
}

/**
 * @returns a Case for the param and vector interval generator provided
 * @param param the param to pass in
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an acceptance interval for a
 *            vector.
 */
function makeVectorToF32IntervalCase(
  param: number[],
  filter: IntervalFilter,
  ...ops: VectorToInterval[]
): Case | undefined {
  param = param.map(quantizeToF32);
  const param_f32 = param.map(f32);

  const intervals = ops.map(o => o(param));
  if (filter === 'f32-only' && intervals.some(i => !i.isFinite())) {
    return undefined;
  }
  return {
    input: [new Vector(param_f32)],
    expected: anyOf(...intervals),
  };
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param params array of inputs to try
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an acceptance interval for a
 *            vector.
 */
export function generateVectorToF32IntervalCases(
  params: number[][],
  filter: IntervalFilter,
  ...ops: VectorToInterval[]
): Case[] {
  return params.reduce((cases, e) => {
    const c = makeVectorToF32IntervalCase(e, filter, ...ops);
    if (c !== undefined) {
      cases.push(c);
    }
    return cases;
  }, new Array<Case>());
}

/**
 * @returns a Case for the params and vector pair interval generator provided
 * @param param0 the first param to pass in
 * @param param1 the second param to pass in
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an acceptance interval for a
 *            pair of vectors.
 */
function makeVectorPairToF32IntervalCase(
  param0: number[],
  param1: number[],
  filter: IntervalFilter,
  ...ops: VectorPairToInterval[]
): Case | undefined {
  param0 = param0.map(quantizeToF32);
  param1 = param1.map(quantizeToF32);
  const param0_f32 = param0.map(f32);
  const param1_f32 = param1.map(f32);

  const intervals = ops.map(o => o(param0, param1));
  if (filter === 'f32-only' && intervals.some(i => !i.isFinite())) {
    return undefined;
  }
  return {
    input: [new Vector(param0_f32), new Vector(param1_f32)],
    expected: anyOf(...intervals),
  };
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param param0s array of inputs to try for the first input
 * @param param1s array of inputs to try for the second input
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an acceptance interval for a
 *            pair of vectors.
 */
export function generateVectorPairToF32IntervalCases(
  param0s: number[][],
  param1s: number[][],
  filter: IntervalFilter,
  ...ops: VectorPairToInterval[]
): Case[] {
  return cartesianProduct(param0s, param1s).reduce((cases, e) => {
    const c = makeVectorPairToF32IntervalCase(e[0], e[1], filter, ...ops);
    if (c !== undefined) {
      cases.push(c);
    }
    return cases;
  }, new Array<Case>());
}

/**
 * @returns a Case for the param and vector of intervals generator provided
 * @param param the param to pass in
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an vector of acceptance
 *            intervals for a vector.
 */
function makeVectorToVectorCase(
  param: number[],
  filter: IntervalFilter,
  ...ops: VectorToVector[]
): Case | undefined {
  param = param.map(quantizeToF32);
  const param_f32 = param.map(f32);

  const vectors = ops.map(o => o(param));
  if (filter === 'f32-only' && vectors.some(v => v.some(e => !e.isFinite()))) {
    return undefined;
  }
  return {
    input: [new Vector(param_f32)],
    expected: anyOf(...vectors),
  };
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param params array of inputs to try
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an vector of acceptance
 *            intervals for a vector.
 */
export function generateVectorToVectorCases(
  params: number[][],
  filter: IntervalFilter,
  ...ops: VectorToVector[]
): Case[] {
  return params.reduce((cases, e) => {
    const c = makeVectorToVectorCase(e, filter, ...ops);
    if (c !== undefined) {
      cases.push(c);
    }
    return cases;
  }, new Array<Case>());
}

/**
 * @returns a Case for the params and vector of intervals generator provided
 * @param param0 the first param to pass in
 * @param param1 the second param to pass in
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an vector of acceptance
 *            intervals for a pair of vectors.
 */
function makeVectorPairToVectorCase(
  param0: number[],
  param1: number[],
  filter: IntervalFilter,
  ...ops: VectorPairToVector[]
): Case | undefined {
  param0 = param0.map(quantizeToF32);
  param1 = param1.map(quantizeToF32);
  const param0_f32 = param0.map(f32);
  const param1_f32 = param1.map(f32);

  const vectors = ops.map(o => o(param0, param1));
  if (filter === 'f32-only' && vectors.some(v => v.some(e => !e.isFinite()))) {
    return undefined;
  }
  return {
    input: [new Vector(param0_f32), new Vector(param1_f32)],
    expected: anyOf(...vectors),
  };
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param param0s array of inputs to try for the first input
 * @param param1s array of inputs to try for the second input
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an vector of acceptance
 *            intervals for a pair of vectors.
 */
export function generateVectorPairToVectorCases(
  param0s: number[][],
  param1s: number[][],
  filter: IntervalFilter,
  ...ops: VectorPairToVector[]
): Case[] {
  return cartesianProduct(param0s, param1s).reduce((cases, e) => {
    const c = makeVectorPairToVectorCase(e[0], e[1], filter, ...ops);
    if (c !== undefined) {
      cases.push(c);
    }
    return cases;
  }, new Array<Case>());
}

/**
 * @returns a Case for the params and the interval generators provided
 * @param vec the vector param to pass in
 * @param scalar the scalar to pass in
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating a vector of acceptance
 *            intervals for a vector and a scalar.
 */
function makeVectorF32ToVectorCase(
  vec: number[],
  scalar: number,
  filter: IntervalFilter,
  ...ops: VectorScalarToVector[]
): Case | undefined {
  vec = vec.map(quantizeToF32);
  scalar = quantizeToF32(scalar);
  const vec_f32 = vec.map(f32);
  const scalar_f32 = f32(scalar);

  const results = ops.map(o => o(vec, scalar));
  if (filter === 'f32-only' && results.some(r => r.some(e => !e.isFinite()))) {
    return undefined;
  }
  return {
    input: [new Vector(vec_f32), scalar_f32],
    expected: anyOf(...results),
  };
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param vecs array of inputs to try for the vector input
 * @param scalars array of inputs to try for the scalar input
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating a vector of acceptance
 *            intervals for a vector and a scalar.
 */
export function generateVectorF32ToVectorCases(
  vecs: number[][],
  scalars: number[],
  filter: IntervalFilter,
  ...ops: VectorScalarToVector[]
): Case[] {
  // Cannot use cartesianProduct here, due to heterogeneous types
  const cases: Case[] = [];
  vecs.forEach(vec => {
    scalars.forEach(scalar => {
      const c = makeVectorF32ToVectorCase(vec, scalar, filter, ...ops);
      if (c !== undefined) {
        cases.push(c);
      }
    });
  });
  return cases;
}

/**
 * @returns a Case for the params and the interval generators provided
 * @param scalar the scalar to pass in
 * @param vec the vector param to pass in
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating a vector of acceptance
 *            intervals for a scalar and a vector.
 */
function makeF32VectorToVectorCase(
  scalar: number,
  vec: number[],
  filter: IntervalFilter,
  ...ops: ScalarVectorToVector[]
): Case | undefined {
  scalar = quantizeToF32(scalar);
  vec = vec.map(quantizeToF32);
  const scalar_f32 = f32(scalar);
  const vec_f32 = vec.map(f32);

  const results = ops.map(o => o(scalar, vec));
  if (filter === 'f32-only' && results.some(r => r.some(e => !e.isFinite()))) {
    return undefined;
  }
  return {
    input: [scalar_f32, new Vector(vec_f32)],
    expected: anyOf(...results),
  };
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param scalars array of inputs to try for the scalar input
 * @param vecs array of inputs to try for the vector input
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating a vector of acceptance
 *            intervals for a scalar and a vector .
 */
export function generateF32VectorToVectorCases(
  scalars: number[],
  vecs: number[][],
  filter: IntervalFilter,
  ...ops: ScalarVectorToVector[]
): Case[] {
  // Cannot use cartesianProduct here, due to heterogeneous types
  const cases: Case[] = [];
  scalars.forEach(scalar => {
    vecs.forEach(vec => {
      const c = makeF32VectorToVectorCase(scalar, vec, filter, ...ops);
      if (c !== undefined) {
        cases.push(c);
      }
    });
  });
  return cases;
}

/**
 * @returns a Case for the param and an array of interval generators provided
 * @param param the param to pass in
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an acceptance  interval for a
 *            matrix.
 */
function makeMatrixToScalarCase(
  param: number[][],
  filter: IntervalFilter,
  ...ops: MatrixToScalar[]
): Case | undefined {
  param = map2DArray(param, quantizeToF32);
  const param_f32 = map2DArray(param, f32);

  const results = ops.map(o => o(param));
  if (filter === 'f32-only' && results.some(e => !e.isFinite())) {
    return undefined;
  }

  return {
    input: [new Matrix(param_f32)],
    expected: anyOf(...results),
  };
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param params array of inputs to try
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an acceptance interval for a
 *            matrix.
 */
export function generateMatrixToScalarCases(
  params: number[][][],
  filter: IntervalFilter,
  ...ops: MatrixToScalar[]
): Case[] {
  return params.reduce((cases, e) => {
    const c = makeMatrixToScalarCase(e, filter, ...ops);
    if (c !== undefined) {
      cases.push(c);
    }
    return cases;
  }, new Array<Case>());
}

/**
 * @returns a Case for the param and an array of interval generators provided
 * @param param the param to pass in
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating a matrix of acceptance
 *            intervals for a matrix.
 */
function makeMatrixToMatrixCase(
  param: number[][],
  filter: IntervalFilter,
  ...ops: MatrixToMatrix[]
): Case | undefined {
  param = map2DArray(param, quantizeToF32);
  const param_f32 = map2DArray(param, f32);

  const results = ops.map(o => o(param));
  if (filter === 'f32-only' && results.some(m => m.some(c => c.some(r => !r.isFinite())))) {
    return undefined;
  }

  return {
    input: [new Matrix(param_f32)],
    expected: anyOf(...results),
  };
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param params array of inputs to try
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating a matrix of acceptance
 *            intervals for a matrix.
 */
export function generateMatrixToMatrixCases(
  params: number[][][],
  filter: IntervalFilter,
  ...ops: MatrixToMatrix[]
): Case[] {
  return params.reduce((cases, e) => {
    const c = makeMatrixToMatrixCase(e, filter, ...ops);
    if (c !== undefined) {
      cases.push(c);
    }
    return cases;
  }, new Array<Case>());
}

/**
 * @returns a Case for the params and matrix of intervals generator provided
 * @param param0 the first param to pass in
 * @param param1 the second param to pass in
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an matrix of acceptance
 *            intervals for a pair of matrices.
 */
function makeMatrixPairToMatrixCase(
  param0: number[][],
  param1: number[][],
  filter: IntervalFilter,
  ...ops: MatrixPairToMatrix[]
): Case | undefined {
  param0 = map2DArray(param0, quantizeToF32);
  param1 = map2DArray(param1, quantizeToF32);
  const param0_f32 = map2DArray(param0, f32);
  const param1_f32 = map2DArray(param1, f32);

  const results = ops.map(o => o(param0, param1));
  if (filter === 'f32-only' && results.some(m => m.some(c => c.some(r => !r.isFinite())))) {
    return undefined;
  }
  return {
    input: [new Matrix(param0_f32), new Matrix(param1_f32)],
    expected: anyOf(...results),
  };
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param param0s array of inputs to try for the first input
 * @param param1s array of inputs to try for the second input
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an matrix of acceptance
 *            intervals for a pair of matrices.
 */
export function generateMatrixPairToMatrixCases(
  param0s: number[][][],
  param1s: number[][][],
  filter: IntervalFilter,
  ...ops: MatrixPairToMatrix[]
): Case[] {
  return cartesianProduct(param0s, param1s).reduce((cases, e) => {
    const c = makeMatrixPairToMatrixCase(e[0], e[1], filter, ...ops);
    if (c !== undefined) {
      cases.push(c);
    }
    return cases;
  }, new Array<Case>());
}

/**
 * @returns a Case for the params and matrix of intervals generator provided
 * @param mat the matrix param to pass in
 * @param scalar the scalar to pass in
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an matrix of acceptance
 *            intervals for a pair of matrices.
 */
function makeMatrixScalarToMatrixCase(
  mat: number[][],
  scalar: number,
  filter: IntervalFilter,
  ...ops: MatrixScalarToMatrix[]
): Case | undefined {
  mat = map2DArray(mat, quantizeToF32);
  scalar = quantizeToF32(scalar);
  const mat_f32 = map2DArray(mat, f32);
  const scalar_f32 = f32(scalar);

  const results = ops.map(o => o(mat, scalar));
  if (filter === 'f32-only' && results.some(m => m.some(c => c.some(r => !r.isFinite())))) {
    return undefined;
  }
  return {
    input: [new Matrix(mat_f32), scalar_f32],
    expected: anyOf(...results),
  };
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param mats array of inputs to try for the matrix input
 * @param scalars array of inputs to try for the scalar input
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an matrix of acceptance
 *            intervals for a pair of matrices.
 */
export function generateMatrixScalarToMatrixCases(
  mats: number[][][],
  scalars: number[],
  filter: IntervalFilter,
  ...ops: MatrixScalarToMatrix[]
): Case[] {
  // Cannot use cartesianProduct here, due to heterogeneous types
  const cases: Case[] = [];
  mats.forEach(mat => {
    scalars.forEach(scalar => {
      const c = makeMatrixScalarToMatrixCase(mat, scalar, filter, ...ops);
      if (c !== undefined) {
        cases.push(c);
      }
    });
  });
  return cases;
}

/**
 * @returns a Case for the params and matrix of intervals generator provided
 * @param mat the matrix param to pass in
 * @param scalar the scalar to pass in
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an matrix of acceptance
 *            intervals for a pair of matrices.
 */
function makeScalarMatrixToMatrixCase(
  scalar: number,
  mat: number[][],
  filter: IntervalFilter,
  ...ops: ScalarMatrixToMatrix[]
): Case | undefined {
  mat = map2DArray(mat, quantizeToF32);
  scalar = quantizeToF32(scalar);
  const mat_f32 = map2DArray(mat, f32);
  const scalar_f32 = f32(scalar);

  const results = ops.map(o => o(scalar, mat));
  if (filter === 'f32-only' && results.some(m => m.some(c => c.some(r => !r.isFinite())))) {
    return undefined;
  }
  return {
    input: [scalar_f32, new Matrix(mat_f32)],
    expected: anyOf(...results),
  };
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param scalars array of inputs to try for the scalar input
 * @param mats array of inputs to try for the matrix input
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an matrix of acceptance
 *            intervals for a pair of matrices.
 */
export function generateScalarMatrixToMatrixCases(
  scalars: number[],
  mats: number[][][],
  filter: IntervalFilter,
  ...ops: ScalarMatrixToMatrix[]
): Case[] {
  // Cannot use cartesianProduct here, due to heterogeneous types
  const cases: Case[] = [];
  mats.forEach(mat => {
    scalars.forEach(scalar => {
      const c = makeScalarMatrixToMatrixCase(scalar, mat, filter, ...ops);
      if (c !== undefined) {
        cases.push(c);
      }
    });
  });
  return cases;
}

/**
 * @returns a Case for the params and the vector of intervals generator provided
 * @param mat the matrix param to pass in
 * @param vec the vector to pass in
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating a vector of acceptance
 *            intervals for a matrix and a vector.
 */
function makeMatrixVectorToVectorCase(
  mat: number[][],
  vec: number[],
  filter: IntervalFilter,
  ...ops: MatrixVectorToVector[]
): Case | undefined {
  mat = map2DArray(mat, quantizeToF32);
  vec = vec.map(quantizeToF32);
  const mat_f32 = map2DArray(mat, f32);
  const vec_f32 = vec.map(f32);

  const results = ops.map(o => o(mat, vec));
  if (filter === 'f32-only' && results.some(v => v.some(e => !e.isFinite()))) {
    return undefined;
  }
  return {
    input: [new Matrix(mat_f32), new Vector(vec_f32)],
    expected: anyOf(...results),
  };
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param mats array of inputs to try for the matrix input
 * @param vecs array of inputs to try for the vector input
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating a vector of acceptance
 *            intervals for a matrix and a vector.
 */
export function generateMatrixVectorToVectorCases(
  mats: number[][][],
  vecs: number[][],
  filter: IntervalFilter,
  ...ops: MatrixVectorToVector[]
): Case[] {
  // Cannot use cartesianProduct here, due to heterogeneous types
  const cases: Case[] = [];
  mats.forEach(mat => {
    vecs.forEach(vec => {
      const c = makeMatrixVectorToVectorCase(mat, vec, filter, ...ops);
      if (c !== undefined) {
        cases.push(c);
      }
    });
  });
  return cases;
}

/**
 * @returns a Case for the params and the vector of intervals generator provided
 * @param vec the vector to pass in
 * @param mat the matrix param to pass in
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating a vector of acceptance
 *            intervals for a vector and a matrix.
 */
function makeVectorMatrixToVectorCase(
  vec: number[],
  mat: number[][],
  filter: IntervalFilter,
  ...ops: VectorMatrixToVector[]
): Case | undefined {
  vec = vec.map(quantizeToF32);
  mat = map2DArray(mat, quantizeToF32);
  const vec_f32 = vec.map(f32);
  const mat_f32 = map2DArray(mat, f32);

  const results = ops.map(o => o(vec, mat));
  if (filter === 'f32-only' && results.some(v => v.some(e => !e.isFinite()))) {
    return undefined;
  }
  return {
    input: [new Vector(vec_f32), new Matrix(mat_f32)],
    expected: anyOf(...results),
  };
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param vecs array of inputs to try for the vector input
 * @param mats array of inputs to try for the matrix input
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating a vector of acceptance
 *            intervals for a vector and a matrix.
 */
export function generateVectorMatrixToVectorCases(
  vecs: number[][],
  mats: number[][][],
  filter: IntervalFilter,
  ...ops: VectorMatrixToVector[]
): Case[] {
  // Cannot use cartesianProduct here, due to heterogeneous types
  const cases: Case[] = [];
  vecs.forEach(vec => {
    mats.forEach(mat => {
      const c = makeVectorMatrixToVectorCase(vec, mat, filter, ...ops);
      if (c !== undefined) {
        cases.push(c);
      }
    });
  });
  return cases;
}

/**
 * @returns a Case for the param and vector of intervals generator provided
 * The input is treated as an unsigned int.
 * @param param the param to pass in
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an acceptance
 *            interval for an unsigned int.
 */
function makeU32ToVectorCase(
  param: number,
  filter: IntervalFilter,
  ...ops: PointToVector[]
): Case | undefined {
  param = Math.trunc(param);
  const param_u32 = u32(param);

  const vectors = ops.map(o => o(param));
  if (filter === 'f32-only' && vectors.some(v => !v.every(e => e.isFinite()))) {
    return undefined;
  }
  return {
    input: param_u32,
    expected: anyOf(...vectors),
  };
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * The input is treated as an unsigned int.
 * @param params array of inputs to try
 * @param filter what interval filtering to apply
 * @param ops callbacks that implement generating an acceptance
 *            interval for an unsigned int.
 */
export function generateU32ToVectorCases(
  params: number[],
  filter: IntervalFilter,
  ...ops: PointToVector[]
): Case[] {
  return params.reduce((cases, e) => {
    const c = makeU32ToVectorCase(e, filter, ...ops);
    if (c !== undefined) {
      cases.push(c);
    }
    return cases;
  }, new Array<Case>());
}

/**
 * A function that performs a binary operation on x and y, and returns the expected
 * result.
 */
export interface BinaryOp {
  (x: number, y: number): number | undefined;
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param param0s array of inputs to try for the first param
 * @param param1s array of inputs to try for the second param
 * @param op callback called on each pair of inputs to produce each case
 */
export function generateBinaryToI32Cases(params0s: number[], params1s: number[], op: BinaryOp) {
  return cartesianProduct(params0s, params1s).reduce((cases, e) => {
    const expected = op(e[0], e[1]);
    if (expected !== undefined) {
      cases.push({ input: [i32(e[0]), i32(e[1])], expected: i32(expected) });
    }
    return cases;
  }, new Array<Case>());
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param param0s array of inputs to try for the first param
 * @param param1s array of inputs to try for the second param
 * @param op callback called on each pair of inputs to produce each case
 */
export function generateBinaryToU32Cases(params0s: number[], params1s: number[], op: BinaryOp) {
  return cartesianProduct(params0s, params1s).reduce((cases, e) => {
    const expected = op(e[0], e[1]);
    if (expected !== undefined) {
      cases.push({ input: [u32(e[0]), u32(e[1])], expected: u32(expected) });
    }
    return cases;
  }, new Array<Case>());
}

/**
 * @returns a Case for the input params with op applied
 * @param scalar scalar param
 * @param vector vector param (2, 3, or 4 elements)
 * @param op the op to apply to scalar and vector
 * @param quantize function to quantize all values in vectors and scalars
 * @param scalarize function to convert numbers to Scalars
 */
function makeScalarVectorBinaryToVectorCase(
  scalar: number,
  vector: number[],
  op: BinaryOp,
  quantize: QuantizeFunc,
  scalarize: ScalarBuilder
): Case | undefined {
  scalar = quantize(scalar);
  vector = vector.map(quantize);
  const result = vector.map(v => op(scalar, v));
  if (result.includes(undefined)) {
    return undefined;
  }
  return {
    input: [scalarize(scalar), new Vector(vector.map(scalarize))],
    expected: new Vector((result as number[]).map(scalarize)),
  };
}

/**
 * @returns array of Case for the input params with op applied
 * @param scalars array of scalar params
 * @param vectors array of vector params (2, 3, or 4 elements)
 * @param op the op to apply to each pair of scalar and vector
 * @param quantize function to quantize all values in vectors and scalars
 * @param scalarize function to convert numbers to Scalars
 */
function generateScalarVectorBinaryToVectorCases(
  scalars: number[],
  vectors: number[][],
  op: BinaryOp,
  quantize: QuantizeFunc,
  scalarize: ScalarBuilder
): Case[] {
  const cases = new Array<Case>();
  scalars.forEach(s => {
    vectors.forEach(v => {
      const c = makeScalarVectorBinaryToVectorCase(s, v, op, quantize, scalarize);
      if (c !== undefined) {
        cases.push(c);
      }
    });
  });
  return cases;
}

/**
 * @returns a Case for the input params with op applied
 * @param vector vector param (2, 3, or 4 elements)
 * @param scalar scalar param
 * @param op the op to apply to vector and scalar
 * @param quantize function to quantize all values in vectors and scalars
 * @param scalarize function to convert numbers to Scalars
 */
function makeVectorScalarBinaryToVectorCase(
  vector: number[],
  scalar: number,
  op: BinaryOp,
  quantize: QuantizeFunc,
  scalarize: ScalarBuilder
): Case | undefined {
  vector = vector.map(quantize);
  scalar = quantize(scalar);
  const result = vector.map(v => op(v, scalar));
  if (result.includes(undefined)) {
    return undefined;
  }
  return {
    input: [new Vector(vector.map(scalarize)), scalarize(scalar)],
    expected: new Vector((result as number[]).map(scalarize)),
  };
}

/**
 * @returns array of Case for the input params with op applied
 * @param vectors array of vector params (2, 3, or 4 elements)
 * @param scalars array of scalar params
 * @param op the op to apply to each pair of vector and scalar
 * @param quantize function to quantize all values in vectors and scalars
 * @param scalarize function to convert numbers to Scalars
 */
function generateVectorScalarBinaryToVectorCases(
  vectors: number[][],
  scalars: number[],
  op: BinaryOp,
  quantize: QuantizeFunc,
  scalarize: ScalarBuilder
): Case[] {
  const cases = new Array<Case>();
  scalars.forEach(s => {
    vectors.forEach(v => {
      const c = makeVectorScalarBinaryToVectorCase(v, s, op, quantize, scalarize);
      if (c !== undefined) {
        cases.push(c);
      }
    });
  });
  return cases;
}

/**
 * @returns array of Case for the input params with op applied
 * @param scalars array of scalar params
 * @param vectors array of vector params (2, 3, or 4 elements)
 * @param op he op to apply to each pair of scalar and vector
 */
export function generateU32VectorBinaryToVectorCases(
  scalars: number[],
  vectors: number[][],
  op: BinaryOp
): Case[] {
  return generateScalarVectorBinaryToVectorCases(scalars, vectors, op, quantizeToU32, u32);
}

/**
 * @returns array of Case for the input params with op applied
 * @param vectors array of vector params (2, 3, or 4 elements)
 * @param scalars array of scalar params
 * @param op he op to apply to each pair of vector and scalar
 */
export function generateVectorU32BinaryToVectorCases(
  vectors: number[][],
  scalars: number[],
  op: BinaryOp
): Case[] {
  return generateVectorScalarBinaryToVectorCases(vectors, scalars, op, quantizeToU32, u32);
}

/**
 * @returns array of Case for the input params with op applied
 * @param scalars array of scalar params
 * @param vectors array of vector params (2, 3, or 4 elements)
 * @param op he op to apply to each pair of scalar and vector
 */
export function generateI32VectorBinaryToVectorCases(
  scalars: number[],
  vectors: number[][],
  op: BinaryOp
): Case[] {
  return generateScalarVectorBinaryToVectorCases(scalars, vectors, op, quantizeToI32, i32);
}

/**
 * @returns array of Case for the input params with op applied
 * @param vectors array of vector params (2, 3, or 4 elements)
 * @param scalars array of scalar params
 * @param op he op to apply to each pair of vector and scalar
 */
export function generateVectorI32BinaryToVectorCases(
  vectors: number[][],
  scalars: number[],
  op: BinaryOp
): Case[] {
  return generateVectorScalarBinaryToVectorCases(vectors, scalars, op, quantizeToI32, i32);
}
