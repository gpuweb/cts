/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ const builtin = 'clamp';
export const description = `
Validation tests for the ${builtin}() builtin.
`;
import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import {
  TypeF16,
  elementType,
  kAllFloatAndIntegerScalarsAndVectors,
} from '../../../../../util/conversion.js';
import { ShaderValidationTest } from '../../../shader_validation_test.js';

import {
  fullRangeForType,
  kConstantAndOverrideStages,
  stageSupportsType,
  validateConstOrOverrideBuiltinEval,
} from './const_override_validation.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('values')
  .desc(
    `
Validates that constant evaluation and override evaluation of ${builtin}() rejects invalid values
`
  )
  .params(u =>
    u
      .combine('stage', kConstantAndOverrideStages)
      .combine('type', kAllFloatAndIntegerScalarsAndVectors)
      .filter(u => stageSupportsType(u.stage, u.type))
      .expand('e', u => fullRangeForType(u.type, 3))
      .expand('low', u => fullRangeForType(u.type, 4))
      .expand('high', u => fullRangeForType(u.type, 4))
  )
  .beforeAllSubcases(t => {
    if (elementType(t.params.type) === TypeF16) {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    const expectedResult = t.params.low <= t.params.high;
    validateConstOrOverrideBuiltinEval(
      t,
      builtin,
      expectedResult,
      [
        t.params.type.create(t.params.e),
        t.params.type.create(t.params.low),
        t.params.type.create(t.params.high),
      ],

      t.params.stage
    );
  });
