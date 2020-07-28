/// <reference types="@webgpu/types" />

declare const dawn: {
  GPU: DawnGPU;
  WebGPUWindow: typeof WebGPUWindow;
  GPUAdapter: typeof Adapter;
  GPUDevice: typeof Device;
  GPUFence: typeof Fence;
  GPUBuffer: typeof Buffer;
};
export = dawn;

declare class WebGPUWindow {
  constructor({ width, height, title, visible }: { width?: number; height?: number; title?: string; visible?: boolean });
}

declare class DawnGPU {
  requestAdapter({ window }: { window?: WebGPUWindow }): Promise<GPUAdapter>;
  $setPlatform(platform: NodeJS.Platform): void;
}

declare class Adapter extends GPUAdapter {
  _requestDevice(): Promise<GPUDevice>;
}

declare class Device extends GPUDevice {
  _createBufferMappedAsync(
    descriptor: GPUBufferDescriptor,
    callback: (buffer: GPUBuffer) => void
  ): void;
}

declare class Fence extends GPUFence {
  _onCompletion(completionValue: number, callback: () => void): void;
}

declare class Buffer extends GPUBuffer {
  _mapReadAsync(callback: (arrayBuffer: ArrayBuffer) => void): void;
  _mapWriteAsync(callback: (arrayBuffer: ArrayBuffer) => void): void;
}
