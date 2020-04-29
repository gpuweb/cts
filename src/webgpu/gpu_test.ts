import { Fixture } from '../common/framework/fixture.js';
import { getGPU } from '../common/framework/gpu/implementation.js';
import {
  assert,
  unreachable,
  raceWithRejectOnTimeout,
  assertReject,
  PromiseTimeoutError,
} from '../common/framework/util/util.js';

import {
  fillTextureDataWithTexelValue,
  getTextureCopyLayout,
  LayoutOptions as TextureLayoutOptions,
} from './util/texture/layout.js';
import { PerTexelComponent, getTexelDataRepresentation } from './util/texture/texelData.js';

type TypedArrayBufferView =
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Float32Array
  | Float64Array;

type TypedArrayBufferViewConstructor =
  | Uint8ArrayConstructor
  | Uint16ArrayConstructor
  | Uint32ArrayConstructor
  | Int8ArrayConstructor
  | Int16ArrayConstructor
  | Int32ArrayConstructor
  | Float32ArrayConstructor
  | Float64ArrayConstructor;

interface DeviceHolder {
  device: GPUDevice;
  lostReason?: string;
}

const kPopErrorScopeTimeoutMS = 5000;

class DevicePool {
  holder?: DeviceHolder = undefined; // undefined means "uninitialized"
  state: 'free' | 'acquired' | 'failed' = 'free';

  private async initialize(): Promise<void> {
    if (this.holder !== undefined) {
      return;
    }
    try {
      const gpu = getGPU();
      const adapter = await gpu.requestAdapter();
      const holder: DeviceHolder = {
        device: await adapter.requestDevice(),
        lostReason: undefined,
      };

      holder.device.lost.then(ev => {
        holder.lostReason = ev.message;
      });

      this.holder = holder;
      this.state = 'free';
    } catch (ex) {
      this.state = 'failed';
      throw ex;
    }
  }

  async acquire(): Promise<GPUDevice> {
    assert(this.state !== 'acquired', 'Device was in use');
    assert(this.state !== 'failed', 'WebGPU device previously failed to initialize');

    await this.initialize();
    this.state = 'acquired';

    assert(this.holder !== undefined);

    await assertReject(
      this.holder.device.popErrorScope(),
      'There was an error scope on the stack before a test'
    );
    this.beginErrorScopes();

    return this.holder.device;
  }

  beginErrorScopes(): void {
    assert(this.holder !== undefined);
    this.holder.device.pushErrorScope('out-of-memory');
    this.holder.device.pushErrorScope('validation');
  }

  async endErrorScopes(): Promise<void> {
    assert(this.holder !== undefined);
    let gpuValidationError: GPUValidationError | GPUOutOfMemoryError | null;
    let gpuOutOfMemoryError: GPUValidationError | GPUOutOfMemoryError | null;

    try {
      // May reject if the device was lost.
      gpuValidationError = await this.holder.device.popErrorScope();
      gpuOutOfMemoryError = await this.holder.device.popErrorScope();
    } catch (ex) {
      assert(
        this.holder.lostReason !== undefined,
        'popErrorScope failed, but device not (yet) lost'
      );
      throw ex;
    }

    if (gpuValidationError !== null) {
      assert(gpuValidationError instanceof GPUValidationError);
      unreachable(`Unexpected validation error occurred: ${gpuValidationError.message}`);
    }
    if (gpuOutOfMemoryError !== null) {
      assert(gpuOutOfMemoryError instanceof GPUOutOfMemoryError);
      unreachable('Unexpected out-of-memory error occurred');
    }
  }

  async release(device: GPUDevice): Promise<void> {
    assert(this.state === 'acquired');
    assert(this.holder !== undefined);
    assert(device === this.holder.device, 'Released device was the wrong device');

    try {
      // A timeout probably isn't supposed to happen, but could due to a browser bug
      // (e.g. as of this writing, on Chrome GPU process crash, popErrorScope just hangs).
      await raceWithRejectOnTimeout(
        this.endErrorScopes(),
        kPopErrorScopeTimeoutMS,
        'finalization popErrorScope timed out'
      );
    } catch (ex) {
      if (ex instanceof PromiseTimeoutError) {
        this.holder = undefined;
      }
      throw ex;
    } finally {
      this.state = 'free';

      // Hopefully if the device was lost, it has been reported by the time endErrorScopes()
      // has finished (or timed out). If not, it could cause a finite number of extra test
      // failures following this one (but should recover eventually).
      if (this.holder) {
        const lostReason = this.holder.lostReason;
        if (lostReason !== undefined) {
          this.holder = undefined;
          unreachable(`Device was lost: ${lostReason}`);
        }
      }
    }
  }
}

const devicePool = new DevicePool();

export class GPUTest extends Fixture {
  private objects: { device: GPUDevice; queue: GPUQueue } | undefined = undefined;
  initialized = false;

  get device(): GPUDevice {
    assert(this.objects !== undefined);
    return this.objects.device;
  }

  get queue(): GPUQueue {
    assert(this.objects !== undefined);
    return this.objects.queue;
  }

  async init(): Promise<void> {
    await super.init();

    const device = await devicePool.acquire();
    const queue = device.defaultQueue;
    this.objects = { device, queue };
  }

  // Note: finalize is called even if init was unsuccessful.
  async finalize(): Promise<void> {
    await super.finalize();

    if (this.objects) {
      await devicePool.release(this.objects.device);
    }
  }

  createCopyForMapRead(src: GPUBuffer, size: number): GPUBuffer {
    const dst = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    const c = this.device.createCommandEncoder();
    c.copyBufferToBuffer(src, 0, dst, 0, size);

    this.queue.submit([c.finish()]);

    return dst;
  }

  // TODO: add an expectContents for textures, which logs data: uris on failure

  expectContents(src: GPUBuffer, expected: TypedArrayBufferView): void {
    const dst = this.createCopyForMapRead(src, expected.buffer.byteLength);

    this.eventualAsyncExpectation(async niceStack => {
      const constructor = expected.constructor as TypedArrayBufferViewConstructor;
      const actual = new constructor(await dst.mapReadAsync());
      const check = this.checkBuffer(actual, expected);
      if (check !== undefined) {
        niceStack.message = check;
        this.rec.fail(niceStack);
      }
      dst.destroy();
    });
  }

  expectBuffer(actual: Uint8Array, exp: Uint8Array): void {
    const check = this.checkBuffer(actual, exp);
    if (check !== undefined) {
      this.rec.fail(new Error(check));
    }
  }

  checkBuffer(
    actual: TypedArrayBufferView,
    exp: TypedArrayBufferView,
    tolerance: number | ((i: number) => number) = 0
  ): string | undefined {
    assert(actual.constructor === exp.constructor);

    const size = exp.byteLength;
    if (actual.byteLength !== size) {
      return 'size mismatch';
    }
    const lines = [];
    let failedPixels = 0;
    for (let i = 0; i < size; ++i) {
      const tol = typeof tolerance === 'function' ? tolerance(i) : tolerance;
      if (Math.abs(actual[i] - exp[i]) > tol) {
        if (failedPixels > 4) {
          lines.push('... and more');
          break;
        }
        failedPixels++;
        lines.push(`at [${i}], expected ${exp[i]}, got ${actual[i]}`);
      }
    }

    // TODO: Could make a more convenient message, which could look like e.g.:
    //
    //   Starting at offset 48,
    //              got 22222222 ABCDABCD 99999999
    //     but expected 22222222 55555555 99999999
    //
    // or
    //
    //   Starting at offset 0,
    //              got 00000000 00000000 00000000 00000000 (... more)
    //     but expected 00FF00FF 00FF00FF 00FF00FF 00FF00FF (... more)
    //
    // Or, maybe these diffs aren't actually very useful (given we have the prints just above here),
    // and we should remove them. More important will be logging of texture data in a visual format.

    if (size <= 256 && failedPixels > 0) {
      const expHex = Array.from(new Uint8Array(exp.buffer, exp.byteOffset, exp.byteLength))
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
      const actHex = Array.from(new Uint8Array(actual.buffer, actual.byteOffset, actual.byteLength))
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
      lines.push('EXPECT:\t  ' + exp.join(' '));
      lines.push('\t0x' + expHex);
      lines.push('ACTUAL:\t  ' + actual.join(' '));
      lines.push('\t0x' + actHex);
    }
    if (failedPixels) {
      return lines.join('\n');
    }
    return undefined;
  }

  expectSingleColor(
    src: GPUTexture,
    format: GPUTextureFormat,
    {
      size,
      exp,
      dimension = '2d',
      slice = 0,
      layout,
    }: {
      size: [number, number, number];
      exp: PerTexelComponent<number>;
      dimension?: GPUTextureDimension;
      slice?: number;
      layout?: TextureLayoutOptions;
    }
  ): void {
    const { byteLength, bytesPerRow, rowsPerImage } = getTextureCopyLayout(
      format,
      dimension,
      size,
      layout
    );
    const expectedTexelData = getTexelDataRepresentation(format).getBytes(exp);

    const buffer = this.device.createBuffer({
      size: byteLength,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyTextureToBuffer(
      { texture: src, mipLevel: layout?.mipLevel, arrayLayer: slice },
      { buffer, bytesPerRow, rowsPerImage },
      size
    );
    this.queue.submit([commandEncoder.finish()]);
    const arrayBuffer = new ArrayBuffer(byteLength);
    fillTextureDataWithTexelValue(expectedTexelData, format, dimension, arrayBuffer, size, layout);
    this.expectContents(buffer, new Uint8Array(arrayBuffer));
  }
}
