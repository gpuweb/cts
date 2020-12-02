export const description = `
TODO:
- 2 views: upon the same subresource, or different subresources of the same texture
    - texture usages in copies and in render pass
    - consecutively set bind groups on the same index
    - unused bind groups
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { ValidationTest } from '../../validation_test.js';

export const g = makeTestGroup(ValidationTest);
