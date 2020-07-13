/// <reference types="@webgpu/types" />

import * as fs from 'fs';

let impl: Promise<GPU>;

export class WebGPUWindow {
  constructor({ width, height, title }: { width?: number; height?: number; title?: string }) {
    module.exports = require('../../../../standalone/third_party/dawn/linux/index.node');
    return new module.exports.WebGPUWindow({ width, height, title });
  }
}

export class GPU {
  requestAdapter({ window }: { window?: WebGPUWindow }): Promise<GPUAdapter> {
    module.exports = require('../../../../standalone/third_party/dawn/linux/index.node');
    return module.exports.GPU.requestAdapter({ window });
  }
}

export function getGPU(): Promise<GPU> {
  if (impl) {
    return impl;
  }

  let dawn = false;

  if (fs.existsSync('standalone/third_party/dawn/linux/index.node')) {
    dawn = true;
  }

  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    impl = Promise.resolve(navigator.gpu as GPU);
  } else if (dawn) {
    module.exports = require('../../../../standalone/third_party/dawn/linux/index.node');
    module.exports.GPU.$setPlatform(process.platform);
    Object.assign(global, module.exports);
    impl = module.exports.GPU;

    {
      const { GPUAdapter } = module.exports;
      GPUAdapter.prototype.requestDevice = function (): Promise<GPUDevice> {
        return new Promise(resolve => {
          this._requestDevice().then((device: GPUDevice) => {
            resolve(device);
          });
        });
      };
    }

    // temporary hack to return a promise instead of a callback
    {
      const { GPUFence } = module.exports;
      GPUFence.prototype.onCompletion = function (completionValue: number): Promise<void> {
        return new Promise(resolve => {
          setImmediate(() => {
            this._onCompletion(completionValue, resolve);
          });
        });
      };
    }
    {
      const { GPUBuffer } = module.exports;
      GPUBuffer.prototype.mapReadAsync = function (): Promise<void> {
        return new Promise(resolve => {
          setImmediate(() => {
            this._mapReadAsync(resolve);
          });
        });
      };
    }
    {
      const { GPUBuffer } = module.exports;
      GPUBuffer.prototype.mapWriteAsync = function (): Promise<void> {
        return new Promise(resolve => {
          setImmediate(() => {
            this._mapWriteAsync(resolve);
          });
        });
      };
    }
    {
      const { GPUDevice } = module.exports;
      GPUDevice.prototype.createBufferMappedAsync = function (
        descriptor: GPUDeviceDescriptor
      ): Promise<void> {
        return new Promise(resolve => {
          setImmediate(() => {
            this._createBufferMappedAsync(descriptor, resolve);
          });
        });
      };
    }
    {
      const { GPUDevice } = module.exports;
      GPUDevice.prototype.createBufferMapped = function (
        descriptor: GPUDeviceDescriptor
      ): Promise<void> {
        return new Promise(resolve => {
          setImmediate(() => {
            this._createBufferMapped(descriptor, resolve);
          });
        });
      };
    }
  } else {
    throw new Error('WebGPU initialization failed.');
  }
  return impl;
}
