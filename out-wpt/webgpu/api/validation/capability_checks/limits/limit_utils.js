/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ import { kUnitCaseParamsBuilder } from '../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { keysOf } from '../../../../../common/util/data_tables.js';
import { getGPU } from '../../../../../common/util/navigator_gpu.js';
import { assert, range, reorder } from '../../../../../common/util/util.js';
import { kLimitInfo } from '../../../../capability_info.js';
import { GPUTestBase } from '../../../../gpu_test.js';

const CreatePipelineTypes = {
  createRenderPipeline: true,
  createRenderPipelineWithFragmentStage: true,
  createComputePipeline: true,
};

export const kCreatePipelineTypes = keysOf(CreatePipelineTypes);

const CreatePipelineAsyncTypes = {
  createRenderPipelineAsync: true,
  createRenderPipelineAsyncWithFragmentStage: true,
  createComputePipelineAsync: true,
};

export const kCreatePipelineAsyncTypes = keysOf(CreatePipelineAsyncTypes);

const RenderEncoderTypes = {
  render: true,
  renderBundle: true,
};

export const kRenderEncoderTypes = keysOf(RenderEncoderTypes);

const EncoderTypes = {
  compute: true,
  render: true,
  renderBundle: true,
};

export const kEncoderTypes = keysOf(EncoderTypes);

const BindGroupTests = {
  sameGroup: true,
  differentGroups: true,
};

export const kBindGroupTests = keysOf(BindGroupTests);

const BindingCombinations = {
  vertex: true,
  fragment: true,
  vertexAndFragmentWithPossibleVertexStageOverflow: true,
  vertexAndFragmentWithPossibleFragmentStageOverflow: true,
  compute: true,
};

export const kBindingCombinations = keysOf(BindingCombinations);

export function getPipelineTypeForBindingCombination(bindingCombination) {
  switch (bindingCombination) {
    case 'vertex':
      return 'createRenderPipeline';
    case 'fragment':
    case 'vertexAndFragmentWithPossibleVertexStageOverflow':
    case 'vertexAndFragmentWithPossibleFragmentStageOverflow':
      return 'createRenderPipelineWithFragmentStage';
    case 'compute':
      return 'createComputePipeline';
  }
}

export function getPipelineAsyncTypeForBindingCombination(bindingCombination) {
  switch (bindingCombination) {
    case 'vertex':
      return 'createRenderPipelineAsync';
    case 'fragment':
    case 'vertexAndFragmentWithPossibleVertexStageOverflow':
    case 'vertexAndFragmentWithPossibleFragmentStageOverflow':
      return 'createRenderPipelineAsyncWithFragmentStage';
    case 'compute':
      return 'createComputePipelineAsync';
  }
}

function getBindGroupIndex(bindGroupTest, i) {
  switch (bindGroupTest) {
    case 'sameGroup':
      return 0;
    case 'differentGroups':
      return i % 3;
  }
}

function getWGSLBindings(order, bindGroupTest, storageDefinitionWGSLSnippetFn, numBindings, id) {
  return reorder(
    order,
    range(
      numBindings,
      i =>
        `@group(${getBindGroupIndex(
          bindGroupTest,
          i
        )}) @binding(${i}) ${storageDefinitionWGSLSnippetFn(i, id)};`
    )
  ).join('\n');
}

export function getPerStageWGSLForBindingCombinationImpl(
  bindingCombination,
  order,
  bindGroupTest,
  storageDefinitionWGSLSnippetFn,
  bodyFn,
  numBindings,
  extraWGSL = ''
) {
  switch (bindingCombination) {
    case 'vertex':
      return `
        ${extraWGSL}
        ${getWGSLBindings(order, bindGroupTest, storageDefinitionWGSLSnippetFn, numBindings, 0)}
        @vertex fn mainVS() -> @builtin(position) vec4f {
          ${bodyFn(numBindings, 0)}
          return vec4f(0);
        }
      `;
    case 'fragment':
      return `
        ${extraWGSL}
        ${getWGSLBindings(order, bindGroupTest, storageDefinitionWGSLSnippetFn, numBindings, 0)}
        @vertex fn mainVS() -> @builtin(position) vec4f {
          return vec4f(0);
        }
        @fragment fn mainFS() -> @location(0) vec4f {
          ${bodyFn(numBindings, 0)}
          return vec4f(0);
        }
      `;
    case 'vertexAndFragmentWithPossibleVertexStageOverflow': {
      return `
        ${extraWGSL}
        ${getWGSLBindings(order, bindGroupTest, storageDefinitionWGSLSnippetFn, numBindings, 0)}
        ${getWGSLBindings(order, bindGroupTest, storageDefinitionWGSLSnippetFn, numBindings - 1, 1)}
        @vertex fn mainVS() -> @builtin(position) vec4f {
          ${bodyFn(numBindings, 0)}
          return vec4f(0);
        }
        @fragment fn mainFS() -> @location(0) vec4f {
          ${bodyFn(numBindings - 1, 1)}
          return vec4f(0);
        }
      `;
    }
    case 'vertexAndFragmentWithPossibleFragmentStageOverflow': {
      return `
        ${extraWGSL}
        ${getWGSLBindings(order, bindGroupTest, storageDefinitionWGSLSnippetFn, numBindings - 1, 0)}
        ${getWGSLBindings(order, bindGroupTest, storageDefinitionWGSLSnippetFn, numBindings, 1)}
        @vertex fn mainVS() -> @builtin(position) vec4f {
          ${bodyFn(numBindings - 1, 0)}
          return vec4f(0);
        }
        @fragment fn mainFS() -> @location(0) vec4f {
          ${bodyFn(numBindings, 1)}
          return vec4f(0);
        }
      `;
    }
    case 'compute':
      return `
        ${extraWGSL}
        ${getWGSLBindings(order, bindGroupTest, storageDefinitionWGSLSnippetFn, numBindings, 0)}
        @group(3) @binding(0) var<storage, read_write> d: f32;
        @compute @workgroup_size(1) fn main() {
          ${bodyFn(numBindings, 0)}
        }
      `;
      break;
  }
}

export function getPerStageWGSLForBindingCombination(
  bindingCombination,
  order,
  bindGroupTest,
  storageDefinitionWGSLSnippetFn,
  usageWGSLSnippetFn,
  numBindings,
  extraWGSL = ''
) {
  return getPerStageWGSLForBindingCombinationImpl(
    bindingCombination,
    order,
    bindGroupTest,
    storageDefinitionWGSLSnippetFn,
    (numBindings, set) => `${range(numBindings, i => usageWGSLSnippetFn(i, set)).join('\n')}`,
    numBindings,
    extraWGSL
  );
}

export function getPerStageWGSLForBindingCombinationStorageTextures(
  bindingCombination,
  order,
  bindGroupTest,
  storageDefinitionWGSLSnippetFn,
  usageWGSLSnippetFn,
  numBindings,
  extraWGSL = ''
) {
  return getPerStageWGSLForBindingCombinationImpl(
    bindingCombination,
    order,
    bindGroupTest,
    storageDefinitionWGSLSnippetFn,
    (numBindings, set) => {
      return bindingCombination === 'compute'
        ? `${range(numBindings, i => usageWGSLSnippetFn(i, set)).join('\n')};`
        : `${range(numBindings, i => usageWGSLSnippetFn(i, set)).join('\n')}; return vec4f(0);`;
    },
    numBindings,
    extraWGSL
  );
}

export const TestValues = {
  atLimit: true,
  overLimit: true,
};

export const kTestValueKeys = keysOf(TestValues);

export function getTestValue(limit, testValue) {
  switch (testValue) {
    case 'atLimit':
      return limit;
    case 'overLimit':
      return limit + 1;
  }
}

export const LimitValueTests = {
  atDefault: true,
  underDefault: true,
  betweenDefaultAndMaximum: true,
  atMaximum: true,
  overMaximum: true,
};

export const kLimitValueTestKeys = keysOf(LimitValueTests);

function getLimitValue(defaultLimit, maximumLimit, limitValueTest) {
  switch (limitValueTest) {
    case 'atDefault':
      return defaultLimit;
    case 'underDefault':
      return defaultLimit - 1;
    case 'betweenDefaultAndMaximum':
      return ((defaultLimit + maximumLimit) / 2) | 0;
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
    assert(this._device !== undefined, 'device is only valid in _testThenDestroyDevice callback');
    return this._device;
  }

  async requestDeviceWithLimits(adapter, requiredLimits, shouldReject) {
    if (shouldReject) {
      this.shouldReject('OperationError', adapter.requestDevice({ requiredLimits }));
      return undefined;
    } else {
      return await adapter.requestDevice({ requiredLimits });
    }
  }

  async getAdapterAndLimits() {
    const limit = this.limit;
    const gpu = getGPU();
    const adapter = await gpu.requestAdapter();
    assert(!!adapter);

    const defaultLimit = kLimitInfo[limit].default;
    const maximumLimit = adapter.limits[limit];
    assert(!Number.isNaN(defaultLimit));
    assert(!Number.isNaN(maximumLimit));

    return { adapter, defaultLimit, maximumLimit };
  }

  /**
   * Gets a device with the adapter a requested limit and checks that that limit
   * is correct or that the device failed to create if the requested limit is
   * beyond the maximum supported by the device.
   */
  async _getDeviceWithSpecificLimit(adapter, requestedLimit) {
    const limit = this.limit;

    const defaultLimit = kLimitInfo[limit].default;
    const maximumLimit = adapter.limits[limit];
    assert(!Number.isNaN(defaultLimit));
    assert(!Number.isNaN(maximumLimit));

    const requiredLimits = {};
    requiredLimits[limit] = requestedLimit;
    const shouldReject = requestedLimit > maximumLimit;

    const device = await this.requestDeviceWithLimits(adapter, requiredLimits, shouldReject);
    const actualLimit = device ? device.limits[limit] : 0;

    if (shouldReject) {
      this.expect(!device);
    } else {
      if (requestedLimit <= defaultLimit) {
        this.expect(actualLimit === defaultLimit);
      } else {
        this.expect(actualLimit === requestedLimit);
      }
    }

    return device ? { device, defaultLimit, maximumLimit, requestedLimit, actualLimit } : undefined;
  }

  /**
   * Gets a device with the adapter a requested limit and checks that that limit
   * is correct or that the device failed to create if the requested limit is
   * beyond the maximum supported by the device.
   */
  async _getDeviceWithRequestedLimit(limitValueTest) {
    const { adapter, defaultLimit, maximumLimit } = await this.getAdapterAndLimits();

    const requestedLimit = getLimitValue(defaultLimit, maximumLimit, limitValueTest);
    return this._getDeviceWithSpecificLimit(adapter, requestedLimit);
  }

  /**
   * Call the given function and check no WebGPU errors are leaked
   */
  async _testThenDestroyDevice(deviceAndLimits, testValue, fn) {
    assert(!this._device);

    const { device, actualLimit } = deviceAndLimits;
    this._device = device;
    const shouldError = testValue > actualLimit;

    device.pushErrorScope('internal');
    device.pushErrorScope('out-of-memory');
    device.pushErrorScope('validation');

    await fn({ ...deviceAndLimits, testValue, shouldError });

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
   * Creates a device with a specific limit.
   * If the limit of over the maximum we expect an exception
   * If the device is created then we call a test function, checking
   * that the function does not leak any GPU errors.
   */
  async testDeviceWithSpecificLimits(adapter, deviceLimitValue, testValue, fn) {
    assert(!this._device);

    const deviceAndLimits = await this._getDeviceWithSpecificLimit(adapter, deviceLimitValue);
    // If we request over the limit requestDevice will throw
    if (!deviceAndLimits) {
      return;
    }

    await this._testThenDestroyDevice(deviceAndLimits, testValue, fn);
  }

  /**
   * Creates a device with the limit defined by LimitValueTest.
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

    const { actualLimit } = deviceAndLimits;
    const testValue = getTestValue(actualLimit, testValueName);

    await this._testThenDestroyDevice(deviceAndLimits, testValue, async inputs => {
      await fn({ ...inputs, testValueName });
    });
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
          @vertex fn mainVS() -> @builtin(position) vec4f {
            return vec4f(v);
          }
        `;
      case 'createRenderPipelineWithFragmentStage':
      case 'createRenderPipelineAsyncWithFragmentStage':
        return `
          @group(${groupIndex}) @binding(0) var<uniform> v: f32;
          @vertex fn mainVS() -> @builtin(position) vec4f {
            return vec4f(v);
          }
          @fragment fn mainFS() -> @location(0) vec4f {
            return vec4f(1);
          }
        `;
      case 'createComputePipeline':
      case 'createComputePipelineAsync':
        return `
          @group(${groupIndex}) @binding(0) var<uniform> v: f32;
          @compute @workgroup_size(1) fn main() {
            _ = v;
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
          @vertex fn mainVS() -> @builtin(position) vec4f {
            return vec4f(v);
          }
        `;
      case 'createRenderPipelineWithFragmentStage':
      case 'createRenderPipelineAsyncWithFragmentStage':
        return `
          @group(0) @binding(${bindingIndex}) var<uniform> v: f32;
          @vertex fn mainVS() -> @builtin(position) vec4f {
            return vec4f(v);
          }
          @fragment fn mainFS() -> @location(0) vec4f {
            return vec4f(1);
          }
        `;
      case 'createComputePipeline':
      case 'createComputePipelineAsync':
        return `
          @group(0) @binding(${bindingIndex}) var<uniform> v: f32;
          @compute @workgroup_size(1) fn main() {
            _ = v;
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
            entryPoint: 'mainVS',
          },
        });
        break;
      case 'createRenderPipelineWithFragmentStage':
        return device.createRenderPipeline({
          layout: 'auto',
          vertex: {
            module,
            entryPoint: 'mainVS',
          },
          fragment: {
            module,
            entryPoint: 'mainFS',
            targets: [{ format: 'rgba8unorm' }],
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
            entryPoint: 'mainVS',
          },
        });
      case 'createRenderPipelineAsyncWithFragmentStage':
        return device.createRenderPipelineAsync({
          layout: 'auto',
          vertex: {
            module,
            entryPoint: 'mainVS',
          },
          fragment: {
            module,
            entryPoint: 'mainFS',
            targets: [{ format: 'rgba8unorm' }],
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
   * Creates an GPURenderCommandsMixin setup with some initial state.
   */
  _getGPURenderCommandsMixin(encoderType) {
    const { device } = this;

    switch (encoderType) {
      case 'render': {
        const buffer = this.trackForCleanup(
          device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM,
          })
        );

        const texture = this.trackForCleanup(
          device.createTexture({
            size: [1, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
          })
        );

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
        };
        break;
      }

      case 'renderBundle': {
        const buffer = this.trackForCleanup(
          device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM,
          })
        );

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
        };
        break;
      }
    }
  }

  /**
   * Tests a method on GPURenderCommandsMixin
   * The function will be called with the mixin.
   */
  async testGPURenderCommandsMixin(encoderType, fn, shouldError, msg = '') {
    const { mixin, prep, test } = this._getGPURenderCommandsMixin(encoderType);
    fn({ mixin });
    prep();

    await this.expectValidationError(test, shouldError, msg);
  }

  /**
   * Creates GPUBindingCommandsMixin setup with some initial state.
   */
  _getGPUBindingCommandsMixin(encoderType) {
    const { device } = this;

    switch (encoderType) {
      case 'compute': {
        const buffer = this.trackForCleanup(
          device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM,
          })
        );

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
        };
        break;
      }
      case 'render':
        return this._getGPURenderCommandsMixin('render');
      case 'renderBundle':
        return this._getGPURenderCommandsMixin('renderBundle');
    }
  }

  /**
   * Tests a method on GPUBindingCommandsMixin
   * The function pass will be called with the mixin and a bindGroup
   */
  async testGPUBindingCommandsMixin(encoderType, fn, shouldError, msg = '') {
    const { mixin, bindGroup, prep, test } = this._getGPUBindingCommandsMixin(encoderType);
    fn({ mixin, bindGroup });
    prep();

    await this.expectValidationError(test, shouldError, msg);
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
