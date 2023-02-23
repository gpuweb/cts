import { keysOf } from '../../../../../common/util/data_tables.js';
import { align, roundDown } from '../../../../util/math.js';

import {
  kLimitBaseParams,
  makeLimitTestGroup,
  LimitValueTest,
  TestValue,
  kLimitValueTestKeys,
} from './limit_utils.js';

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
      return { size, offset: 0 };
    case 'biggerBufferWithOffset':
      return { size: size + align, offset: align };
  }
}

const kStorageBufferRequiredSizeAlignment = 4;

function getDeviceLimitToRequest(
  limitValueTest: LimitValueTest,
  defaultLimit: number,
  maximumLimit: number
) {
  switch (limitValueTest) {
    case 'atDefault':
      return defaultLimit;
    case 'underDefault':
      return defaultLimit - kStorageBufferRequiredSizeAlignment;
    case 'betweenDefaultAndMaximum':
      return Math.floor((defaultLimit + maximumLimit) / 2);
    case 'atMaximum':
      return maximumLimit;
    case 'overMaximum':
      return maximumLimit + kStorageBufferRequiredSizeAlignment;
  }
}

function getTestValue(testValueName: TestValue, requestedLimit: number) {
  switch (testValueName) {
    case 'atLimit':
      return roundDown(requestedLimit, kStorageBufferRequiredSizeAlignment);
    case 'overLimit':
      // Note: the requestedLimit might not meet alignment requirements.
      return align(
        requestedLimit + kStorageBufferRequiredSizeAlignment,
        kStorageBufferRequiredSizeAlignment
      );
  }
}

function getDeviceLimitToRequestAndValueToTest(
  limitValueTest: LimitValueTest,
  testValueName: TestValue,
  defaultLimit: number,
  maximumLimit: number
) {
  const requestedLimit = getDeviceLimitToRequest(limitValueTest, defaultLimit, maximumLimit);
  return {
    requestedLimit,
    testValue: getTestValue(testValueName, requestedLimit),
  };
}

const limit = 'maxStorageBufferBindingSize';
export const { g, description } = makeLimitTestGroup(limit);

g.test('createBindGroup,at_over')
  .desc(`Test using createBindGroup at and over ${limit} limit`)
  .params(kLimitBaseParams.combine('bufferPart', kBufferPartsKeys))
  .fn(async t => {
    const { limitTest, testValueName, bufferPart } = t.params;
    const { adapter, defaultLimit, maximumLimit } = await t.getAdapterAndLimits();
    const { requestedLimit, testValue } = getDeviceLimitToRequestAndValueToTest(
      limitTest,
      testValueName,
      defaultLimit,
      maximumLimit
    );

    await t.testDeviceWithSpecificLimits(
      adapter,
      requestedLimit,
      testValue,
      async ({ device, testValue, shouldError }) => {
        const bindGroupLayout = device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.COMPUTE,
              buffer: { type: 'storage' },
            },
          ],
        });

        const { size, offset } = getSizeAndOffsetForBufferPart(device, bufferPart, testValue);
        device.pushErrorScope('out-of-memory');
        const storageBuffer = t.trackForCleanup(
          device.createBuffer({
            usage: GPUBufferUsage.STORAGE,
            size,
          })
        );
        const outOfMemoryError = await device.popErrorScope();

        if (!outOfMemoryError) {
          await t.expectValidationError(
            () => {
              device.createBindGroup({
                layout: bindGroupLayout,
                entries: [
                  {
                    binding: 0,
                    resource: {
                      buffer: storageBuffer,
                      offset,
                      size: testValue,
                    },
                  },
                ],
              });
            },
            shouldError,
            `size: ${size}, offset: ${offset}, testValue: ${testValue}`
          );
        }
      }
    );
  });

g.test('validate,maxBufferSize')
  .desc(`Test that ${limit} <= maxBufferSize`)
  .params(u => u.combine('limitTest', kLimitValueTestKeys))
  .fn(async t => {
    const { limitTest } = t.params;
    const { adapter, defaultLimit, maximumLimit } = await t.getAdapterAndLimits();
    const requestedLimit = getDeviceLimitToRequest(limitTest, defaultLimit, maximumLimit);

    await t.testDeviceWithSpecificLimits(adapter, requestedLimit, 0, ({ device, actualLimit }) => {
      t.expect(actualLimit <= device.limits.maxBufferSize);
    });
  });
