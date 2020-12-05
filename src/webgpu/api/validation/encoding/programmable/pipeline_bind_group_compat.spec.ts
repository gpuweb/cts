export const description = `
TODO:
- test compatibility between bind groups and pipelines
    - bind groups required by the pipeline layout are required.
    - bind groups unused by the pipeline layout can be set or not.
        (Even if e.g. bind groups 0 and 2 are used, but 1 is unused.)
    - bindGroups[i].layout is "group-equivalent" (value-equal) to pipelineLayout.bgls[i].
    - in the test fn, test once without the dispatch/draw (should always be valid) and once with
      the dispatch/draw, to make sure the validation happens in dispatch/draw.
    - x= {dispatch, all draws} (dispatch/draw should be size 0 to make sure validation still happens if no-op)
    - x= all relevant stages
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { ValidationTest } from '../../validation_test.js';

export const g = makeTestGroup(ValidationTest);
