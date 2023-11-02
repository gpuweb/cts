import { globalTestConfig } from '../../../../common/framework/test_config.js';
import { ROArrayArray } from '../../../../common/util/types.js';
import { assert, objectEquals, unreachable } from '../../../../common/util/util.js';
import { GPUTest } from '../../../gpu_test.js';
import { compare, Comparator, ComparatorImpl } from '../../../util/compare.js';
import { kValue } from '../../../util/constants.js';
import {
  ScalarType,
  Scalar,
  Type,
  TypeVec,
  TypeU32,
  Value,
  Vector,
  VectorType,
  u32,
  i32,
  Matrix,
  MatrixType,
  ScalarBuilder,
  scalarTypeOf,
} from '../../../util/conversion.js';
import { FPInterval } from '../../../util/floating_point.js';
import {
  cartesianProduct,
  QuantizeFunc,
  quantizeToI32,
  quantizeToU32,
} from '../../../util/math.js';

export type Expectation =
  | Value
  | FPInterval
  | readonly FPInterval[]
  | ROArrayArray<FPInterval>
  | Comparator;

/** @returns if this Expectation actually a Comparator */
export function isComparator(e: Expectation): e is Comparator {
  return !(
    e instanceof FPInterval ||
    e instanceof Scalar ||
    e instanceof Vector ||
    e instanceof Matrix ||
    e instanceof Array
  );
}

/** @returns the input if it is already a Comparator, otherwise wraps it in a 'value' comparator */
export function toComparator(input: Expectation): Comparator {
  if (isComparator(input)) {
    return input;
  }

  return { compare: got => compare(got, input as Value), kind: 'value' };
}

/** Case is a single expression test case. */
export type Case = {
  // The input value(s)
  input: Value | ReadonlyArray<Value>;
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

/** Just constant input source */
export const onlyConstInputSource: InputSource[] = ['const'];

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
  // AbstractFloats are passed out of the shader via a struct of 2x u32s and
  // unpacking containers as arrays
  if (scalarTypeOf(ty).kind === 'abstract-float') {
    if (ty instanceof ScalarType) {
      return 16;
    }
    if (ty instanceof VectorType) {
      if (ty.width === 2) {
        return 16;
      }
      // vec3s have padding to make them the same size as vec4s
      return 32;
    }
    if (ty instanceof MatrixType) {
      switch (ty.cols) {
        case 2:
          switch (ty.rows) {
            case 2:
              return 32;
            case 3:
              return 64;
            case 4:
              return 64;
          }
          break;
        case 3:
          switch (ty.rows) {
            case 2:
              return 48;
            case 3:
              return 96;
            case 4:
              return 96;
          }
          break;
        case 4:
          switch (ty.rows) {
            case 2:
              return 64;
            case 3:
              return 128;
            case 4:
              return 128;
          }
          break;
      }
    }
    unreachable(`AbstractFloats have not yet been implemented for ${ty.toString()}`);
  }

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
    assert(ty.kind !== 'f64', `No storage type defined for 'f64' values`);
    assert(
      ty.kind !== 'abstract-float',
      `Custom handling is implemented for 'abstract-float' values`
    );
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
    assert(ty.kind !== 'abstract-float', `AbstractFloat values should not be in input storage`);
    assert(ty.kind !== 'f64', `'No storage type defined for 'f64' values`);
    if (ty.kind === 'bool') {
      return `${expr} != 0u`;
    }
  }
  if (ty instanceof VectorType) {
    assert(
      ty.elementType.kind !== 'abstract-float',
      `AbstractFloat values cannot appear in input storage`
    );
    assert(ty.elementType.kind !== 'f64', `'No storage type defined for 'f64' values`);
    if (ty.elementType.kind === 'bool') {
      return `${expr} != vec${ty.width}<u32>(0u)`;
    }
  }
  return expr;
}

// Helper for converting a value of the type 'ty' to the storage type.
function toStorage(ty: Type, expr: string): string {
  if (ty instanceof ScalarType) {
    assert(
      ty.kind !== 'abstract-float',
      `AbstractFloat values have custom code for writing to storage`
    );
    assert(ty.kind !== 'f64', `No storage type defined for 'f64' values`);
    if (ty.kind === 'bool') {
      return `select(0u, 1u, ${expr})`;
    }
  }
  if (ty instanceof VectorType) {
    assert(
      ty.elementType.kind !== 'abstract-float',
      `AbstractFloat values have custom code for writing to storage`
    );
    assert(ty.elementType.kind !== 'f64', `'No storage type defined for 'f64' values`);
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
 * `create` if the entry was not found.
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
 * @param batch_size override the calculated casesPerBatch.
 */
export async function run(
  t: GPUTest,
  shaderBuilder: ShaderBuilder,
  parameterTypes: Array<Type>,
  resultType: Type,
  cfg: Config = { inputSource: 'storage_r' },
  cases: CaseList,
  batch_size?: number
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
    if (batch_size) {
      return batch_size;
    }
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

  // Submit all the cases in batches, rate-limiting to ensure not too many
  // batches are in flight simultaneously.
  const maxBatchesInFlight = 5;
  let batchesInFlight = 0;
  let resolvePromiseBlockingBatch: (() => void) | undefined = undefined;
  const batchFinishedCallback = () => {
    batchesInFlight -= 1;
    // If there is any batch waiting on a previous batch to finish,
    // unblock it now, and clear the resolve callback.
    if (resolvePromiseBlockingBatch) {
      resolvePromiseBlockingBatch();
      resolvePromiseBlockingBatch = undefined;
    }
  };

  const processBatch = async (batchCases: CaseList) => {
    const checkBatch = await submitBatch(
      t,
      shaderBuilder,
      parameterTypes,
      resultType,
      batchCases,
      cfg.inputSource,
      pipelineCache
    );
    checkBatch();
    void t.queue.onSubmittedWorkDone().finally(batchFinishedCallback);
  };

  const pendingBatches = [];

  for (let i = 0; i < cases.length; i += casesPerBatch) {
    const batchCases = cases.slice(i, Math.min(i + casesPerBatch, cases.length));

    if (batchesInFlight > maxBatchesInFlight) {
      await new Promise<void>(resolve => {
        // There should only be one batch waiting at a time.
        assert(resolvePromiseBlockingBatch === undefined);
        resolvePromiseBlockingBatch = resolve;
      });
    }
    batchesInFlight += 1;

    pendingBatches.push(processBatch(batchCases));
  }

  await Promise.all(pendingBatches);
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
async function submitBatch(
  t: GPUTest,
  shaderBuilder: ShaderBuilder,
  parameterTypes: Array<Type>,
  resultType: Type,
  cases: CaseList,
  inputSource: InputSource,
  pipelineCache: PipelineCache
): Promise<() => void> {
  // Construct a buffer to hold the results of the expression tests
  const outputBufferSize = cases.length * valueStride(resultType);
  const outputBuffer = t.device.createBuffer({
    size: outputBufferSize,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
  });

  const [pipeline, group] = await buildPipeline(
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
        const cmp = toComparator(c.expected).compare(got);
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
 * map is a helper for returning a new array with each element of `v`
 * transformed with `fn`.
 * If `v` is not an array, then `fn` is called with (v, 0).
 */
function map<T, U>(v: T | readonly T[], fn: (value: T, index?: number) => U): U[] {
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
  let output_struct = undefined;
  if (scalarTypeOf(resultType).kind !== 'abstract-float') {
    output_struct = `
struct Output {
  @size(${valueStride(resultType)}) value : ${storageType(resultType)}
};`;
  } else {
    if (resultType instanceof ScalarType) {
      output_struct = `struct AF {
  low: u32,
  high: u32,
};

struct Output {
  @size(${valueStride(resultType)}) value: AF,
};`;
    }
    if (resultType instanceof VectorType) {
      const dim = resultType.width;
      output_struct = `struct AF {
  low: u32,
  high: u32,
};

struct Output {
  @size(${valueStride(resultType)}) value: array<AF, ${dim}>,
};`;
    }

    if (resultType instanceof MatrixType) {
      const cols = resultType.cols;
      const rows = resultType.rows === 2 ? 2 : 4; // 3 element rows have a padding element
      output_struct = `struct AF {
  low: u32,
  high: u32,
};

struct Output {
   @size(${valueStride(resultType)}) value: array<array<AF, ${rows}>, ${cols}>,
};`;
    }

    assert(output_struct !== undefined, `No implementation for result type '${resultType}'`);
  }

  return `${output_struct}
@group(0) @binding(0) var<storage, read_write> outputs : array<Output, ${count}>;
`;
}

/**
 * Helper that returns the WGSL to declare the values array for a shader
 */
function wgslValuesArray(
  parameterTypes: Array<Type>,
  resultType: Type,
  cases: CaseList,
  expressionBuilder: ExpressionBuilder
): string {
  return `
const values = array(
  ${cases.map(c => expressionBuilder(map(c.input, v => v.wgsl()))).join(',\n  ')}
);`;
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
 * Helper that returns the WGSL header before any other declaration, currently include f16
 * enable directive if necessary.
 */
function wgslHeader(parameterTypes: Array<Type>, resultType: Type) {
  const usedF16 =
    scalarTypeOf(resultType).kind === 'f16' ||
    parameterTypes.some((ty: Type) => scalarTypeOf(ty).kind === 'f16');
  const header = usedF16 ? 'enable f16;\n' : '';
  return header;
}

/**
 * ExpressionBuilder returns the WGSL used to evaluate an expression with the
 * given input values.
 */
export type ExpressionBuilder = (values: ReadonlyArray<string>) => string;

/**
 * Returns a ShaderBuilder that builds a basic expression test shader.
 * @param expressionBuilder the expression builder
 */
function basicExpressionShaderBody(
  expressionBuilder: ExpressionBuilder,
  parameterTypes: Array<Type>,
  resultType: Type,
  cases: CaseList,
  inputSource: InputSource
): string {
  assert(
    scalarTypeOf(resultType).kind !== 'abstract-float',
    `abstractFloatShaderBuilder should be used when result type is 'abstract-float`
  );
  if (inputSource === 'const') {
    //////////////////////////////////////////////////////////////////////////
    // Constant eval
    //////////////////////////////////////////////////////////////////////////
    let body = '';
    if (parameterTypes.some(ty => scalarTypeOf(ty).kind === 'abstract-float')) {
      // Directly assign the expression to the output, to avoid an
      // intermediate store, which will concretize the value early
      body = cases
        .map(
          (c, i) =>
            `  outputs[${i}].value = ${toStorage(
              resultType,
              expressionBuilder(map(c.input, v => v.wgsl()))
            )};`
        )
        .join('\n  ');
    } else if (globalTestConfig.unrollConstEvalLoops) {
      body = cases
        .map((_, i) => {
          const value = `values[${i}]`;
          return `  outputs[${i}].value = ${toStorage(resultType, value)};`;
        })
        .join('\n  ');
    } else {
      body = `
  for (var i = 0u; i < ${cases.length}; i++) {
    outputs[i].value = ${toStorage(resultType, `values[i]`)};
  }`;
    }

    return `
${wgslOutputs(resultType, cases.length)}

${wgslValuesArray(parameterTypes, resultType, cases, expressionBuilder)}

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
}

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
    return `\
${wgslHeader(parameterTypes, resultType)}

${basicExpressionShaderBody(expressionBuilder, parameterTypes, resultType, cases, inputSource)}`;
  };
}

/**
 * Returns a ShaderBuilder that builds a basic expression test shader with given predeclaration
 * string goes after WGSL header (i.e. enable directives) if any but before anything else.
 * @param expressionBuilder the expression builder
 * @param predeclaration the predeclaration string
 */
export function basicExpressionWithPredeclarationBuilder(
  expressionBuilder: ExpressionBuilder,
  predeclaration: string
): ShaderBuilder {
  return (
    parameterTypes: Array<Type>,
    resultType: Type,
    cases: CaseList,
    inputSource: InputSource
  ) => {
    return `\
${wgslHeader(parameterTypes, resultType)}

${predeclaration}

${basicExpressionShaderBody(expressionBuilder, parameterTypes, resultType, cases, inputSource)}`;
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
${wgslHeader(parameterTypes, resultType)}
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
${wgslHeader(parameterTypes, resultType)}
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
 * @returns a string that extracts the value of an AbstractFloat into an output
 *          destination
 * @param expr expression for an AbstractFloat value, if working with vectors or
 *             matrices, this string needs to include indexing into the
 *             container.
 * @param case_idx index in the case output array to assign the result
 * @param accessor string representing how access to the AF that needs to be
 *                 operated on.
 *                 For scalars this should be left as ''.
 *                 For vectors this will be an indexing operation,
 *                 i.e. '[i]'
 *                 For matrices this will double indexing operation,
 *                 i.e. '[c][r]'
 */
function abstractFloatSnippet(expr: string, case_idx: number, accessor: string = ''): string {
  // AbstractFloats are f64s under the hood. WebGPU does not support
  // putting f64s in buffers, so the result needs to be split up into u32s
  // and rebuilt in the test framework.
  //
  // Since there is no 64-bit data type that can be used as an element for a
  // vector or a matrix in WGSL, the testing framework needs to pass the u32s
  // via a struct with two u32s, and deconstruct vectors and matrices into
  // arrays.
  //
  // This is complicated by the fact that user defined functions cannot
  // take/return AbstractFloats, and AbstractFloats cannot be stored in
  // variables, so the code cannot just inject a simple utility function
  // at the top of the shader, instead this snippet needs to be inlined
  // everywhere the test needs to return an AbstractFloat.
  //
  // select is used below, since ifs are not available during constant
  // eval. This has the side effect of short-circuiting doesn't occur, so
  // both sides of the select have to evaluate and be valid.
  //
  // This snippet implements FTZ for subnormals to bypass the need for
  // complex subnormal specific logic.
  //
  // Expressions resulting in subnormals can still be reasonably tested,
  // since this snippet will return 0 with the correct sign, which is
  // always in the acceptance interval for a subnormal result, since an
  // implementation may FTZ.
  //
  // Documentation for the snippet working with scalar results is included here
  // in this code block, since shader length affects compilation time
  // significantly on some backends. The code for vectors and matrices basically
  // the same thing, with extra indexing operations.
  //
  // Snippet with documentation:
  //   const kExponentBias = 1022;
  //
  //   // Detect if the value is zero or subnormal, so that FTZ behaviour
  //   // can occur
  //   const subnormal_or_zero : bool = (${expr} <= ${kValue.f64.positive.subnormal.max}) && (${expr} >= ${kValue.f64.negative.subnormal.min});
  //
  //   // MSB of the upper u32 is 1 if the value is negative, otherwise 0
  //   // Extract the sign bit early, so that abs() can be used with
  //   // frexp() so negative cases do not need to be handled
  //   const sign_bit : u32 = select(0, 0x80000000, ${expr} < 0);
  //
  //   // Use frexp() to obtain the exponent and fractional parts, and
  //   // then perform FTZ if needed
  //   const f = frexp(abs(${expr}));
  //   const f_fract = select(f.fract, 0, subnormal_or_zero);
  //   const f_exp = select(f.exp, -kExponentBias, subnormal_or_zero);
  //
  //   // Adjust for the exponent bias and shift for storing in bits
  //   // [20..31] of the upper u32
  //   const exponent_bits : u32 = (f_exp + kExponentBias) << 20;
  //
  //   // Extract the portion of the mantissa that appears in upper u32 as
  //   // a float for later use
  //   const high_mantissa = ldexp(f_fract, 21);
  //
  //   // Extract the portion of the mantissa that appears in upper u32 as
  //   // as bits. This value is masked, because normals will explicitly
  //   // have the implicit leading 1 that should not be in the final
  //   // result.
  //   const high_mantissa_bits : u32 = u32(ldexp(f_fract, 21)) & 0x000fffff;
  //
  //   // Calculate the mantissa stored in the lower u32 as a float
  //   const low_mantissa = f_fract - ldexp(floor(high_mantissa), -21);
  //
  //   // Convert the lower u32 mantissa to bits
  //   const low_mantissa_bits = u32(ldexp(low_mantissa, 53));
  //
  //   outputs[${i}].value.high = sign_bit | exponent_bits | high_mantissa_bits;
  //   outputs[${i}].value.low = low_mantissa_bits;
  // prettier-ignore
  return `  {
    const kExponentBias = 1022;
    const subnormal_or_zero : bool = (${expr}${accessor} <= ${kValue.f64.positive.subnormal.max}) && (${expr}${accessor} >= ${kValue.f64.negative.subnormal.min});
    const sign_bit : u32 = select(0, 0x80000000, ${expr}${accessor} < 0);
    const f = frexp(abs(${expr}${accessor}));
    const f_fract = select(f.fract, 0, subnormal_or_zero);
    const f_exp = select(f.exp, -kExponentBias, subnormal_or_zero);
    const exponent_bits : u32 = (f_exp + kExponentBias) << 20;
    const high_mantissa = ldexp(f_fract, 21);
    const high_mantissa_bits : u32 = u32(ldexp(f_fract, 21)) & 0x000fffff;
    const low_mantissa = f_fract - ldexp(floor(high_mantissa), -21);
    const low_mantissa_bits = u32(ldexp(low_mantissa, 53));
    outputs[${case_idx}].value${accessor}.high = sign_bit | exponent_bits | high_mantissa_bits;
    outputs[${case_idx}].value${accessor}.low = low_mantissa_bits;
  }`;
}

/** @returns a string for a specific case that has a AbstractFloat result */
function abstractFloatCaseBody(expr: string, resultType: Type, i: number): string {
  if (resultType instanceof ScalarType) {
    return abstractFloatSnippet(expr, i);
  }

  if (resultType instanceof VectorType) {
    return [...Array(resultType.width).keys()]
      .map(idx => abstractFloatSnippet(expr, i, `[${idx}]`))
      .join('  \n');
  }

  if (resultType instanceof MatrixType) {
    const cols = resultType.cols;
    const rows = resultType.rows;
    const results: String[] = [...Array(cols * rows)];

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        results[c * rows + r] = abstractFloatSnippet(expr, i, `[${c}][${r}]`);
      }
    }

    return results.join('  \n');
  }

  unreachable(`Results of type '${resultType}' not yet implemented`);
}

/**
 * @returns a ShaderBuilder that builds a test shader hands AbstractFloat results.
 * @param expressionBuilder an expression builder that will return AbstractFloats
 */
export function abstractFloatShaderBuilder(expressionBuilder: ExpressionBuilder): ShaderBuilder {
  return (
    parameterTypes: Array<Type>,
    resultType: Type,
    cases: CaseList,
    inputSource: InputSource
  ) => {
    assert(inputSource === 'const', 'AbstractFloat results are only defined for const-eval');
    assert(
      scalarTypeOf(resultType).kind === 'abstract-float',
      `Expected resultType of 'abstract-float', received '${scalarTypeOf(resultType).kind}' instead`
    );

    const body = cases
      .map((c, i) => {
        const expr = `${expressionBuilder(map(c.input, v => v.wgsl()))}`;
        return abstractFloatCaseBody(expr, resultType, i);
      })
      .join('\n  ');

    return `
${wgslHeader(parameterTypes, resultType)}

${wgslOutputs(resultType, cases.length)}

@compute @workgroup_size(1)
fn main() {
${body}
}`;
  };
}

/**
 * Constructs and returns a GPUComputePipeline and GPUBindGroup for running a
 * batch of test cases. If a pre-created pipeline can be found in
 * `pipelineCache`, then this may be returned instead of creating a new
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
async function buildPipeline(
  t: GPUTest,
  shaderBuilder: ShaderBuilder,
  parameterTypes: Array<Type>,
  resultType: Type,
  cases: CaseList,
  inputSource: InputSource,
  outputBuffer: GPUBuffer,
  pipelineCache: PipelineCache
): Promise<[GPUComputePipeline, GPUBindGroup]> {
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
      const pipeline = await t.device.createComputePipelineAsync({
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
    const cmp_impls = new Array<ComparatorImpl>(vectorWidth);
    for (let i = 0; i < vectorWidth; i++) {
      cmp_impls[i] = toComparator(cases[clampCaseIdx(caseIdx + i)].expected).compare;
    }
    const comparators: Comparator = {
      compare: (got: Value) => {
        let matched = true;
        const gElements = new Array<string>(vectorWidth);
        const eElements = new Array<string>(vectorWidth);
        for (let i = 0; i < vectorWidth; i++) {
          const d = cmp_impls[i]((got as Vector).elements[i]);
          matched = matched && d.matched;
          gElements[i] = d.got;
          eElements[i] = d.expected;
        }
        return {
          matched,
          got: `${packedResultType}(${gElements.join(', ')})`,
          expected: `${packedResultType}(${eElements.join(', ')})`,
        };
      },
      kind: 'packed',
    };

    // Append the new packed case
    packedCases.push({ input: packedInputs, expected: comparators });
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
  | 'finite' // Expected to be finite in the interval numeric space
  | 'unfiltered'; // No expectations

/**
 * A function that performs a binary operation on x and y, and returns the expected
 * result.
 */
export interface BinaryOp {
  (x: number, y: number): number | undefined;
}

/**
 * @returns array of Case for the input params with op applied
 * @param param0s array of inputs to try for the first param
 * @param param1s array of inputs to try for the second param
 * @param op callback called on each pair of inputs to produce each case
 * @param quantize function to quantize all values
 * @param scalarize function to convert numbers to Scalars
 */
function generateScalarBinaryToScalarCases(
  param0s: readonly number[],
  param1s: readonly number[],
  op: BinaryOp,
  quantize: QuantizeFunc,
  scalarize: ScalarBuilder
): Case[] {
  param0s = param0s.map(quantize);
  param1s = param1s.map(quantize);
  return cartesianProduct(param0s, param1s).reduce((cases, e) => {
    const expected = op(e[0], e[1]);
    if (expected !== undefined) {
      cases.push({ input: [scalarize(e[0]), scalarize(e[1])], expected: scalarize(expected) });
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
export function generateBinaryToI32Cases(
  param0s: readonly number[],
  param1s: readonly number[],
  op: BinaryOp
) {
  return generateScalarBinaryToScalarCases(param0s, param1s, op, quantizeToI32, i32);
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param param0s array of inputs to try for the first param
 * @param param1s array of inputs to try for the second param
 * @param op callback called on each pair of inputs to produce each case
 */
export function generateBinaryToU32Cases(
  param0s: readonly number[],
  param1s: readonly number[],
  op: BinaryOp
) {
  return generateScalarBinaryToScalarCases(param0s, param1s, op, quantizeToU32, u32);
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
  vector: readonly number[],
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
    expected: new Vector((result as readonly number[]).map(scalarize)),
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
  scalars: readonly number[],
  vectors: ROArrayArray<number>,
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
  vector: readonly number[],
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
    expected: new Vector((result as readonly number[]).map(scalarize)),
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
  vectors: ROArrayArray<number>,
  scalars: readonly number[],
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
  scalars: readonly number[],
  vectors: ROArrayArray<number>,
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
  vectors: ROArrayArray<number>,
  scalars: readonly number[],
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
  scalars: readonly number[],
  vectors: ROArrayArray<number>,
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
  vectors: ROArrayArray<number>,
  scalars: readonly number[],
  op: BinaryOp
): Case[] {
  return generateVectorScalarBinaryToVectorCases(vectors, scalars, op, quantizeToI32, i32);
}
