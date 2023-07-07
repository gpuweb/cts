/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ const builtin = 'abs';
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
Validates that constant evaluation and override evaluation of ${builtin}() never errors
`
  )
  .params(u =>
    u
      .combine('stage', kConstantAndOverrideStages)
      .combine('type', kAllFloatAndIntegerScalarsAndVectors)
      .filter(u => stageSupportsType(u.stage, u.type))
      .expand('value', u => fullRangeForType(u.type))
  )
  .beforeAllSubcases(t => {
    if (elementType(t.params.type) === TypeF16) {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    const expectedResult = true; // abs() should never error
    validateConstOrOverrideBuiltinEval(
      t,
      builtin,
      expectedResult,
      [t.params.type.create(t.params.value)],
      t.params.stage
    );
  });
