export const description = `
Tests GPUDevice.adapterInfo member.
`;

import { Fixture } from '../../../../common/framework/fixture.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { getGPU } from '../../../../common/util/navigator_gpu.js';
import { assert, objectEquals } from '../../../../common/util/util.js';

export const g = makeTestGroup(Fixture);

g.test('device_adapter_info')
  .desc(
    `
  Test that GPUDevice.adapterInfo matches GPUAdapter.info`
  )
  .fn(async t => {
    const gpu = getGPU(t.rec);
    const adapter = await gpu.requestAdapter();
    assert(adapter !== null);

    const device = await t.requestDeviceTracked(adapter);
    assert(device !== null);

    assert(device.adapterInfo instanceof GPUAdapterInfo);
    assert(adapter.info instanceof GPUAdapterInfo);

    for (const k of Object.keys(GPUAdapterInfo.prototype)) {
      t.expect(
        objectEquals(device.adapterInfo[k], adapter.info[k]),
        `device.adapterInfo.${k} is "${device.adapterInfo[k]}". Expected "${adapter.info[k]}"`
      );
    }
  });
