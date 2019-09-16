export const description = `
queue submit validation tests.
`;

import { TestGroup } from '../../../framework/index.js';

import { ValidationTest } from './validation_test.js';

export const g = new TestGroup(ValidationTest);

g.test('submitting with a mapped buffer is disallowed', async t => {
  // Create a map-write buffer
  const buffer = t.device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
  });

  // Create a fake copy destination buffer
  const targetBuffer = t.device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.COPY_DST,
  });

  const commandEncoder = t.device.createCommandEncoder();
  commandEncoder.copyBufferToBuffer(buffer, 0, targetBuffer, 0, 4);

  // Submitting when the buffer has never been mapped should succeed
  const commandBuffer = commandEncoder.finish();
  t.queue.submit([commandBuffer]);

  // Map the buffer, submitting when the buffer is mapped should fail
  await buffer.mapWriteAsync();
  t.queue.submit([]);

  await t.expectValidationError(() => {
    t.queue.submit([commandBuffer]);
  });

  // Unmap the buffer, queue submit should succeed
  buffer.unmap();
  t.queue.submit([commandBuffer]);
});
