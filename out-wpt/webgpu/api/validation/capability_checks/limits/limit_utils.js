/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ import { kUnitCaseParamsBuilder } from '../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { keysOf } from '../../../../../common/util/data_tables.js';
import { getGPU } from '../../../../../common/util/navigator_gpu.js';
import { assert } from '../../../../../common/util/util.js';
import { kLimitInfo } from '../../../../capability_info.js';
import { GPUTestBase } from '../../../../gpu_test.js';

const CreatePipelineTypes = {
  createRenderPipeline: true,
  createComputePipeline: true,
};

export const kCreatePipelineTypes = ['createRenderPipeline', 'createComputePipeline'];

const CreatePipelineAsyncTypes = {
  createRenderPipelineAsync: true,
  createComputePipelineAsync: true,
};

export const kCreatePipelineAsyncTypes = [
  'createRenderPipelineAsync',
  'createComputePipelineAsync',
];

const EncoderTypes = {
  compute: true,
  render: true,
  renderBundle: true,
};

export const kEncoderTypes = keysOf(EncoderTypes);

export const TestValue = {
  atLimit: true,
  overLimit: true,
};

export const kTestValueKeys = keysOf(TestValue);

export function getTestValue(limit, testValue) {
  switch (testValue) {
    case 'atLimit':
      return limit;
    case 'overLimit':
      return limit + 1;
  }
}

export const LimitValueTest = {
  atDefault: true,
  underDefault: true,
  atMaximum: true,
  overMaximum: true,
};
export const kLimitValueTestKeys = keysOf(LimitValueTest);

function getLimitValue(defaultLimit, maximumLimit, limitValueTest) {
  switch (limitValueTest) {
    case 'atDefault':
      return defaultLimit;
    case 'underDefault':
      return defaultLimit - 1;
    case 'atMaximum':
      return maximumLimit;
    case 'overMaximum':
      return maximumLimit + 1;
  }
}

/**
 * Adds the default parameters to a limit test
 */
export const kLimitBaseParams = kUnitCaseParamsBuilder
  .combine('limitTest', kLimitValueTestKeys)
  .beginSubcases()
  .combine('testValueName', kTestValueKeys);

export class LimitTestsImpl extends GPUTestBase {
  _device = undefined;
  limit = '';

  get device() {
    assert(
      this._device !== undefined,
      'device is only valid in testDeviceWithRequestedLimits callback'
    );

    return this._device;
  }

  async requestDeviceWithLimits(limitValueTest, adapter, requiredLimits) {
    switch (limitValueTest) {
      case 'overMaximum':
        this.shouldReject('OperationError', adapter.requestDevice({ requiredLimits }));
        return undefined;
      default:
        return await adapter.requestDevice({ requiredLimits });
    }
  }

  /**
   * Gets a device with the adapter a requested limit and checks that that limit
   * is correct or that the device failed to create if the requested limit is
   * beyond the maximum supported by the device.
   */
  async _getDeviceWithRequestedLimit(limitValueTest) {
    const limit = this.limit;
    const gpu = getGPU();
    const adapter = await gpu.requestAdapter();
    assert(!!adapter);

    const defaultLimit = kLimitInfo[limit].default;
    const maximumLimit = adapter.limits[limit];
    assert(!Number.isNaN(defaultLimit));
    assert(!Number.isNaN(maximumLimit));

    const requestedLimit = getLimitValue(defaultLimit, maximumLimit, limitValueTest);

    const requiredLimits = {};
    requiredLimits[limit] = requestedLimit;

    const device = await this.requestDeviceWithLimits(limitValueTest, adapter, requiredLimits);
    const actualLimit = device ? device.limits[limit] : 0;

    switch (limitValueTest) {
      case 'atDefault':
        this.expect(!!device);
        this.expect(actualLimit === defaultLimit);
        break;
      case 'underDefault':
        this.expect(!!device);
        this.expect(actualLimit === defaultLimit);
        break;
      case 'atMaximum':
        this.expect(!!device);
        this.expect(actualLimit === maximumLimit);
        break;
      case 'overMaximum':
        this.expect(!device);
        break;
    }

    return device ? { device, defaultLimit, maximumLimit, requestedLimit, actualLimit } : undefined;
  }

  /**
   * Creates a device with the requested limits.
   * If the limit of over the maximum we expect an exception
   * If the device is created then we call a test function, checking
   * that the function does not leak any GPU errors.
   */
  async testDeviceWithRequestedLimits(limitTest, testValueName, fn) {
    assert(!this._device);

    const deviceAndLimits = await this._getDeviceWithRequestedLimit(limitTest);
    // If we request over the limit requestDevice will throw
    if (!deviceAndLimits) {
      return;
    }

    const { device, actualLimit } = deviceAndLimits;
    this._device = device;
    const testValue = getTestValue(actualLimit, testValueName);
    const shouldError = testValueName === 'overLimit';

    device.pushErrorScope('internal');
    device.pushErrorScope('out-of-memory');
    device.pushErrorScope('validation');

    await fn({ ...deviceAndLimits, testValueName, testValue, shouldError });

    const validationError = await device.popErrorScope();
    const outOfMemoryError = await device.popErrorScope();
    const internalError = await device.popErrorScope();

    this.expect(!validationError, validationError?.message || '');
    this.expect(!outOfMemoryError, outOfMemoryError?.message || '');
    this.expect(!internalError, internalError?.message || '');

    device.destroy();
    this._device = undefined;
  }

  /**
   * Calls a function that expects a GPU error if shouldError is true
   */
  // MAINTENANCE_TODO: Remove this duplicated code with GPUTest if possible
  async expectGPUErrorAsync(filter, fn, shouldError = true, msg = '') {
    const { device } = this;

    device.pushErrorScope(filter);
    const returnValue = fn();
    if (returnValue instanceof Promise) {
      await returnValue;
    }

    const error = await device.popErrorScope();
    this.expect(
      !!error === shouldError,
      `${error?.message || 'no error when one was expected'}: ${msg}`
    );

    return returnValue;
  }

  /** Expect that the provided promise rejects, with the provided exception name. */
  async shouldRejectConditionally(expectedName, p, shouldReject, msg) {
    if (shouldReject) {
      this.shouldReject(expectedName, p, msg);
    } else {
      this.shouldResolve(p, msg);
    }

    // We need to explicitly wait for the promise because the device may be
    // destroyed immediately after returning from this function.
    try {
      await p;
    } catch (e) {
      //
    }
  }

  /**
   * Calls a function that expects a validation error if shouldError is true
   */
  async expectValidationError(fn, shouldError = true, msg = '') {
    return this.expectGPUErrorAsync('validation', fn, shouldError, msg);
  }

  /**
   * Calls a function that expects to not generate a validation error
   */
  async expectNoValidationError(fn, msg = '') {
    return this.expectGPUErrorAsync('validation', fn, false, msg);
  }

  /**
   * Calls a function that might expect a validation error.
   * if shouldError is true then expect a validation error,
   * if shouldError is false then ignore out-of-memory errors.
   */
  async testForValidationErrorWithPossibleOutOfMemoryError(fn, shouldError = true, msg = '') {
    const { device } = this;

    if (!shouldError) {
      device.pushErrorScope('out-of-memory');
      const result = fn();
      await device.popErrorScope();
      return result;
    }

    // Validation should fail before out-of-memory so there is no need to check
    // for out-of-memory here.
    device.pushErrorScope('validation');
    const returnValue = fn();
    const validationError = await device.popErrorScope();

    this.expect(
      !!validationError,
      `${validationError?.message || 'no error when one was expected'}: ${msg}`
    );

    return returnValue;
  }

  getGroupIndexWGSLForPipelineType(pipelineType, groupIndex) {
    switch (pipelineType) {
      case 'createRenderPipeline':
      case 'createRenderPipelineAsync':
        return `
          @group(${groupIndex}) @binding(0) var<uniform> v: f32;
          @vertex fn main() -> @builtin(position) vec4f {
            return vec4f(v);
          }
        `;
      case 'createComputePipeline':
      case 'createComputePipelineAsync':
        return `
          @group(0) @binding(0) var<storage, read_write> d: f32;
          @group(${groupIndex}) @binding(0) var<uniform> v: f32;
          @compute @workgroup_size(1) fn main() {
            d = v;
          }
        `;
        break;
    }
  }

  getBindingIndexWGSLForPipelineType(pipelineType, bindingIndex) {
    switch (pipelineType) {
      case 'createRenderPipeline':
      case 'createRenderPipelineAsync':
        return `
          @group(0) @binding(${bindingIndex}) var<uniform> v: f32;
          @vertex fn main() -> @builtin(position) vec4f {
            return vec4f(v);
          }
        `;
      case 'createComputePipeline':
      case 'createComputePipelineAsync':
        return `
          @group(0) @binding(0) var<storage, read_write> d: f32;
          @group(0) @binding(${bindingIndex}) var<uniform> v: f32;
          @compute @workgroup_size(1) fn main() {
            d = v;
          }
        `;
        break;
    }
  }

  createPipeline(createPipelineType, module) {
    const { device } = this;

    switch (createPipelineType) {
      case 'createRenderPipeline':
        return device.createRenderPipeline({
          layout: 'auto',
          vertex: {
            module,
            entryPoint: 'main',
          },
        });
        break;
      case 'createComputePipeline':
        return device.createComputePipeline({
          layout: 'auto',
          compute: {
            module,
            entryPoint: 'main',
          },
        });
        break;
    }
  }

  createPipelineAsync(createPipelineAsyncType, module) {
    const { device } = this;

    switch (createPipelineAsyncType) {
      case 'createRenderPipelineAsync':
        return device.createRenderPipelineAsync({
          layout: 'auto',
          vertex: {
            module,
            entryPoint: 'main',
          },
        });
      case 'createComputePipelineAsync':
        return device.createComputePipelineAsync({
          layout: 'auto',
          compute: {
            module,
            entryPoint: 'main',
          },
        });
    }
  }

  /**
   * Creates an encoder that has GPUBindingCommandsMixin
   */
  _getGPUBindingCommandsMixin(encoderType) {
    const { device } = this;

    switch (encoderType) {
      case 'compute': {
        const buffer = device.createBuffer({
          size: 16,
          usage: GPUBufferUsage.UNIFORM,
        });

        const layout = device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.COMPUTE,
              buffer: {},
            },
          ],
        });

        const bindGroup = device.createBindGroup({
          layout,
          entries: [
            {
              binding: 0,
              resource: { buffer },
            },
          ],
        });

        const encoder = device.createCommandEncoder();
        const mixin = encoder.beginComputePass();
        return {
          mixin,
          bindGroup,
          prep() {
            mixin.end();
          },
          test() {
            encoder.finish();
          },
          cleanup() {
            buffer.destroy();
          },
        };
        break;
      }

      case 'render': {
        const buffer = device.createBuffer({
          size: 16,
          usage: GPUBufferUsage.UNIFORM,
        });

        const texture = device.createTexture({
          size: [1, 1],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });

        const layout = device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.VERTEX,
              buffer: {},
            },
          ],
        });

        const bindGroup = device.createBindGroup({
          layout,
          entries: [
            {
              binding: 0,
              resource: { buffer },
            },
          ],
        });

        const encoder = device.createCommandEncoder();
        const mixin = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: texture.createView(),
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });

        return {
          mixin,
          bindGroup,
          prep() {
            mixin.end();
          },
          test() {
            encoder.finish();
          },
          cleanup() {
            buffer.destroy();
            texture.destroy();
          },
        };
        break;
      }

      case 'renderBundle': {
        const buffer = device.createBuffer({
          size: 16,
          usage: GPUBufferUsage.UNIFORM,
        });

        const layout = device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.VERTEX,
              buffer: {},
            },
          ],
        });

        const bindGroup = device.createBindGroup({
          layout,
          entries: [
            {
              binding: 0,
              resource: { buffer },
            },
          ],
        });

        const mixin = device.createRenderBundleEncoder({
          colorFormats: ['rgba8unorm'],
        });

        return {
          mixin,
          bindGroup,
          prep() {},
          test() {
            mixin.finish();
          },
          cleanup() {
            buffer.destroy();
          },
        };
        break;
      }
    }
  }

  /**
   * Tests a method on GPUBindingCommandsMixin
   * The function pass will be called with the mixin and a bindGroup
   */
  async testGPUBindingCommandsMixin(encoderType, fn, shouldError, msg = '') {
    const { mixin, bindGroup, prep, test, cleanup } = this._getGPUBindingCommandsMixin(encoderType);
    fn({ mixin, bindGroup });
    prep();

    await this.expectValidationError(test, shouldError, msg);

    cleanup();
  }
}

/**
 * Makes a new LimitTest class so that the tests have access to `limit`
 */
function makeLimitTestFixture(limit) {
  class LimitTests extends LimitTestsImpl {
    limit = limit;
  }

  return LimitTests;
}

/**
 * This is to avoid repeating yourself (D.R.Y.) as I ran into that issue multiple times
 * writing these tests where I'd copy a test, need to rename a limit in 3-4 places,
 * forget one place, and then spend 20-30 minutes wondering why the test was failing.
 */
export function makeLimitTestGroup(limit) {
  const description = `API Validation Tests for ${limit}.`;
  const g = makeTestGroup(makeLimitTestFixture(limit));
  return { g, description, limit };
}
