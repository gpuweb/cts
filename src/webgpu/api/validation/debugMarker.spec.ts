export const description = `
Test validation of pushDebugGroup, popDebugGroup, and insertDebugMarker.
`;

import { makeTestGroup } from '../../../common/framework/test_group.js';

import { ValidationTest } from './validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('push_pop_call_count_unbalance')
  .desc(
    `
  Test that a validation error is generated if {push,pop} debug group call count is not paired.
  `
  )
  .paramsSubcasesOnly(u =>
    u //
      .combine('pushCount', [1, 2, 3])
      .combine('popCount', [1, 2, 3])
  )
  .fn(async t => {
    const { pushCount, popCount } = t.params;

    const encoder = t.device.createCommandEncoder();

    for (let i = 0; i < pushCount; ++i) {
      encoder.pushDebugGroup('EventStart');
    }

    encoder.insertDebugMarker('Marker');

    for (let i = 0; i < popCount; ++i) {
      encoder.popDebugGroup();
    }

    t.expectValidationError(() => {
      encoder.finish();
    }, pushCount !== popCount);
  });
