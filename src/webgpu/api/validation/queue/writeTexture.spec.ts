export const description = `
Tests writeTexture validation.

- texture missing usage flag
- destination.mipLevel is {ok, too large}
- destination.origin is {ok, too large}
- destination.origin+size is {ok, too large}
- dataLayout+size don't fit data
    - offset too large
    - layout reaches past end of data (trailing padding not included)

All x= {1d, 2d, 3d}, {1,>1} mipmap levels, {1,>1} array layers

Note: many of these are synchronous errors.
Note: destroyed texture is tested in destroyed/.

TODO: implement.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ValidationTest } from '../validation_test.js';

export const g = makeTestGroup(ValidationTest);
