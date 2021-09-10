/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import {
  float32ToInt32,
  float32ToUint32,
  uint32ToFloat32,
  uint32ToInt32,
} from '../../../util/conversion.js';

export const g = makeTestGroup(GPUTest);

export let OperandType;
(function (OperandType) {
  OperandType[(OperandType['Float'] = 0)] = 'Float';
  OperandType[(OperandType['Int'] = 1)] = 'Int';
  OperandType[(OperandType['Uint'] = 2)] = 'Uint';
  OperandType[(OperandType['Hex'] = 3)] = 'Hex';
})(OperandType || (OperandType = {}));

export function createInputBuffer(numberType, cases, length) {
  let inputData;
  switch (numberType) {
    case OperandType.Float: {
      inputData = new Float32Array(4 * cases.length);
      break;
    }
    case OperandType.Hex:
    case OperandType.Uint: {
      inputData = new Uint32Array(4 * cases.length);
      break;
    }
    case OperandType.Int: {
      inputData = new Int32Array(4 * cases.length);
      break;
    }
  }

  for (let i = 0; i < cases.length; i++) {
    for (let j = 0; j < length; j++) {
      inputData[i * 4 + j] = cases[i].input;
    }
  }
  return inputData;
}

export function submitComputeShader(source, t, inputData) {
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
  baseType,
  arrayLength,
  builtin,
  outputDataAsF32,
  inputData,
  cases,
  numberType
) {
  let inputDataAsF32;
  let inputDataAsU32;
  let inputDataAsI32;
  if (numberType === OperandType.Float) {
    inputDataAsF32 = inputData;
    inputDataAsU32 = new Uint32Array(inputData.buffer);
    inputDataAsI32 = new Int32Array(inputData.buffer);
  } else {
    inputDataAsF32 = new Float32Array(inputData.buffer);
    inputDataAsU32 = inputData;
    inputDataAsI32 = new Int32Array(inputData.buffer);
  }

  const outputDataAsU32 = new Uint32Array(outputDataAsF32.buffer);
  const outputDataAsI32 = new Int32Array(outputDataAsF32.buffer);

  const errs = [];
  for (let i = 0; i < cases.length; i++) {
    const input = [];
    const output = [];
    const expected = [];
    let matched = true;
    for (let j = 0; j < arrayLength; j++) {
      const idx = i * 4 + j;
      const caseExpected = [];
      for (const e of cases[i].expected) {
        const expectedDataAsU32 = numberType === OperandType.Float ? float32ToUint32(e) : e;
        const expectedDataAsF32 = numberType === OperandType.Float ? e : uint32ToFloat32(e);
        const expectedDataAsI32 =
          numberType === OperandType.Float ? float32ToInt32(e) : uint32ToInt32(e);

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
  t,
  storageClass,
  storageMode,
  baseType,
  type,
  arrayLength,
  builtin,
  numberType,
  cases
) {
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

  const inputData = createInputBuffer(numberType, cases, arrayLength);
  const outputBuffer = submitComputeShader(source, t, inputData);

  const checkExpectation = outputDataAsF32 => {
    const errs = createBuiltinCall(
      baseType,
      arrayLength,
      builtin,
      outputDataAsF32,
      inputData,
      cases,
      numberType
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
