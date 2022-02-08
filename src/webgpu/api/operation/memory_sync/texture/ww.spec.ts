export const description = `
Memory Synchronization Tests for Texture: write after write.

- TODO: Test synchronization between multiple queues.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';

import {
  kOperationBoundaries,
  kBoundaryInfo,
  kAllWriteOps,
  checkOpsValidForContext,
} from './texture_sync_test.js';

export const g = makeTestGroup(GPUTest);

g.test('ww')
  .desc(
    `
    Perform a 'first' write operation on a texture, followed by a 'second' write operation.
    Operations are separated by a 'boundary' (pass, encoder, queue-op, etc.).
    Test that the results are synchronized.
    If overlapping, the second write should overwrite the contents of the first.`
  )
  .params(u =>
    u
      .combine('boundary', kOperationBoundaries)
      .expand('_context', p => kBoundaryInfo[p.boundary].contexts)
      .expandWithParams(function* ({ _context }) {
        for (const first of kAllWriteOps) {
          for (const second of kAllWriteOps) {
            if (checkOpsValidForContext([first, second], _context)) {
              yield {
                first: { op: first, in: _context[0] },
                second: { op: second, in: _context[1] },
              };
            }
          }
        }
      })
  )
  .unimplemented();
