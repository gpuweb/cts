export const description = `
Memory Synchronization Tests for Buffer: write after write.

- Test write-after-write on a single buffer. Create one single buffer and initialize it to 0.
Write a number (say 1) into the buffer via render pass, compute pass, or copy. Write another
number (say 2) into the same buffer via render pass, compute pass, or copy.
  - x= 1st write type: {storage buffer in {render, compute}, T2B, B2B, WriteBuffer}
  - x= 2nd write type: {storage buffer in {render, compute}, T2B, B2B, WriteBuffer}
  - for each write, if render, x= {bundle, non-bundle}
  - if pass type is the same, x= {single pass, separate passes} (note: render has loose guarantees)
  - if not single pass, x= writes in {same cmdbuf, separate cmdbufs, separate submits, separate queues}
`;

import { pbool, poptions, params } from '../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { assert } from '../../../../../common/framework/util/util.js';

import { BufferSyncTest } from './buffer_sync_test.js';

export const g = makeTestGroup(BufferSyncTest);

g.test('write_after_write')
  .desc(
    `Test write-after-write operations. The first write will write 1 into a writable buffer.
    The second write will write 2 into the same buffer. So, expected data in buffer is 2.
    The two writes can be in the same command buffer, or separate command buffers, or separate
    submits, or separate queues. Each write operation can be done via render, compute, copy,
    writeBuffer, etc. If the write operation is done by a render pass, it may use bundle.`
  )
  .params(
    params()
      // TODO (yunchao.he@intel.com): add multi-queue.
      .combine(
        poptions('writeScopes', ['sameCmdbuf', 'separateCmdbufs', 'separateSubmits'] as const)
      )
      .combine(
        poptions('firstWriteOp', [
          'render',
          'compute',
          'b2bCopy',
          't2bCopy',
          'writeBuffer',
        ] as const)
      )
      .combine(
        poptions('secondWriteOp', [
          'render',
          'compute',
          'b2bCopy',
          't2bCopy',
          'writeBuffer',
        ] as const)
      )
      .combine(pbool('firstWriteInBundle'))
      .combine(pbool('secondWriteInBundle'))
      .unless(
        p =>
          (p.firstWriteInBundle && p.firstWriteOp !== 'render') ||
          (p.secondWriteInBundle && p.secondWriteOp !== 'render') ||
          ((p.firstWriteOp === 'writeBuffer' || p.secondWriteOp === 'writeBuffer') &&
            p.writeScopes !== 'separateSubmits')
      )
  )
  .fn(async t => {
    const {
      writeScopes,
      firstWriteOp,
      secondWriteOp,
      firstWriteInBundle,
      secondWriteInBundle,
    } = t.params;

    const buffer = await t.createBufferWithValue(0);

    const writeInBundle = [firstWriteInBundle, secondWriteInBundle];
    const writeOp = [firstWriteOp, secondWriteOp];
    switch (writeScopes) {
      case 'sameCmdbuf': {
        const encoder = t.device.createCommandEncoder();
        for (let i = 0; i < 2; i++) {
          await t.issueWriteOp(writeOp[i], writeInBundle[i], buffer, i + 1, encoder);
        }
        t.device.defaultQueue.submit([encoder.finish()]);
        break;
      }
      case 'separateCmdbufs': {
        const command_buffers: GPUCommandBuffer[] = [];
        for (let i = 0; i < 2; i++) {
          command_buffers.push(
            await t.createCommandBufferAndIssueWriteOp(writeOp[i], writeInBundle[i], buffer, i + 1)
          );
        }
        t.device.defaultQueue.submit(command_buffers);
        break;
      }
      case 'separateSubmits': {
        for (let i = 0; i < 2; i++) {
          await t.createQueueSubmitsAndIssueWriteOp(writeOp[i], writeInBundle[i], buffer, i + 1);
        }
        break;
      }
      default:
        assert(true);
        break;
    }

    t.verifyData(buffer, 2);
  });

g.test('write_after_write,two_draws_in_the_same_render_pass')
  .desc(
    `Test write-after-write operations in the same render pass. The first write will write 1 into
    a storage buffer. The second write will write 2 into the same buffer in the same pass. Expected
    data in buffer is either 1 or 2. It may use bundle in each draw.`
  )
  .unimplemented();

g.test('write_after_write,two_dispatches_in_the_same_compute_pass')
  .desc(
    `Test write-after-write operations in the same compute pass. The first write will write 1 into
    a storage buffer. The second write will write 2 into the same buffer in the same pass. Expected
    data in buffer is 2.`
  )
  .unimplemented();
