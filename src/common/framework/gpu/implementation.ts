/// <reference types="@webgpu/types" />

import { unreachable, assert } from '../util/util.js';

export async function getDefaultAdapter(): Promise<GPUAdapter> {
  const gpu = await getGPU();

  if (dawn) {
    const window = new dawn.WebGPUWindow({
      width: 640,
      height: 480,
      title: 'WebGPU',
      visible: false,
    });

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    return gpu.requestAdapter({ window } as any);
  } else {
    return gpu.requestAdapter();
  }
}

let gpu: Promise<GPU> | 'failed' | undefined;

function getGPU(): Promise<GPU> {
  if (gpu === undefined) {
    gpu = 'failed';
    try {
      gpu = locateGPUInterface();
    } catch (ex) {
      unreachable('WebGPU initialization failed: ' + ex);
    }
  }

  assert(gpu !== 'failed', 'WebGPU initialization previously failed');
  return gpu;
}

async function locateGPUInterface(): Promise<GPU> {
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    return navigator.gpu as GPU;
  }

  if (typeof module !== 'undefined') {
    return tryInitDawn();
  }

  unreachable('WebGPU not available');
}

let dawn: typeof import('../../../../third_party/dawn/linux/index.node') | undefined;

async function tryInitDawn(): Promise<GPU> {
  dawn = await import('../../../../third_party/dawn/linux/index.node');
  dawn.GPU.$setPlatform(process.platform);

  Object.assign(global, dawn);

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  let tickDevice: any = {};

  function deviceTick(): void {
    /* eslint-disable-next-line no-console */
    console.log('ENTER: PROTO: deviceTick');
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    (tickDevice as any).tick();
    setImmediate(deviceTick);
  }
  dawn.GPUAdapter.prototype.requestDevice = function (): Promise<GPUDevice> {
    return new Promise(resolve => {
      this._requestDevice().then((device: GPUDevice) => {
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        tickDevice = device;
        setImmediate(deviceTick);

        resolve(device);
      });
    });
  };

  // temporary hack to return a promise instead of a callback
  dawn.GPUFence.prototype.onCompletion = function (completionValue: number): Promise<void> {
    return new Promise(resolve => {
      setImmediate(() => {
        this._onCompletion(completionValue, resolve);
      });
    });
  };

  dawn.GPUBuffer.prototype.mapReadAsync = function (): Promise<ArrayBuffer> {
    return new Promise(resolve => {
      setImmediate(() => {
        this._mapReadAsync(resolve);
      });
    });
  };

  dawn.GPUBuffer.prototype.mapWriteAsync = function (): Promise<ArrayBuffer> {
    return new Promise(resolve => {
      setImmediate(() => {
        this._mapWriteAsync(resolve);
      });
    });
  };

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  (dawn.GPUDevice as any).prototype.createBufferMappedAsync = function (
    descriptor: GPUBufferDescriptor
  ): Promise<GPUBuffer> {
    return new Promise(resolve => {
      setImmediate(() => {
        this._createBufferMappedAsync(descriptor, resolve);
      });
    });
  };

  dawn.GPUDevice.prototype.createBufferMapped = function (
    descriptor: GPUBufferDescriptor
  ): [GPUBuffer, ArrayBuffer] {
    /* eslint-disable-next-line no-console */
    console.log('ENTER: PROTO:createBufferMapped:' + descriptor);
    return [{} as GPUBuffer, {} as ArrayBuffer];
    //this._createBufferMapped(descriptor, resolve);
  };

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return (dawn.GPU as any) as GPU;
}
