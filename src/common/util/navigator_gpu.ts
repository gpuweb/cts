// eslint-disable-next-line import/no-restricted-paths
import { getDefaultLimitsForAdapter } from '../../webgpu/capability_info.js';
import { TestCaseRecorder } from '../framework/fixture.js';
import { globalTestConfig } from '../framework/test_config.js';

import { ErrorWithExtra, assert, objectEquals } from './util.js';

/**
 * Finds and returns the `navigator.gpu` object (or equivalent, for non-browser implementations).
 * Throws an exception if not found.
 */
function defaultGPUProvider(): GPU {
  assert(
    typeof navigator !== 'undefined' && navigator.gpu !== undefined,
    'No WebGPU implementation found'
  );
  return navigator.gpu;
}

/**
 * GPUProvider is a function that creates and returns a new GPU instance.
 * May throw an exception if a GPU cannot be created.
 */
export type GPUProvider = () => GPU;

let gpuProvider: GPUProvider = defaultGPUProvider;

/**
 * Sets the function to create and return a new GPU instance.
 */
export function setGPUProvider(provider: GPUProvider) {
  assert(impl === undefined, 'setGPUProvider() should not be after getGPU()');
  gpuProvider = provider;
}

let impl: GPU | undefined = undefined;

let defaultRequestAdapterOptions: GPURequestAdapterOptions | undefined;

export function setDefaultRequestAdapterOptions(options: GPURequestAdapterOptions) {
  // It's okay to call this if you don't change the options
  if (objectEquals(options, defaultRequestAdapterOptions)) {
    return;
  }
  if (impl) {
    throw new Error('must call setDefaultRequestAdapterOptions before getGPU');
  }
  defaultRequestAdapterOptions = { ...options };
}

export function getDefaultRequestAdapterOptions() {
  return defaultRequestAdapterOptions;
}

/**
 * Finds and returns the `navigator.gpu` object (or equivalent, for non-browser implementations).
 * Throws an exception if not found.
 */
export function getGPU(recorder: TestCaseRecorder | null): GPU {
  if (impl) {
    return impl;
  }

  impl = gpuProvider();

  if (globalTestConfig.enforceDefaultLimits) {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const oldFn = impl.requestAdapter;
    impl.requestAdapter = async function (options?: GPURequestAdapterOptions) {
      const adapter = await oldFn.call(this, { ...defaultRequestAdapterOptions, ...options });
      if (adapter) {
        const limits = Object.fromEntries(
          Object.entries(getDefaultLimitsForAdapter(adapter)).map(([key, { default: v }]) => [
            key,
            v,
          ])
        );

        Object.defineProperty(adapter, 'limits', {
          get() {
            return limits;
          },
        });
      }
      return adapter;
    };

    const enforceDefaultLimits = (adapter: GPUAdapter, desc: GPUDeviceDescriptor | undefined) => {
      if (desc?.requiredLimits) {
        const limits = getDefaultLimitsForAdapter(adapter);
        for (const [key, value] of Object.entries(desc.requiredLimits)) {
          const info = limits[key as keyof ReturnType<typeof getDefaultLimitsForAdapter>];
          if (info && value !== undefined) {
            const [beyondLimit, condition] =
              info.class === 'maximum'
                ? [value > info.default, 'greater']
                : [value < info.default, 'less'];
            if (beyondLimit) {
              throw new DOMException(
                `requestedLimit ${value} for ${key} is ${condition} than adapter limit ${info.default}`,
                'OperationError'
              );
            }
          }
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const origFn = GPUAdapter.prototype.requestDevice;
    GPUAdapter.prototype.requestDevice = async function (
      this: GPUAdapter,
      desc?: GPUDeviceDescriptor | undefined
    ) {
      enforceDefaultLimits(this, desc);
      return await origFn.call(this, desc);
    };
  }

  if (defaultRequestAdapterOptions) {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const oldFn = impl.requestAdapter;
    impl.requestAdapter = function (
      options?: GPURequestAdapterOptions
    ): Promise<GPUAdapter | null> {
      const promise = oldFn.call(this, { ...defaultRequestAdapterOptions, ...options });
      if (recorder) {
        void promise.then(adapter => {
          if (adapter) {
            const adapterInfo = adapter.info;
            const infoString = `Adapter: ${adapterInfo.vendor} / ${adapterInfo.architecture} / ${adapterInfo.device}`;
            recorder.debug(new ErrorWithExtra(infoString, () => ({ adapterInfo })));
          }
        });
      }
      return promise;
    };
  }

  return impl;
}
