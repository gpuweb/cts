export const description = `
Tests submit validation.

Note: destroyed buffer/texture/querySet are tested in destroyed/.
Note: buffer map state is tested in ./buffer_mapped.spec.ts.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ValidationTest } from '../validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('command_buffer,device_mismatch')
  .desc(
    `
    Tests submit cannot be called with command buffers created from another device
    - two command buffers from same device
    - two command buffers from different device
    `
  )
  .paramsSubcasesOnly(u => u.combine('mismatched', [true, false]))
  .unimplemented();
