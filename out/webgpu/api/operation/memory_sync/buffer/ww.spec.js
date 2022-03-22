/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Memory Synchronization Tests for Buffer: write after write.

- Create one single buffer and initialize it to 0. Wait on the fence to ensure the data is initialized.
Write a number (say 1) into the buffer via render pass, compute pass, copy or writeBuffer.
Write another number (say 2) into the same buffer via render pass, compute pass, copy, or writeBuffer.
Wait on another fence, then call expectContents to verify the written buffer.
  - x= 1st write type: {storage buffer in {compute, render, render-via-bundle}, t2b-copy, b2b-copy, writeBuffer}
  - x= 2nd write type: {storage buffer in {compute, render, render-via-bundle}, t2b-copy, b2b-copy, writeBuffer}
  - if pass type is the same, x= {single pass, separate passes} (note: render has loose guarantees)
  - if not single pass, x= writes in {same cmdbuf, separate cmdbufs, separate submits, separate queues}
`;import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import {
kOperationBoundaries,
kBoundaryInfo,
OperationContextHelper } from
'../operation_context_helper.js';

import { kAllWriteOps, BufferSyncTest, checkOpsValidForContext } from './buffer_sync_test.js';

export const g = makeTestGroup(BufferSyncTest);

g.test('ww').
desc(
`
    Perform a 'first' write operation on a buffer, followed by a 'second' write operation.
    Operations are separated by a 'boundary' (pass, encoder, queue-op, etc.).
    Test that the results are synchronized.
    The second write should overwrite the contents of the first.`).

params((u) =>
u //
.combine('boundary', kOperationBoundaries).
expand('_context', (p) => kBoundaryInfo[p.boundary].contexts).
expandWithParams(function* ({ _context }) {
  for (const firstWriteOp of kAllWriteOps) {
    for (const secondWriteOp of kAllWriteOps) {
      if (checkOpsValidForContext([firstWriteOp, secondWriteOp], _context)) {
        yield {
          writeOps: [firstWriteOp, secondWriteOp],
          contexts: _context };

      }
    }
  }
})).

fn(async (t) => {
  const { writeOps, contexts, boundary } = t.params;
  const helper = new OperationContextHelper(t);

  const buffer = await t.createBufferWithValue(0);
  await t.createIntermediateBuffersAndTexturesForWriteOp(writeOps[0], 0, 1);
  await t.createIntermediateBuffersAndTexturesForWriteOp(writeOps[1], 1, 2);

  t.encodeWriteOp(helper, writeOps[0], contexts[0], buffer, 0, 1);
  helper.ensureBoundary(boundary);
  t.encodeWriteOp(helper, writeOps[1], contexts[1], buffer, 1, 2);
  helper.ensureSubmit();
  t.verifyData(buffer, 2);
});

g.test('two_draws_in_the_same_render_pass').
desc(
`Test write-after-write operations in the same render pass. The first write will write 1 into
    a storage buffer. The second write will write 2 into the same buffer in the same pass. Expected
    data in buffer is either 1 or 2. It may use bundle in each draw.`).

paramsSubcasesOnly((u) =>
u //
.combine('firstDrawUseBundle', [false, true]).
combine('secondDrawUseBundle', [false, true])).

fn(async (t) => {
  const { firstDrawUseBundle, secondDrawUseBundle } = t.params;
  const buffer = await t.createBufferWithValue(0);
  const encoder = t.device.createCommandEncoder();
  const passEncoder = t.beginSimpleRenderPass(encoder);

  const useBundle = [firstDrawUseBundle, secondDrawUseBundle];
  for (let i = 0; i < 2; ++i) {
    const renderEncoder = useBundle[i] ?
    t.device.createRenderBundleEncoder({
      colorFormats: ['rgba8unorm'] }) :

    passEncoder;
    const pipeline = t.createStorageWriteRenderPipeline(i + 1);
    const bindGroup = t.createBindGroup(pipeline, buffer);
    renderEncoder.setPipeline(pipeline);
    renderEncoder.setBindGroup(0, bindGroup);
    renderEncoder.draw(1, 1, 0, 0);
    if (useBundle[i])
    passEncoder.executeBundles([renderEncoder.finish()]);
  }

  passEncoder.end();
  t.device.queue.submit([encoder.finish()]);
  t.verifyDataTwoValidValues(buffer, 1, 2);
});

g.test('two_draws_in_the_same_render_bundle').
desc(
`Test write-after-write operations in the same render bundle. The first write will write 1 into
    a storage buffer. The second write will write 2 into the same buffer in the same pass. Expected
    data in buffer is either 1 or 2.`).

fn(async (t) => {
  const buffer = await t.createBufferWithValue(0);
  const encoder = t.device.createCommandEncoder();
  const passEncoder = t.beginSimpleRenderPass(encoder);
  const renderEncoder = t.device.createRenderBundleEncoder({
    colorFormats: ['rgba8unorm'] });


  for (let i = 0; i < 2; ++i) {
    const pipeline = t.createStorageWriteRenderPipeline(i + 1);
    const bindGroup = t.createBindGroup(pipeline, buffer);
    renderEncoder.setPipeline(pipeline);
    renderEncoder.setBindGroup(0, bindGroup);
    renderEncoder.draw(1, 1, 0, 0);
  }

  passEncoder.executeBundles([renderEncoder.finish()]);
  passEncoder.end();
  t.device.queue.submit([encoder.finish()]);
  t.verifyDataTwoValidValues(buffer, 1, 2);
});

g.test('two_dispatches_in_the_same_compute_pass').
desc(
`Test write-after-write operations in the same compute pass. The first write will write 1 into
    a storage buffer. The second write will write 2 into the same buffer in the same pass. Expected
    data in buffer is 2.`).

fn(async (t) => {
  const buffer = await t.createBufferWithValue(0);
  const encoder = t.device.createCommandEncoder();
  const pass = encoder.beginComputePass();

  for (let i = 0; i < 2; ++i) {
    const pipeline = t.createStorageWriteComputePipeline(i + 1);
    const bindGroup = t.createBindGroup(pipeline, buffer);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatch(1);
  }

  pass.end();
  t.device.queue.submit([encoder.finish()]);
  t.verifyData(buffer, 2);
});

g.test('multiple_buffers').
desc(`Tests with more than one buffer to try to stress implementations a little bit more.`).
unimplemented();
//# sourceMappingURL=ww.spec.js.map