import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { TypedArrayBufferView } from '../../../../common/util/util.js';
import { GPUTest } from '../../../gpu_test.js';
import {
  float32ToInt32,
  float32ToUint32,
  uint32ToFloat32,
  uint32ToInt32,
} from '../../../util/conversion.js';
import { TypeInfo } from '../../types.js';

export enum NumberType {
  Float,
  Int,
  Uint,
  Hex,
}

export type Case = {
  input: number;
  expected: number[];
};

export const g = makeTestGroup(GPUTest);

type Cases = Case[];

export function createInputBuffer(
  numberType: NumberType,
  cases: Cases,
  typeInfo: TypeInfo
): TypedArrayBufferView {
  let inputData: TypedArrayBufferView;
  switch (numberType) {
    case NumberType.Float: {
      inputData = new Float32Array(4 * cases.length);
      break;
    }
    case NumberType.Hex:
    case NumberType.Uint: {
      inputData = new Uint32Array(4 * cases.length);
      break;
    }
    case NumberType.Int: {
      inputData = new Int32Array(4 * cases.length);
      break;
    }
  }
  for (let i = 0; i < cases.length; i++) {
    for (let j = 0; j < typeInfo.arrayLength; j++) {
      inputData[i * 4 + j] = cases[i].input;
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
  typeInfo: TypeInfo,
  builtin: string,
  outputDataAsF32: Float32Array,
  inputData: TypedArrayBufferView,
  cases: Cases,
  numberType: NumberType
): string[] {
  let inputDataAsF32: Float32Array;
  let inputDataAsU32: Uint32Array;
  let inputDataAsI32: Int32Array;
  if (numberType === NumberType.Float) {
    inputDataAsF32 = inputData as Float32Array;
    inputDataAsU32 = new Uint32Array(inputData.buffer);
    inputDataAsI32 = new Int32Array(inputData.buffer);
  } else {
    inputDataAsF32 = new Float32Array(inputData.buffer);
    inputDataAsU32 = inputData as Uint32Array;
    inputDataAsI32 = new Int32Array(inputData.buffer);
  }

  const outputDataAsU32 = new Uint32Array(outputDataAsF32.buffer);
  const outputDataAsI32 = new Int32Array(outputDataAsF32.buffer);

  const errs: string[] = [];
  for (let i = 0; i < cases.length; i++) {
    const input: string[] = [];
    const output: string[] = [];
    const expected: string[] = [];
    let matched = true;
    for (let j = 0; j < typeInfo.arrayLength; j++) {
      const idx = i * 4 + j;
      const caseExpected: string[] = [];
      cases[i].expected.forEach((e: number) => {
        const expectedDataAsU32 = numberType === NumberType.Float ? float32ToUint32(e) : e;
        const expectedDataAsF32 = numberType === NumberType.Float ? e : uint32ToFloat32(e);
        const expectedDataAsI32 =
          numberType === NumberType.Float ? float32ToInt32(e) : uint32ToInt32(e);

        switch (typeInfo.baseType) {
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
      });

      switch (typeInfo.baseType) {
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

    if (typeInfo.arrayLength > 1) {
      errs.push(
        `${builtin}(${typeInfo.baseType}(${input.join(', ')}))\n` +
          `    returned: ${typeInfo.baseType}(${output.join(', ')})\n` +
          `    expected: ${typeInfo.baseType}(${expected.join(', ')})`
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
