export const description = `
Tests for capability checking for features enabling optional query types.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { ValidationTest } from '../../validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('createQuerySet')
  .desc(
    `
  Tests that creating a query set throws a type error exception if the features don't contain
  'timestamp-query'.
    - createQuerySet
      - type {occlusion, timestamp}
      - x= {pipeline statistics, timestamp} query {enable, disable}
  `
  )
  .params(u =>
    u
      .combine('type', ['occlusion', 'timestamp'] as const)
      .combine('featureContainsTimestampQuery', [false, true])
  )
  .beforeAllSubcases(t => {
    const { featureContainsTimestampQuery } = t.params;

    const requiredFeatures: GPUFeatureName[] = [];
    if (featureContainsTimestampQuery) {
      requiredFeatures.push('timestamp-query');
    }

    t.selectDeviceOrSkipTestCase({ requiredFeatures });
  })
  .fn(async t => {
    const { type, featureContainsTimestampQuery } = t.params;

    const count = 1;
    const shouldException = type === 'timestamp' && !featureContainsTimestampQuery;

    t.shouldThrow(shouldException ? 'TypeError' : false, () => {
      t.device.createQuerySet({ type, count });
    });
  });
