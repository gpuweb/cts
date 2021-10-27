export const description = `WGSL execution test. Section: Value-testing built-in functions`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import {
  assert,
  TypedArrayBufferView,
  TypedArrayBufferViewConstructor,
} from '../../../../common/util/util.js';
//import { checkElementsEqual } from '../../../util/check_contents.js';
import { GPUTest } from '../../../gpu_test.js';
import { NumberType } from '../../../util/conversion.js';

import { Case } from './builtin.js';

/**
 * Runs a test for a unary builtin function that takes a single floating
 * argument and returns a boolean or boolean vector of the same shape.
 *
 * The result is checked for equality.
 */
export function runValueCheckTest<F extends NumberType>(
  t: GPUTest,
  type: string, // e.g. f32 or a vector of f32
  arrayLength: number, // Vector length. 1 for scalar
  builtin: string, // e.g. 'isInf'
  arrayType: TypedArrayBufferViewConstructor,
  cases: Array<Case<F>>
): void {
  // Each case expands to 16 bytes, filling out to a scalar or vector
  // value, and padded with zeroes.
  const source = `
    [[block]]
    struct Data {
      values : [[stride(16)]] array<${type}, ${cases.length}>;
    };

    [[group(0), binding(0)]] var<storage> inputs : Data;
    // bool is not host-shareable, so use 1.0 for true, and 0.0 for false.
    [[group(0), binding(1)]] var<storage, write> outputs : Data;

    let zeroes = ${type}(0.0);
    let ones = ${type}(1.0);

    [[stage(compute), workgroup_size(1)]]
    fn main() {
      for(var i = 0; i < ${cases.length}; i = i + 1) {
        let input = inputs.values[i];
        // Remap boolean false and true to 0.0 and 1.0
        outputs.values[i] = select(zeroes, ones, ${builtin}(input));
      }
    }
  `;

  const inputData: TypedArrayBufferView = new arrayType(cases.length * 4);
  const expectedData: TypedArrayBufferView = new arrayType(cases.length * 4);

  // Fill inputData and expectedData, such that:
  // - element '4 * chunk' holds values from case 'chunk'
  // - elemements immediately after '4 * chunk', filling out the target type size,
  //   hold data from immediately following cases.
  for (const i of inputData.keys()) {
    const component = i & 3;
    const chunk = (i - component) / 4;
    assert(chunk < cases.length);
    // Only fill in values used by the type.
    if (component < arrayLength) {
      const case_index = chunk + component < cases.length ? chunk + component : chunk;
      inputData[i] = cases[case_index].input.value as number;
      expectedData[i] = cases[case_index].expected[0].value as number;
    }
  }

  const inputBuffer = t.makeBufferWithContents(
    inputData,
    GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE
  );

  const outputBuffer = t.device.createBuffer({
    size: inputData.length * inputData.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
  });

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

  t.expectGPUBufferValuesEqual(outputBuffer, expectedData);
}

export const g = makeTestGroup(GPUTest);

g.test('value_testing_builtin_functions,isNan')
  .uniqueId('fdd1e7105af70b74')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#value-testing-builtin-functions')
  .desc(
    `
isNan:
I is f32 or vecN<f32> T is bool if I is a scalar, or vecN<bool> if I is a vector isNan(e: I ) -> T Test for NaN according to IEEE-754. Component-wise when I is a vector. (OpIsNan)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('value_testing_builtin_functions,isFinite')
  .uniqueId('bf8ee3764330ceb4')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#value-testing-builtin-functions')
  .desc(
    `
isFinite:
isFinite(e: I ) -> T Test a finite value according to IEEE-754. Component-wise when I is a vector.

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('value_testing_builtin_functions,isNormal')
  .uniqueId('ea51009a88a27a15')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#value-testing-builtin-functions')
  .desc(
    `
isNormal:
isNormal(e: I ) -> T Test a normal value according to IEEE-754. Component-wise when I is a vector.

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('value_testing_builtin_functions,runtime_sized_array_length')
  .uniqueId('8089b54fa4eeaa0b')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#value-testing-builtin-functions')
  .desc(
    `
runtime-sized array length:
e: ptr<storage,array<T>> arrayLength(e): u32 Returns the number of elements in the runtime-sized array. (OpArrayLength, but the implementation has to trace back to get the pointer to the enclosing struct.)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();
