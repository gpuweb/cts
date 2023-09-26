import { GPUTestBase } from '../../../../gpu_test.js';

import {
  kMaximumLimitBaseParams,
  MaximumLimitValueTest,
  MaximumTestValue,
  makeLimitTestGroup,
} from './limit_utils.js';

/**
 * Given a 3 dimensional size, and a limit, compute
 * the smallest volume with more then limit units.
 */
function getClosestSizeOverLimit(size: number[], limit: number) {
  let closest = Number.MAX_SAFE_INTEGER;
  let closestSize: number[] = [];
  const depthLimit = Math.min(limit, size[2]);
  for (let depth = 1; depth <= depthLimit; ++depth) {
    for (let height = 1; height <= size[1]; ++height) {
      const planeSize = depth * height;
      if (planeSize <= limit) {
        const width = Math.min(size[0], Math.ceil(limit / planeSize));
        const num = width * planeSize;
        const dist = num - limit;
        if (dist > 0 && dist < closest) {
          closest = dist;
          closestSize = [width, height, depth];
        }
      }
    }
  }
  return closestSize;
}

/**
 * Given a 3 dimensional size, and a limit, compute
 * the largest volume with limit or less units.
 */
function getClosestSizeUnderOrAtLimit(size: number[], limit: number) {
  let closest = Number.MAX_SAFE_INTEGER;
  let closestSize: number[] = [];
  const depthLimit = Math.min(limit, size[2]);
  for (let depth = 1; depth <= depthLimit; ++depth) {
    for (let height = 1; height <= size[1]; ++height) {
      const planeSize = depth * height;
      if (planeSize <= limit) {
        const width = Math.min(size[0], Math.floor(limit / planeSize));
        const num = width * planeSize;
        const dist = limit - num;
        if (dist < closest) {
          closest = dist;
          closestSize = [width, height, depth];
        }
      }
    }
  }
  return closestSize;
}

function getDeviceLimitToRequest(
  limitValueTest: MaximumLimitValueTest,
  defaultLimit: number,
  maximumLimit: number
) {
  switch (limitValueTest) {
    case 'atDefault':
      return defaultLimit;
    case 'underDefault':
      return defaultLimit - 1;
    case 'betweenDefaultAndMaximum':
      return Math.floor((defaultLimit + maximumLimit) / 2);
    case 'atMaximum':
      return maximumLimit;
    case 'overMaximum':
      return maximumLimit + 1;
  }
}

function getTestWorkgroupSize(
  t: GPUTestBase,
  testValueName: MaximumTestValue,
  requestedLimit: number
) {
  const maxDimensions = [
    t.getDefaultLimit('maxComputeWorkgroupSizeX'),
    t.getDefaultLimit('maxComputeWorkgroupSizeY'),
    t.getDefaultLimit('maxComputeWorkgroupSizeZ'),
  ];

  switch (testValueName) {
    case 'atLimit':
      return getClosestSizeUnderOrAtLimit(maxDimensions, requestedLimit);
    case 'overLimit':
      return getClosestSizeOverLimit(maxDimensions, requestedLimit);
  }
}

function getDeviceLimitToRequestAndValueToTest(
  t: GPUTestBase,
  limitValueTest: MaximumLimitValueTest,
  testValueName: MaximumTestValue,
  defaultLimit: number,
  maximumLimit: number
) {
  const requestedLimit = getDeviceLimitToRequest(limitValueTest, defaultLimit, maximumLimit);
  const workgroupSize = getTestWorkgroupSize(t, testValueName, requestedLimit);
  return {
    requestedLimit,
    workgroupSize,
  };
}

const limit = 'maxComputeInvocationsPerWorkgroup';
export const { g, description } = makeLimitTestGroup(limit);

g.test('createComputePipeline,at_over')
  .desc(`Test using createComputePipeline(Async) at and over ${limit} limit`)
  .params(kMaximumLimitBaseParams.combine('async', [false, true] as const))
  .fn(async t => {
    const { limitTest, testValueName, async } = t.params;
    const { defaultLimit, adapterLimit: maximumLimit } = t;

    const { requestedLimit, workgroupSize } = getDeviceLimitToRequestAndValueToTest(
      t,
      limitTest,
      testValueName,
      defaultLimit,
      maximumLimit
    );
    const testValue = workgroupSize.reduce((a, b) => a * b, 1);

    await t.testDeviceWithSpecificLimits(
      requestedLimit,
      testValue,
      async ({ testValue, actualLimit, shouldError }) => {
        const { module, code } = t.getModuleForWorkgroupSize(workgroupSize);

        await t.testCreatePipeline(
          'createComputePipeline',
          async,
          module,
          shouldError,
          `workgroupSize: [${workgroupSize}], size: ${testValue}, limit: ${actualLimit}\n${code}`
        );
      }
    );
  });
