export const description = ``;

import { TestGroup, poptions } from '../../../framework/index.js';
import { GPUTest } from '../gpu_test.js';

export const g = new TestGroup(GPUTest);

g.test('basic', async t => {
  const value = t.params.value;

  const [src, map] = t.device.createBufferMapped({
    size: 12,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  new Uint32Array(map).set([0, value, 0]);
  src.unmap();
  await t.expectContents(src, new Uint32Array([0, value, 0]));
}).params(poptions('value', [0x00000001, 0x01020304]));
