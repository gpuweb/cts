/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ const builtin = 'exp';
export const description = `
Validation tests for the ${builtin}() builtin.
`;
import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { kValue } from '../../../../../util/constants.js';
import {
  TypeF16,
  TypeF32,
  elementType,
  kAllFloatScalarsAndVectors,
  kAllIntegerScalarsAndVectors,
} from '../../../../../util/conversion.js';
import { isRepresentable } from '../../../../../util/floating_point.js';
import { ShaderValidationTest } from '../../../shader_validation_test.js';

import {
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
      .combine('type', kAllFloatScalarsAndVectors)
      .filter(u => stageSupportsType(u.stage, u.type))
      .combine('value', [
        -1e2,
        -1e3,
        -4,
        -3,
        -2,
        -1,
        -1e-1,
        -1e-2,
        -1e-3,
        0,
        1e-3,
        1e-2,
        1e-1,
        1,
        2,
        3,
        4,
        1e2,
        1e3,
        Math.log2(kValue.f16.positive.max) - 0.1,
        Math.log2(kValue.f16.positive.max) + 0.1,
        Math.log2(kValue.f32.positive.max) - 0.1,
        Math.log2(kValue.f32.positive.max) + 0.1,
      ])
  )
  .beforeAllSubcases(t => {
    if (elementType(t.params.type) === TypeF16) {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    const expectedResult = isRepresentable(Math.exp(t.params.value), t.params.type);
    validateConstOrOverrideBuiltinEval(
      t,
      builtin,
      expectedResult,
      t.params.value,
      t.params.type,
      t.params.stage
    );
  });

g.test('integer_argument')
  .desc(
    `
Validates that scalar and vector integer arguments are rejected by ${builtin}()
`
  )
  .params(u => u.combine('type', [TypeF32, ...kAllIntegerScalarsAndVectors]))
  .fn(t => {
    validateConstOrOverrideBuiltinEval(
      t,
      builtin,
      /* expectedResult */ t.params.type === TypeF32,
      /* value */ 0,
      t.params.type,
      'constant'
    );
  });
