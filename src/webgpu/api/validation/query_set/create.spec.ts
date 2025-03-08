export const description = `
Tests for validation in createQuerySet.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { kQueryTypes, kMaxQueryCount } from '../../../capability_info.js';
import { AllFeaturesMaxLimitsValidationTest } from '../validation_test.js';

export const g = makeTestGroup(AllFeaturesMaxLimitsValidationTest);

g.test('count')
  .desc(
    `
Tests that create query set with the count for all query types:
- count {<, =, >} kMaxQueryCount
- x= {occlusion, timestamp} query
  `
  )
  .params(u =>
    u
      .combine('type', kQueryTypes)
      .beginSubcases()
      .combine('count', [0, kMaxQueryCount, kMaxQueryCount + 1])
  )
  .fn(t => {
    const { type, count } = t.params;
    t.skipIfDeviceDoesNotSupportQueryType(type);

    t.expectValidationError(() => {
      t.createQuerySetTracked({ type, count });
    }, count > kMaxQueryCount);
  });
