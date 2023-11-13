export const description = 'Description for c.spec.ts';

import { makeTestGroup } from '../../../common/framework/test_group.js';
import { UnitTest } from '../../../unittests/unit_test.js';

export const g = makeTestGroup(UnitTest);

g.test('f')
  .desc(
    `Test plan for f
    - Test stuff
    - Test some more stuff`
  )
  .fn(() => {});

g.test('f,g').fn(() => {});

g.test('f,g,h')
  .paramsSimple([{}, { x: 0 }, { x: 0, y: 0 }])
  .fn(() => {});

g.test('case_depth_2_in_single_child_test')
  .paramsSimple([{ x: 0, y: 0 }])
  .fn(() => {});

g.test('deep_case_tree')
  .params(u =>
    u //
      .combine('x', [1, 2])
      .combine('y', [1, 2])
      .combine('z', [1, 2])
  )
  .fn(() => {});
