export const description = `
Tests writeBuffer validation.

- buffer missing usage flag
- bufferOffset {ok, unaligned, too large for buffer}
- dataOffset {ok, too large for data}
- buffer size {ok, too small for copy}
- data size {ok, too small for copy}
- size {aligned, unaligned}
- size unspecified; default {ok, too large for buffer}

Note: destroyed buffer is tested in destroyed/.

TODO: implement.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ValidationTest } from '../validation_test.js';

export const g = makeTestGroup(ValidationTest);
