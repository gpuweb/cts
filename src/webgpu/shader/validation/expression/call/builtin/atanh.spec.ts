export const description = `
Validation tests for the atanh() builtin.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import {
  TypeF16,
  TypeF32,
  elementType,
  kAllFloatScalarsAndVectors,
  kAllIntegerScalarsAndVectors,
} from '../../../../../util/conversion.js';
import { ShaderValidationTest } from '../../../shader_validation_test.js';

import {
  kConstantAndOverrideStages,
  kMinusOneToTwo,
  validateConstOrOverrideBuiltinEval,
} from './const_override_validation.js';

export const g = makeTestGroup(ShaderValidationTest);

const builtin = 'atanh';

g.test('values')
  .desc(
    `
Validates that constant evaluation and override evaluation of atanh() rejects invalid values
`
  )
  .params(u =>
    u
      .combine('stage', kConstantAndOverrideStages)
      .combine('type', kAllFloatScalarsAndVectors)
      .combine('value', kMinusOneToTwo)
  )
  .beforeAllSubcases(t => {
    if (elementType(t.params.type) === TypeF16) {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    const expectedResult = Math.abs(t.params.value) < 1;
    validateConstOrOverrideBuiltinEval(
      t,
      builtin,
      expectedResult,
      t.params.value,
      t.params.type,
      t.params.stage
    );
  });

g.test('reject_integer_arguments')
  .desc(
    `
Validates that scalar and vector integer arguments are rejected
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
