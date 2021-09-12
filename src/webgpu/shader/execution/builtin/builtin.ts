import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { TypedArrayBufferView, assert } from '../../../../common/util/util.js';
import { GPUTest } from '../../../gpu_test.js';
import {
  float32ToInt32,
  float32ToUint32,
  uint32ToFloat32,
  uint32ToInt32,
} from '../../../util/conversion.js';
import { ScalarType } from '../../types.js';

export const g = makeTestGroup(GPUTest);

export enum NumberType {
  Float,
  Int,
  Uint,
  Hex,
}

export type Case = {
  input: number;
  expected: Array<number>;
  numberType: NumberType;
};
type Cases = Array<Case>;

export function createInputBuffer(
  baseType: ScalarType,
  cases: Cases,
  length: number
): TypedArrayBufferView {
  let inputData: TypedArrayBufferView;
  switch (baseType) {
    case 'f32':
      inputData = new Float32Array(4 * cases.length);
      break;
    case 'u32':
      inputData = new Uint32Array(4 * cases.length);
      break;
    case 'i32':
      inputData = new Int32Array(4 * cases.length);
      break;
    default:
      assert(false, 'unimplemented input scalar type');
      break;
  }
  for (let i = 0; i < cases.length; i++) {
    for (let j = 0; j < length; j++) {
      switch (cases[i].numberType) {
        case NumberType.Hex:
          switch (baseType) {
            case 'f32':
              inputData[i * 4 + j] = uint32ToFloat32(cases[i].input);
              break;
            case 'i32':
              inputData[i * 4 + j] = uint32ToInt32(cases[i].input);
              break;
            case 'u32':
              inputData[i * 4 + j] = cases[i].input;
              break;
            default:
              assert(false, 'unimplemented input scalar type');
              break;
          }
          break;
        case NumberType.Uint:
          assert(
            baseType === 'u32',
            "incompatible number type and baseType: 'Uint' and '" + baseType.toString()
          );
          inputData[i * 4 + j] = cases[i].input;
          break;
        case NumberType.Int:
          assert(
            baseType === 'i32',
            "incompatible number type and baseType: 'Int' and '" + baseType.toString()
          );
          inputData[i * 4 + j] = cases[i].input;
          break;
        case NumberType.Float:
          assert(
            baseType === 'f32',
            "incompatible number type and baseType: 'Float' and '" + baseType.toString()
          );
          inputData[i * 4 + j] = cases[i].input;
          break;
      }
    }
  }
  return inputData;
}

export function submitComputeShader(
  source: string,
  t: GPUTest,
  inputData: TypedArrayBufferView
): GPUBuffer {
  const inputBuffer = t.makeBufferWithContents(
    inputData,
    GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
  );

  const outputBuffer = t.makeBufferWithContents(
    new Float32Array(inputData.length),
    GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
  );

  const module = t.device.createShaderModule({ code: source });
  const pipeline = t.device.createComputePipeline({
    compute: { module, entryPoint: 'main' },
  });

  const group = t.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: inputBuffer } },
      { binding: 1, resource: { buffer: outputBuffer } },
    ],
  });

  const encoder = t.device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, group);
  pass.dispatch(1);
  pass.endPass();

  t.queue.submit([encoder.finish()]);
  return outputBuffer;
}

export function createBuiltinCall(
  baseType: ScalarType,
  arrayLength: number,
  builtin: string,
  outputDataAsF32: Float32Array,
  inputData: TypedArrayBufferView,
  cases: Cases
): string[] {
  const errs: string[] = [];
  let inputDataAsF32: Float32Array;
  let inputDataAsU32: Uint32Array;
  let inputDataAsI32: Int32Array;
  if (baseType === 'f32') {
    inputDataAsF32 = inputData as Float32Array;
    inputDataAsI32 = new Int32Array(inputData.buffer);
    inputDataAsU32 = new Uint32Array(inputData.buffer);
  } else if (baseType === 'i32') {
    inputDataAsF32 = new Float32Array(inputData.buffer);
    inputDataAsI32 = inputData as Int32Array;
    inputDataAsU32 = new Uint32Array(inputData.buffer);
  } else if (baseType === 'u32') {
    inputDataAsF32 = new Float32Array(inputData.buffer);
    inputDataAsI32 = new Int32Array(inputData.buffer);
    inputDataAsU32 = inputData as Uint32Array;
  } else {
    errs.push('unimplemented baseType');
    return errs;
  }

  const outputDataAsU32 = new Uint32Array(outputDataAsF32.buffer);
  const outputDataAsI32 = new Int32Array(outputDataAsF32.buffer);

  for (let i = 0; i < cases.length; i++) {
    const input: string[] = [];
    const output: string[] = [];
    const expected: string[] = [];
    let matched = true;
    for (let j = 0; j < arrayLength; j++) {
      const idx = i * 4 + j;
      const caseExpected: string[] = [];
      const c = cases[i];
      for (const e of cases[i].expected) {
        const expectedDataAsU32 = c.numberType === NumberType.Float ? float32ToUint32(e) : e;
        const expectedDataAsF32 = c.numberType === NumberType.Float ? e : uint32ToFloat32(e);
        const expectedDataAsI32 =
          c.numberType === NumberType.Float ? float32ToInt32(e) : uint32ToInt32(e);

        switch (baseType) {
          case 'u32': {
            caseExpected.push(expectedDataAsU32 + ' (0x' + expectedDataAsU32.toString(16) + ')');
            if (outputDataAsU32[idx] !== expectedDataAsU32) {
              matched = false;
            }
            break;
          }
          case 'i32': {
            caseExpected.push(expectedDataAsI32 + ' (0x' + expectedDataAsU32.toString(16) + ')');
            if (outputDataAsI32[idx] !== expectedDataAsI32) {
              matched = false;
            }
            break;
          }
          case 'f32': {
            caseExpected.push(expectedDataAsF32 + ' (0x' + expectedDataAsU32.toString(16) + ')');
            if (outputDataAsF32[idx] !== expectedDataAsF32) {
              matched = false;
            }
            break;
          }
        }
      }

      switch (baseType) {
        case 'u32': {
          input.push(inputDataAsU32[idx] + ' (0x' + inputDataAsU32[idx].toString(16) + ')');
          output.push(outputDataAsU32[idx] + ' (0x' + outputDataAsU32[idx].toString(16) + ')');
          expected.push(caseExpected.join(' or '));
          break;
        }
        case 'i32': {
          input.push(inputDataAsI32[idx] + ' (0x' + inputDataAsU32[idx].toString(16) + ')');
          output.push(outputDataAsI32[idx] + ' (0x' + outputDataAsU32[idx].toString(16) + ')');
          expected.push(caseExpected.join(' or '));
          break;
        }
        case 'f32': {
          input.push(inputDataAsF32[idx] + ' (0x' + inputDataAsU32[idx].toString(16) + ')');
          output.push(outputDataAsF32[idx] + ' (0x' + outputDataAsU32[idx].toString(16) + ')');
          expected.push(caseExpected.join(' or '));
          break;
        }
      }
    }

    if (matched) {
      continue;
    }

    if (arrayLength > 1) {
      errs.push(
        `${builtin}(${baseType}(${input.join(', ')}))\n` +
          `    returned: ${baseType}(${output.join(', ')})\n` +
          `    expected: ${baseType}(${expected.join(', ')})`
      );
    } else {
      errs.push(
        `${builtin}(${input.join(', ')})\n` +
          `    returned: ${output.join(', ')}\n` +
          `    expected: ${expected.join(', ')}`
      );
    }
  }

  return errs;
}

export function runShaderTest(
  t: GPUTest,
  storageClass: string,
  storageMode: string,
  baseType: ScalarType,
  type: string,
  arrayLength: number,
  builtin: string,
  cases: Cases
): void {
  const source = `
  [[block]]
  struct Data {
    values : [[stride(16)]] array<${type}, ${cases.length}>;
  };

  [[group(0), binding(0)]] var<${storageClass}, ${storageMode}> inputs : Data;
  [[group(0), binding(1)]] var<${storageClass}, write> outputs : Data;

  [[stage(compute), workgroup_size(1)]]
  fn main() {
    for(var i = 0; i < ${cases.length}; i = i + 1) {
        let input : ${type} = inputs.values[i];
        let result : ${type} = ${builtin}(input);
        outputs.values[i] = result;
    }
  }
`;

  const inputData = createInputBuffer(baseType, cases, arrayLength);
  const outputBuffer = submitComputeShader(source, t, inputData);

  const checkExpectation = (outputDataAsF32: Float32Array) => {
    const errs = createBuiltinCall(
      baseType,
      arrayLength,
      builtin,
      outputDataAsF32,
      inputData,
      cases
    );
    if (errs.length > 0) {
      return new Error(errs.join('\n\n'));
    }
    return undefined;
  };

  t.expectGPUBufferValuesPassCheck(outputBuffer, checkExpectation, {
    type: Float32Array,
    typedLength: inputData.length,
  });
}

export const kValue = {
  // Values of power(2, n) n = {-31, ..., 31}
  pow2: {
    positive: {
      toMinus1: 0x3f00_0000,
      toMinus2: 0x3e80_0000,
      toMinus3: 0x3e00_0000,
      toMinus4: 0x3d800000,
      toMinus5: 0x3d000000,
      toMinus6: 0x3c800000,
      toMinus7: 0x3c000000,
      toMinus8: 0x3b800000,
      toMinus9: 0x3b000000,
      toMinus10: 0x3a800000,
      toMinus11: 0x3a000000,
      toMinus12: 0x39800000,
      toMinus13: 0x39000000,
      toMinus14: 0x38800000,
      toMinus15: 0x38000000,
      toMinus16: 0x37800000,
      toMinus17: 0x37000000,
      toMinus18: 0x36800000,
      toMinus19: 0x36000000,
      toMinus20: 0x35800000,
      toMinus21: 0x35000000,
      toMinus22: 0x34800000,
      toMinus23: 0x34000000,
      toMinus24: 0x33800000,
      toMinus25: 0x33000000,
      toMinus26: 0x32800000,
      toMinus27: 0x32000000,
      toMinus28: 0x31800000,
      toMinus29: 0x31000000,
      toMinus30: 0x30800000,
      toMinus31: 0x30000000,

      to0: 0x0000_0001,
      to1: 0x0000_0002,
      to2: 0x0000_0004,
      to3: 0x0000_0008,
      to4: 0x0000_0010,
      to5: 0x0000_0020,
      to6: 0x0000_0040,
      to7: 0x0000_0080,
      to8: 0x0000_0100,
      to9: 0x0000_0200,
      to10: 0x0000_0400,
      to11: 0x0000_0800,
      to12: 0x0000_1000,
      to13: 0x0000_2000,
      to14: 0x0000_4000,
      to15: 0x0000_8000,
      to16: 0x0001_0000,
      to17: 0x0002_0000,
      to18: 0x0004_0000,
      to19: 0x0008_0000,
      to20: 0x0010_0000,
      to21: 0x0020_0000,
      to22: 0x0040_0000,
      to23: 0x0080_0000,
      to24: 0x0100_0000,
      to25: 0x0200_0000,
      to26: 0x0400_0000,
      to27: 0x0800_0000,
      to28: 0x1000_0000,
      to29: 0x2000_0000,
      to30: 0x4000_0000,
      to31: 0x8000_0000,
    },

    // Values of -1 * power(2, n) n = {-31, ..., 31}
    negative: {
      toMinus1: 0xbf000000,
      toMinus2: 0xbe800000,
      toMinus3: 0xbe000000,
      toMinus4: 0xbd800000,
      toMinus5: 0xbd000000,
      toMinus6: 0xbc800000,
      toMinus7: 0xbc000000,
      toMinus8: 0xbb800000,
      toMinus9: 0xbb000000,
      toMinus10: 0xba800000,
      toMinus11: 0xba000000,
      toMinus12: 0xb9800000,
      toMinus13: 0xb9000000,
      toMinus14: 0xb8800000,
      toMinus15: 0xb8000000,
      toMinus16: 0xb7800000,
      toMinus17: 0xb7000000,
      toMinus18: 0xb6800000,
      toMinus19: 0xb6000000,
      toMinus20: 0xb5800000,
      toMinus21: 0xb5000000,
      toMinus22: 0xb4800000,
      toMinus23: 0xb4000000,
      toMinus24: 0xb3800000,
      toMinus25: 0xb3000000,
      toMinus26: 0xb2800000,
      toMinus27: 0xb2000000,
      toMinus28: 0xb1800000,
      toMinus29: 0xb1000000,
      toMinus30: 0xb0800000,
      toMinus31: 0xb0000000,

      to0: -1,
      to1: -2,
      to2: -4,
      to3: -8,
      to4: -16,
      to5: -32,
      to6: -64,
      to7: -128,
      to8: -256,
      to9: -512,
      to10: -1024,
      to11: 0xffff_f800,
      to12: 0xffff_f000,
      to13: 0xffff_e000,
      to14: 0xffff_c000,
      to15: 0xffff_8000,
      to16: 0xffff_0000,
      to17: 0xfffe_0000,
      to18: 0xfffc_0000,
      to19: 0xfff8_0000,
      to20: 0xfff0_0000,
      to21: 0xffe0_0000,
      to22: 0xffc0_0000,
      to23: 0xff80_0000,
      to24: 0xff00_0000,
      to25: 0xfe00_0000,
      to26: 0xfc00_0000,
      to27: 0xf800_0000,
      to28: 0xf000_0000,
      to29: 0xe000_0000,
      to30: 0xc000_0000,
      to31: 0x8000_0000,
    },
  },

  // Limits of signed 32 bit integer
  i32: {
    positive: {
      min: 0x0000_0000, // 0
      max: 0x7fff_ffff, // 2147483647
    },
    negative: {
      min: 0x8000_0000, // -2147483648
      max: 0x0000_0000, // 0
    },
  },

  // Limits of unsigned 32 bit integer
  u32: {
    min: 0x0000_0000,
    max: 0xffff_ffff,
  },

  // Limits of 32 bit float
  f32: {
    positive: {
      min: 0x0080_0000,
      max: 0x7f7f_ffff,
      zero: 0x0000_0000,
    },
    negative: {
      max: 0x8080_0000,
      min: 0xff7f_ffff,
      zero: 0x8000_0000,
    },
    subnormal: {
      positive: {
        min: 0x0000_0001,
        max: 0x007f_ffff,
      },
    },
    nan: {
      negative: {
        s: 0xff80_0001,
        q: 0xffc0_0001,
      },
      positive: {
        s: 0x7f80_0001,
        q: 0x7fc0_0001,
      },
    },
    infinity: {
      positive: 0x7f80_0000,
      negative: 0xff80_0000,
    },
  },
} as const;
