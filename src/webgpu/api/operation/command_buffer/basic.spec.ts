export const description = `
Basic tests.
`;

import { GPUTest } from '../../../gpu_test.js';
import { TestGroup } from '../../../../common/framework/test_group.js';

export const g = new TestGroup(GPUTest);

g.test('empty', async t => {
  const encoder = t.device.createCommandEncoder();
  const cmd = encoder.finish();
  t.device.defaultQueue.submit([cmd]);
});
