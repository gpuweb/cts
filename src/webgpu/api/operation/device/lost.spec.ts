export const description = `
Tests for GPUDevice.lost.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { attemptGarbageCollection } from '../../../../common/util/collect_garbage.js';
import { getGPU } from '../../../../common/util/navigator_gpu.js';
import { assert, raceWithRejectOnTimeout } from '../../../../common/util/util.js';
import { GPUTest } from '../../../gpu_test.js';

class DeviceLostTests extends GPUTest {
  // Default timeout for waiting for device lost is 2 seconds.
  readonly kDeviceLostTimeoutMS = 2000;

  getDeviceLostWithTimeout(device: GPUDevice = this.device): Promise<GPUDeviceLostInfo> {
    return raceWithRejectOnTimeout(
      this.device.lost,
      this.kDeviceLostTimeoutMS,
      'device was not lost'
    );
  }

  expectDeviceDestroyed(): void {
    this.eventualAsyncExpectation(async niceStack => {
      try {
        const lost = await this.getDeviceLostWithTimeout();
        this.expect(lost.reason === 'destroyed', 'device was lost from destroy');
      } catch (ex) {
        niceStack.message = 'device was not lost';
        this.rec.expectationFailed(niceStack);
      }
    });
  }
}

export const g = makeTestGroup(DeviceLostTests);

g.test('not_lost_on_gc')
  .desc(
    `'lost' is never resolved by GPUDevice being garbage collected (with attemptGarbageCollection).`
  )
  .fn(async t => {
    // Create a new device for this because it is hard to lose all refs to the test fixture device.
    const adapter = await getGPU().requestAdapter();
    assert(adapter !== null);
    let device: GPUDevice | undefined = await adapter.requestDevice();
    assert(device !== null);

    t.shouldReject('Error', t.getDeviceLostWithTimeout(device), 'device was unexpectedly lost');

    device = undefined;
    await attemptGarbageCollection();
  });

g.test('lost_on_destroy')
  .desc(`'lost' is resolved, with reason='destroyed', on GPUDevice.destroy().`)
  .fn(async t => {
    t.expectDeviceDestroyed();
    t.device.destroy();
  });

g.test('same_object')
  .desc(`'lost' provides the same Promise and GPUDeviceLostInfo objects each time it's accessed.`)
  .fn(async t => {
    // The promises should be the same promise object.
    const lostPromise1 = t.device.lost;
    const lostPromise2 = t.device.lost;
    t.expect(lostPromise1 === lostPromise2);

    // The results should also be the same result object.
    t.device.destroy();
    const lost1 = await raceWithRejectOnTimeout(
      lostPromise1,
      t.kDeviceLostTimeoutMS,
      'device was not lost'
    );
    const lost2 = await raceWithRejectOnTimeout(
      lostPromise2,
      t.kDeviceLostTimeoutMS,
      'device was not lost'
    );
    t.expect(lost1 === lost2);
  });
