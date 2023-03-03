/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ import { keysOf } from '../../../../../common/util/data_tables.js';
import { assert } from '../../../../../common/util/util.js';
import { align, roundDown } from '../../../../util/math.js';

import { kMaximumLimitBaseParams, makeLimitTestGroup } from './limit_utils.js';

const limit = 'maxComputeWorkgroupStorageSize';
export const { g, description } = makeLimitTestGroup(limit);

const kSmallestWorkgroupVarSize = 4;

const wgslF16Types = {
  f16: { alignOf: 2, sizeOf: 2 },
  'vec2<f16>': { alignOf: 4, sizeOf: 4 },
  'vec3<f16>': { alignOf: 8, sizeOf: 6 },
  'vec4<f16>': { alignOf: 8, sizeOf: 8 },
  'mat2x2<f16>': { alignOf: 4, sizeOf: 8 },
  'mat3x2<f16>': { alignOf: 4, sizeOf: 12 },
  'mat4x2<f16>': { alignOf: 4, sizeOf: 16 },
  'mat2x3<f16>': { alignOf: 8, sizeOf: 16 },
  'mat3x3<f16>': { alignOf: 8, sizeOf: 24 },
  'mat4x3<f16>': { alignOf: 8, sizeOf: 32 },
  'mat2x4<f16>': { alignOf: 8, sizeOf: 16 },
  'mat3x4<f16>': { alignOf: 8, sizeOf: 24 },
  'mat4x4<f16>': { alignOf: 8, sizeOf: 32 },
};

const wgslBaseTypes = {
  f32: { alignOf: 4, sizeOf: 4 },
  i32: { alignOf: 4, sizeOf: 4 },
  u32: { alignOf: 4, sizeOf: 4 },

  'vec2<f32>': { alignOf: 8, sizeOf: 8 },
  'vec2<i32>': { alignOf: 8, sizeOf: 8 },
  'vec2<u32>': { alignOf: 8, sizeOf: 8 },

  'vec3<f32>': { alignOf: 16, sizeOf: 12 },
  'vec3<i32>': { alignOf: 16, sizeOf: 12 },
  'vec3<u32>': { alignOf: 16, sizeOf: 12 },

  'vec4<f32>': { alignOf: 16, sizeOf: 16 },
  'vec4<i32>': { alignOf: 16, sizeOf: 16 },
  'vec4<u32>': { alignOf: 16, sizeOf: 16 },

  'mat2x2<f32>': { alignOf: 8, sizeOf: 16 },
  'mat3x2<f32>': { alignOf: 8, sizeOf: 24 },
  'mat4x2<f32>': { alignOf: 8, sizeOf: 32 },
  'mat2x3<f32>': { alignOf: 16, sizeOf: 32 },
  'mat3x3<f32>': { alignOf: 16, sizeOf: 48 },
  'mat4x3<f32>': { alignOf: 16, sizeOf: 64 },
  'mat2x4<f32>': { alignOf: 16, sizeOf: 32 },
  'mat3x4<f32>': { alignOf: 16, sizeOf: 48 },
  'mat4x4<f32>': { alignOf: 16, sizeOf: 64 },

  S1: { alignOf: 16, sizeOf: 48 },
  S2: { alignOf: 4, sizeOf: 16 * 7 },
  S3: { alignOf: 16, sizeOf: 32 },
};

const wgslTypes = { ...wgslF16Types, ...wgslBaseTypes };

const kWGSLTypes = keysOf(wgslTypes);

function getModuleForWorkgroupStorageSize(device, wgslType, size) {
  assert(size % kSmallestWorkgroupVarSize === 0);
  const { sizeOf, alignOf } = wgslTypes[wgslType];
  const unitSize = align(sizeOf, alignOf);
  const units = Math.floor(size / unitSize);
  const extra = (size - units * unitSize) / kSmallestWorkgroupVarSize;

  const code = `
    struct S1 {
      a: f32,
      b: vec4f,
      c: u32,
    };
    struct S2 {
      a: array<vec3f, 7>,
    };
    struct S3 {
      a: vec3f,
      b: vec2f,
    };
    var<workgroup> d0: array<${wgslType}, ${units}>;
    ${extra ? `var<workgroup> d1: array<f32, ${extra}>;` : ''}
    @compute @workgroup_size(1) fn main() {
      _ = d0;
      ${extra ? '_ = d1;' : ''}
    }
  `;
  return { module: device.createShaderModule({ code }), code };
}

function getDeviceLimitToRequest(limitValueTest, defaultLimit, maximumLimit) {
  switch (limitValueTest) {
    case 'atDefault':
      return defaultLimit;
    case 'underDefault':
      return defaultLimit - kSmallestWorkgroupVarSize;
    case 'betweenDefaultAndMaximum':
      return roundDown(Math.floor((defaultLimit + maximumLimit) / 2), kSmallestWorkgroupVarSize);
    case 'atMaximum':
      return maximumLimit;
    case 'overMaximum':
      return maximumLimit + kSmallestWorkgroupVarSize;
  }
}

function getTestValue(testValueName, requestedLimit) {
  switch (testValueName) {
    case 'atLimit':
      return requestedLimit;
    case 'overLimit':
      return requestedLimit + kSmallestWorkgroupVarSize;
  }
}

function getDeviceLimitToRequestAndValueToTest(
  limitValueTest,
  testValueName,
  defaultLimit,
  maximumLimit
) {
  const requestedLimit = getDeviceLimitToRequest(limitValueTest, defaultLimit, maximumLimit);
  const testValue = getTestValue(testValueName, requestedLimit);
  return {
    requestedLimit,
    testValue,
  };
}

g.test('createComputePipeline,at_over')
  .desc(`Test using createComputePipeline at and over ${limit} limit`)
  .params(kMaximumLimitBaseParams.combine('wgslType', kWGSLTypes))
  .fn(async t => {
    const { limitTest, testValueName, wgslType } = t.params;
    const { defaultLimit, adapterLimit: maximumLimit } = t;

    const hasF16 = t.adapter.features.has('shader-f16');
    if (!hasF16 && wgslType in wgslF16Types) {
      return;
    }

    const features = hasF16 ? ['shader-f16'] : [];

    const { requestedLimit, testValue } = getDeviceLimitToRequestAndValueToTest(
      limitTest,
      testValueName,
      defaultLimit,
      maximumLimit
    );

    await t.testDeviceWithSpecificLimits(
      requestedLimit,
      testValue,
      async ({ device, testValue, actualLimit, shouldError }) => {
        const { module, code } = getModuleForWorkgroupStorageSize(device, wgslType, testValue);

        await t.expectValidationError(
          () => {
            device.createComputePipeline({
              layout: 'auto',
              compute: {
                module,
                entryPoint: 'main',
              },
            });
          },
          shouldError,
          `size: ${testValue}, limit: ${actualLimit}\n${code}`
        );
      },
      {},
      features
    );
  });

g.test('createComputePipelineAsync,at_over')
  .desc(`Test using createComputePipeline at and over ${limit} limit`)
  .params(kMaximumLimitBaseParams.combine('wgslType', kWGSLTypes))
  .fn(async t => {
    const { limitTest, testValueName, wgslType } = t.params;
    const { defaultLimit, adapterLimit: maximumLimit } = t;

    const hasF16 = t.adapter.features.has('shader-f16');
    if (!hasF16 && wgslType in wgslF16Types) {
      return;
    }

    const features = hasF16 ? ['shader-f16'] : [];

    const { requestedLimit, testValue } = getDeviceLimitToRequestAndValueToTest(
      limitTest,
      testValueName,
      defaultLimit,
      maximumLimit
    );

    await t.testDeviceWithSpecificLimits(
      requestedLimit,
      testValue,
      async ({ device, testValue, actualLimit, shouldError }) => {
        const { module, code } = getModuleForWorkgroupStorageSize(device, wgslType, testValue);

        const promise = device.createComputePipelineAsync({
          layout: 'auto',
          compute: {
            module,
            entryPoint: 'main',
          },
        });

        const msg = `size: ${testValue}, limit: ${actualLimit}\n${code}`;
        await t.shouldRejectConditionally('OperationError', promise, shouldError, msg);
      },
      {},
      features
    );
  });
