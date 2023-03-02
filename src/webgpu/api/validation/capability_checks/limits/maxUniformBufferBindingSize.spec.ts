import { keysOf } from '../../../../../common/util/data_tables.js';

import { LimitMode, getDefaultLimit, kLimitBaseParams, makeLimitTestGroup } from './limit_utils.js';

const BufferParts = {
  wholeBuffer: true,
  biggerBufferWithOffset: true,
};
type BufferPart = keyof typeof BufferParts;
const kBufferPartsKeys = keysOf(BufferParts);

function getSizeAndOffsetForBufferPart(device: GPUDevice, bufferPart: BufferPart, size: number) {
  const align = device.limits.minUniformBufferOffsetAlignment;
  switch (bufferPart) {
    case 'wholeBuffer':
      return { offset: 0, size };
    case 'biggerBufferWithOffset':
      return { size: size + align, offset: align };
  }
}

const limit = 'maxUniformBufferBindingSize';
export const { g, description } = makeLimitTestGroup(limit);

// We also need to update the maxBufferSize limit when testing.
const kExtraLimits = { maxBufferSize: 'maxLimit' as LimitMode };

g.test('createBindGroup,at_over')
  .desc(`Test using at and over ${limit} limit`)
  .params(kLimitBaseParams.combine('bufferPart', kBufferPartsKeys))
  .fn(async t => {
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
              buffer: {},
            },
          ],
        });

        const { size, offset } = getSizeAndOffsetForBufferPart(device, bufferPart, testValue);

        await t.expectValidationError(
          async () => {
            device.pushErrorScope('out-of-memory');
            const uniformBuffer = t.trackForCleanup(
              device.createBuffer({
                usage: GPUBufferUsage.UNIFORM,
                size,
              })
            );
            const outOfMemoryError = await device.popErrorScope();

            if (!outOfMemoryError) {
              device.createBindGroup({
                layout: bindGroupLayout,
                entries: [
                  {
                    binding: 0,
                    resource: {
                      buffer: uniformBuffer,
                      offset,
                      size: testValue,
                    },
                  },
                ],
              });
            }
          },
          shouldError || size > device.limits.maxBufferSize,
          `size: ${size}, offset: ${offset}, testValue: ${testValue}`
        );
      },
      kExtraLimits
    );
  });

g.test('validate,maxBufferSize')
  .desc(`Test that ${limit} <= maxBufferSize`)
  .fn(t => {
    const { adapter, defaultLimit, maximumLimit } = t;
    t.expect(defaultLimit <= getDefaultLimit('maxBufferSize'));
    t.expect(maximumLimit <= adapter.limits.maxBufferSize);
  });
