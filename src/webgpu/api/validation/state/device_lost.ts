import { assert } from '../../../../common/util/util.js';
import { getGPU } from '../../../util/navigator_gpu.js';

/**
 * Run the device loss tests. This function is used in device_lost validation tests as well as
 * device_lost manual tests (where the gpu process is crashed manually).
 */
export async function runDeviceLossTests(loseDevice: (device: GPUDevice) => void) {
    const adapter = await getGPU().requestAdapter();
    assert(adapter !== null);
    const device = await adapter.requestDevice();

    const tests = [];
    {
      const cmdbuf = device.createCommandEncoder().finish();
      tests.push(() => {
        device.queue.submit([cmdbuf]);
      });
    }

    loseDevice(device);

    await Promise.all(tests.map(post => post()));
}
