/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/import { keysOf } from '../../../../../common/util/data_tables.js';import { kLimitBaseParams, kLimitValueTestKeys, makeLimitTestGroup } from './limit_utils.js';

const BufferParts = {
  wholeBuffer: true,
  biggerBufferWithOffset: true
};

const kBufferPartsKeys = keysOf(BufferParts);

function getSizeAndOffsetForBufferPart(device, bufferPart, size) {
  const align = device.limits.minUniformBufferOffsetAlignment;
  switch (bufferPart) {
    case 'wholeBuffer':
      return { offset: 0, size };
    case 'biggerBufferWithOffset':
      return { size: size + align, offset: align };}

}

const limit = 'maxUniformBufferBindingSize';
export const { g, description } = makeLimitTestGroup(limit);

g.test('createBindGroup,at_over').
desc(`Test using at and over ${limit} limit`).
params(kLimitBaseParams.combine('bufferPart', kBufferPartsKeys)).
fn(async (t) => {
  const { limitTest, testValueName, bufferPart } = t.params;
  await t.testDeviceWithRequestedLimits(
  limitTest,
  testValueName,
  async ({ device, testValue, shouldError }) => {
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {}
      }]

    });

    const { size, offset } = getSizeAndOffsetForBufferPart(device, bufferPart, testValue);
    device.pushErrorScope('out-of-memory');
    const uniformBuffer = t.trackForCleanup(
    device.createBuffer({
      usage: GPUBufferUsage.UNIFORM,
      size
    }));

    const outOfMemoryError = await device.popErrorScope();

    if (!outOfMemoryError) {
      await t.expectValidationError(() => {
        device.createBindGroup({
          layout: bindGroupLayout,
          entries: [
          {
            binding: 0,
            resource: {
              buffer: uniformBuffer,
              offset,
              size: testValue
            }
          }]

        });
      }, shouldError);
    }
  });

});

g.test('validate,maxBufferSize').
desc(`Test that ${limit} <= maxBufferSize`).
params((u) => u.combine('limitTest', kLimitValueTestKeys)).
fn(async (t) => {
  const { limitTest } = t.params;
  await t.testDeviceWithRequestedLimits(limitTest, 'atLimit', ({ device, actualLimit }) => {
    t.expect(actualLimit <= device.limits.maxBufferSize);
  });
});
//# sourceMappingURL=maxUniformBufferBindingSize.spec.js.map