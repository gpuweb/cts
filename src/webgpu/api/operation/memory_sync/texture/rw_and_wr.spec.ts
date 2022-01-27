export const description = `
Memory Synchronization Tests for Texture: read before write and read after write.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';

import {
  kOperationBoundaries,
  kBoundaryInfo,
  kAllReadOps,
  kAllWriteOps,
  checkOpsValidForContext,
} from './texture_sync_test.js';

export const g = makeTestGroup(GPUTest);

g.test('rw')
  .desc(
    `
    Perform a 'read' operations on a texture, followed by a 'write' operation.
    Operations are separated by a 'boundary' (pass, encoder, queue-op, etc.).
    Test that the results are synchronized.
    The read should not see the contents written by the subsequent write.`
  )
  .params(u =>
    u
      .combine('boundary', kOperationBoundaries)
      .expand('_context', p => kBoundaryInfo[p.boundary].contexts)
      .expandWithParams(function* ({ _context }) {
        for (const read of kAllReadOps) {
          for (const write of kAllWriteOps) {
            if (checkOpsValidForContext([read, write], _context)) {
              yield {
                write: {
                  op: write,
                  in: _context[0],
                },
                read: {
                  op: read,
                  in: _context[1],
                },
              };
            }
          }
        }
      })
  )
  .unimplemented();

g.test('wr')
  .desc(
    `
    Perform a 'write' operation on a texture, followed by a 'read' operation.
    Operations are separated by a 'boundary' (pass, encoder, queue-op, etc.).
    Test that the results are synchronized.
    The read should see exactly the contents written by the previous write.`
  )
  .params(u =>
    u
      .combine('boundary', kOperationBoundaries)
      .expand('_context', p => kBoundaryInfo[p.boundary].contexts)
      .expandWithParams(function* ({ _context }) {
        for (const read of kAllReadOps) {
          for (const write of kAllWriteOps) {
            if (checkOpsValidForContext([write, read], _context)) {
              yield {
                read: {
                  op: read,
                  in: _context[0],
                },
                write: {
                  op: write,
                  in: _context[1],
                },
              };
            }
          }
        }
      })
  )
  .unimplemented();
