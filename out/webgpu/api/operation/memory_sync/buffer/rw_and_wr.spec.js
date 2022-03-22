/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Memory Synchronization Tests for Buffer: read before write and read after write.

- Create a single buffer and initialize it to 0, wait on the fence to ensure the data is initialized.
Write a number (say 1) into the buffer via render pass, compute pass, copy or writeBuffer.
Read the data and use it in render, compute, or copy.
Wait on another fence, then call expectContents to verify the written buffer.
This is a read-after write test but if the write and read operations are reversed, it will be a read-before-write test.
  - x= write op: {storage buffer in {compute, render, render-via-bundle}, t2b copy dst, b2b copy dst, writeBuffer}
  - x= read op: {index buffer, vertex buffer, indirect buffer (draw, draw indexed, dispatch), uniform buffer, {readonly, readwrite} storage buffer in {compute, render, render-via-bundle}, b2b copy src, b2t copy src}
  - x= read-write sequence: {read then write, write then read}
  - if pass type is the same, x= {single pass, separate passes} (note: render has loose guarantees)
  - if not single pass, x= writes in {same cmdbuf, separate cmdbufs, separate submits, separate queues}

TODO: Tests with more than one buffer to try to stress implementations a little bit more.
`;import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import {
kOperationBoundaries,
kBoundaryInfo,
OperationContextHelper } from
'../operation_context_helper.js';

import {
kAllReadOps,
kAllWriteOps,
BufferSyncTest,
checkOpsValidForContext } from
'./buffer_sync_test.js';

// The src value is what stores in the src buffer before any operation.
const kSrcValue = 0;
// The op value is what the read/write operation write into the target buffer.
const kOpValue = 1;

export const g = makeTestGroup(BufferSyncTest);

g.test('rw').
desc(
`
    Perform a 'read' operations on a buffer, followed by a 'write' operation.
    Operations are separated by a 'boundary' (pass, encoder, queue-op, etc.).
    Test that the results are synchronized.
    The read should not see the contents written by the subsequent write.`).

params((u) =>
u //
.combine('boundary', kOperationBoundaries).
expand('_context', (p) => kBoundaryInfo[p.boundary].contexts).
expandWithParams(function* ({ _context }) {
  for (const readOp of kAllReadOps) {
    for (const writeOp of kAllWriteOps) {
      if (checkOpsValidForContext([readOp, writeOp], _context)) {
        yield {
          readOp,
          readContext: _context[0],
          writeOp,
          writeContext: _context[1] };

      }
    }
  }
})).

fn(async (t) => {
  const { readContext, readOp, writeContext, writeOp, boundary } = t.params;
  const helper = new OperationContextHelper(t);

  const { srcBuffer, dstBuffer } = await t.createBuffersForReadOp(readOp, kSrcValue, kOpValue);
  await t.createIntermediateBuffersAndTexturesForWriteOp(writeOp, 0, kOpValue);

  // The read op will read from src buffer and write to dst buffer based on what it reads.
  // The write op will write the given op value into src buffer as well.
  // The write op happens after read op. So we are expecting the src value to be in the dst buffer.
  t.encodeReadOp(helper, readOp, readContext, srcBuffer, dstBuffer);
  helper.ensureBoundary(boundary);
  t.encodeWriteOp(helper, writeOp, writeContext, srcBuffer, 0, kOpValue);
  helper.ensureSubmit();
  // Only verify the value of the first element of the dstBuffer
  t.verifyData(dstBuffer, kSrcValue);
});

g.test('wr').
desc(
`
    Perform a 'write' operation on a buffer, followed by a 'read' operation.
    Operations are separated by a 'boundary' (pass, encoder, queue-op, etc.).
    Test that the results are synchronized.
    The read should see exactly the contents written by the previous write.`).

params((u) =>
u //
.combine('boundary', kOperationBoundaries).
expand('_context', (p) => kBoundaryInfo[p.boundary].contexts).
expandWithParams(function* ({ _context }) {
  for (const readOp of kAllReadOps) {
    for (const writeOp of kAllWriteOps) {
      if (checkOpsValidForContext([readOp, writeOp], _context)) {
        yield {
          readOp,
          readContext: _context[0],
          writeOp,
          writeContext: _context[1] };

      }
    }
  }
})).

fn(async (t) => {
  const { readContext, readOp, writeContext, writeOp, boundary } = t.params;
  const helper = new OperationContextHelper(t);

  const { srcBuffer, dstBuffer } = await t.createBuffersForReadOp(readOp, kSrcValue, kOpValue);
  await t.createIntermediateBuffersAndTexturesForWriteOp(writeOp, 0, kOpValue);

  // The write op will write the given op value into src buffer.
  // The read op will read from src buffer and write to dst buffer based on what it reads.
  // The write op happens before read op. So we are expecting the op value to be in the dst buffer.
  t.encodeWriteOp(helper, writeOp, writeContext, srcBuffer, 0, kOpValue);
  helper.ensureBoundary(boundary);
  t.encodeReadOp(helper, readOp, readContext, srcBuffer, dstBuffer);
  helper.ensureSubmit();
  // Only verify the value of the first element of the dstBuffer
  t.verifyData(dstBuffer, kOpValue);
});
//# sourceMappingURL=rw_and_wr.spec.js.map