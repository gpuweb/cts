const builtin = 'atan2';
export const description = `
Validation tests for the ${builtin}() builtin.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import {
  TypeF16,
  TypeF32,
  Vector,
  VectorType,
  elementType,
  kAllFloatScalarsAndVectors,
  kAllIntegerScalarsAndVectors,
} from '../../../../../util/conversion.js';
import { isRepresentable } from '../../../../../util/floating_point.js';
import { ShaderValidationTest } from '../../../shader_validation_test.js';

import {
  fullRangeForType,
  kConstantAndOverrideStages,
  kMinus3PiTo3Pi,
  stageSupportsType,
  unique,
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
      .beginSubcases()
      .expand('y', u => unique(kMinus3PiTo3Pi, fullRangeForType(u.type, 4)))
      .expand('x', u => unique(kMinus3PiTo3Pi, fullRangeForType(u.type, 4)))
  )
  .beforeAllSubcases(t => {
    if (elementType(t.params.type) === TypeF16) {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    const expectedResult =
      true ||
      isRepresentable(Math.abs(Math.atan2(t.params.y, t.params.x)), elementType(t.params.type));
    validateConstOrOverrideBuiltinEval(
      t,
      builtin,
      expectedResult,
      [t.params.type.create(t.params.y), t.params.type.create(t.params.x)],
      t.params.stage
    );
  });

g.test('integer_argument_y')
  .desc(
    `
Validates that scalar and vector integer arguments are rejected by ${builtin}()
`
  )
  .params(u => u.combine('type', [TypeF32, ...kAllIntegerScalarsAndVectors]))
  .fn(t => {
    const yTy = t.params.type;
    const xTy = yTy instanceof Vector ? new VectorType(yTy.size, TypeF32) : TypeF32;
    validateConstOrOverrideBuiltinEval(
      t,
      builtin,
      /* expectedResult */ t.params.type === TypeF32,
      [yTy.create(1), xTy.create(1)],
      'constant'
    );
  });

g.test('integer_argument_x')
  .desc(
    `
Validates that scalar and vector integer arguments are rejected by ${builtin}()
`
  )
  .params(u => u.combine('type', [TypeF32, ...kAllIntegerScalarsAndVectors]))
  .fn(t => {
    const xTy = t.params.type;
    const yTy = xTy instanceof Vector ? new VectorType(xTy.size, TypeF32) : TypeF32;
    validateConstOrOverrideBuiltinEval(
      t,
      builtin,
      /* expectedResult */ t.params.type === TypeF32,
      [yTy.create(1), xTy.create(1)],
      'constant'
    );
  });
