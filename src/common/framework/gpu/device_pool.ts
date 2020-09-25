import { SkipTestCase } from '../fixture.js';
import { assert, raceWithRejectOnTimeout, unreachable, assertReject } from '../util/util.js';

import { getGPU } from './implementation.js';

export interface DeviceProvider {
  acquire(): GPUDevice;
}

class TestFailedButDeviceReusable extends Error {}
export class TestOOMedShouldAttemptGC extends Error {}

export class DevicePool {
  /** Device with no descriptor. */
  private defaultHolder: DeviceHolder | 'uninitialized' | 'failed' = 'uninitialized';
  /** Devices with descriptors. */
  private nonDefaultHolders = new DescriptorToDeviceMap();

  /** Request a device from the pool. */
  async reserve(desc?: GPUDeviceDescriptor): Promise<DeviceProvider> {
    // Always attempt to initialize default device, to see if it succeeds.
    if (this.defaultHolder === 'uninitialized') {
      try {
        this.defaultHolder = await DeviceHolder.create();
      } catch (ex) {
        this.defaultHolder = 'failed';
      }
    }
    assert(this.defaultHolder !== 'failed', 'WebGPU device failed to initialize; not retrying');

    let holder;
    if (desc === undefined) {
      holder = this.defaultHolder;
    } else {
      holder = await this.nonDefaultHolders.getOrInsert(desc, () => DeviceHolder.create(desc));
    }

    assert(holder.state === 'free', 'Device was in use on DevicePool.acquire');
    holder.state = 'reserved';
    return holder;
  }

  // When a test is done using a device, it's released back into the pool.
  // This waits for error scopes, checks their results, and checks for various error conditions.
  async release(holder: DeviceProvider): Promise<void> {
    assert(this.defaultHolder instanceof DeviceHolder);
    assert(holder instanceof DeviceHolder);

    assert(holder.state !== 'free', 'trying to release a device while already released');

    try {
      await holder.ensureRelease();

      // (Hopefully if the device was lost, it has been reported by the time endErrorScopes()
      // has finished (or timed out). If not, it could cause a finite number of extra test
      // failures following this one (but should recover eventually).)
      const lostReason = holder.lostReason;
      if (lostReason !== undefined) {
        // Fail the current test.
        unreachable(`Device was lost: ${lostReason}`);
      }
    } catch (ex) {
      // Any error that isn't explicitly TestFailedButDeviceReusable forces a new device to be
      // created for the next test.
      if (!(ex instanceof TestFailedButDeviceReusable)) {
        if (holder === this.defaultHolder) {
          this.defaultHolder = 'uninitialized';
        } else {
          this.nonDefaultHolders.deleteByDevice(holder.device);
        }
        // TODO: device.destroy()
      }
      throw ex;
    } finally {
      // Mark the holder as free. (This only has an effect if the pool still has the holder.)
      // This could be done at the top but is done here to guard against async-races during release.
      holder.state = 'free';
    }
  }
}

/**
 * Map from GPUDeviceDescriptor to DeviceHolder.
 */
class DescriptorToDeviceMap {
  private unsupported: Set<string> = new Set();
  private items: Map<string, DeviceHolder> = new Map();

  /** Deletes an item from the map by GPUDevice value. */
  deleteByDevice(device: GPUDevice): void {
    for (const [k, v] of this.items) {
      if (v.device === device) {
        this.items.delete(k);
        return;
      }
    }
  }

  /**
   * Gets a DeviceHolder from the map if it exists; otherwise, calls create() to create one,
   * inserts it, and returns it.
   *
   * Throws SkipTestCase if devices with this descriptor are unsupported.
   */
  async getOrInsert(
    descriptor: GPUDeviceDescriptor,
    create: () => Promise<DeviceHolder>
  ): Promise<DeviceHolder> {
    const key = makeKeyFromDescriptor(descriptor);
    // Never retry unsupported configurations.
    if (this.unsupported.has(key)) {
      throw new SkipTestCase(
        `GPUDeviceDescriptor previously failed: ${JSON.stringify(descriptor)}`
      );
    }

    // Search for an existing device with the same descriptor.
    {
      const value = this.items.get(key);
      if (value) {
        // Move it to the end of the Map (most-recently-used).
        this.items.delete(key);
        this.items.set(key, value);
        return value;
      }
    }

    // No existing item was found; add a new one.
    let value;
    try {
      value = await create();
    } catch (ex) {
      this.unsupported.add(key);
      throw new SkipTestCase(
        `GPUDeviceDescriptor not supported: ${JSON.stringify(descriptor)}\n${ex?.message ?? ''}`
      );
    }
    this.insertAndCleanUp(key, value);
    return value;
  }

  /** Insert an entry, then remove the least-recently-used items if there are too many. */
  private insertAndCleanUp(key: string, value: DeviceHolder) {
    this.items.set(key, value);

    const kMaxEntries = 5;
    if (this.items.size > kMaxEntries) {
      // Delete the first (least recently used) item in the set.
      for (const [key] of this.items) {
        this.items.delete(key);
        return;
      }
    }
  }
}

/**
 * Make a stringified map-key from a GPUDeviceDescriptor.
 * Tries to make sure all defaults are resolved, first - but it's okay if some are missed
 * (it just means some GPUDevice objects won't get deduplicated).
 */
function makeKeyFromDescriptor(desc: GPUDeviceDescriptor): string {
  const extensions = desc.extensions ? Array.from(desc.extensions).sort() : [];
  const limits: Required<GPULimits> = {
    // Note: pre-populating all these fields also sets the order, so the object
    // keys will have consistent ordering in JSON.
    maxBindGroups: 4,
    maxDynamicUniformBuffersPerPipelineLayout: 8,
    maxDynamicStorageBuffersPerPipelineLayout: 4,
    maxSampledTexturesPerShaderStage: 16,
    maxSamplersPerShaderStage: 16,
    maxStorageBuffersPerShaderStage: 4,
    maxStorageTexturesPerShaderStage: 4,
    maxUniformBuffersPerShaderStage: 12,
    maxUniformBufferBindingSize: 16384,
    ...desc.limits,
  };
  return JSON.stringify({ extensions, limits });
}

/**
 * DeviceHolder has three states:
 * - 'free': Free to be used for a new test.
 * - 'reserved': Reserved by a running test, but has not had error scopes created yet.
 * - 'acquired': Reserved by a running test, and has had error scopes created.
 */
type DeviceHolderState = 'free' | 'reserved' | 'acquired';

/**
 * Holds a GPUDevice and tracks its state (free/reserved/acquired) and handles device loss.
 */
class DeviceHolder implements DeviceProvider {
  readonly device: GPUDevice;
  state: DeviceHolderState = 'free';
  lostReason?: string; // initially undefined; becomes set when the device is lost

  // Gets a device and creates a DeviceHolder.
  // If the device is lost, DeviceHolder.lostReason gets set.
  static async create(descriptor?: GPUDeviceDescriptor): Promise<DeviceHolder> {
    const gpu = getGPU();
    const adapter = await gpu.requestAdapter();
    assert(adapter !== null, 'requestAdapter returned null');
    const device = await adapter.requestDevice(descriptor);
    assert(device !== null, 'requestDevice returned null');

    return new DeviceHolder(device);
  }

  private constructor(device: GPUDevice) {
    this.device = device;
    this.device.lost.then(ev => {
      this.lostReason = ev.message;
    });
  }

  acquire(): GPUDevice {
    assert(this.state === 'reserved');
    this.state = 'acquired';
    this.device.pushErrorScope('out-of-memory');
    this.device.pushErrorScope('validation');
    return this.device;
  }

  async ensureRelease(): Promise<void> {
    const kPopErrorScopeTimeoutMS = 5000;

    assert(this.state !== 'free');
    try {
      if (this.state === 'acquired') {
        // Time out if popErrorScope never completes. This could happen due to a browser bug - e.g.,
        // as of this writing, on Chrome GPU process crash, popErrorScope just hangs.
        await raceWithRejectOnTimeout(
          this.release(),
          kPopErrorScopeTimeoutMS,
          'finalization popErrorScope timed out'
        );
      }
    } finally {
      this.state = 'free';
    }
  }

  private async release(): Promise<void> {
    // End the whole-test error scopes. Check that there are no extra error scopes, and that no
    // otherwise-uncaptured errors occurred during the test.
    let gpuValidationError: GPUValidationError | GPUOutOfMemoryError | null;
    let gpuOutOfMemoryError: GPUValidationError | GPUOutOfMemoryError | null;

    try {
      // May reject if the device was lost.
      gpuValidationError = await this.device.popErrorScope();
      gpuOutOfMemoryError = await this.device.popErrorScope();
    } catch (ex) {
      assert(
        this.lostReason !== undefined,
        'popErrorScope failed; should only happen if device has been lost'
      );
      throw ex;
    }

    await assertReject(
      this.device.popErrorScope(),
      'There was an extra error scope on the stack after a test'
    );

    if (gpuValidationError !== null) {
      assert(gpuValidationError instanceof GPUValidationError);
      // Allow the device to be reused.
      throw new TestFailedButDeviceReusable(
        `Unexpected validation error occurred: ${gpuValidationError.message}`
      );
    }
    if (gpuOutOfMemoryError !== null) {
      assert(gpuOutOfMemoryError instanceof GPUOutOfMemoryError);
      // Don't allow the device to be reused; unexpected OOM could break the device.
      throw new TestOOMedShouldAttemptGC('Unexpected out-of-memory error occurred');
    }
  }
}
