/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/const builtin = 'sign';export const description = `
Validation tests for the ${builtin}() builtin.
`;
import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import {
TypeF16,
TypeF32,
elementType,
kAllFloatAndSignedIntegerScalarsAndVectors,
kAllUnsignedIntegerScalarsAndVectors } from
'../../../../../util/conversion.js';
import { ShaderValidationTest } from '../../../shader_validation_test.js';

import {
fullRangeForType,
kConstantAndOverrideStages,
stageSupportsType,
validateConstOrOverrideBuiltinEval } from
'./const_override_validation.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('values').
desc(
`
Validates that constant evaluation and override evaluation of ${builtin}() inputs rejects invalid values
`).

params((u) =>
u.
combine('stage', kConstantAndOverrideStages).
combine('type', kAllFloatAndSignedIntegerScalarsAndVectors).
filter((u) => stageSupportsType(u.stage, u.type)).
expand('value', (u) => fullRangeForType(u.type))).

beforeAllSubcases((t) => {
  if (elementType(t.params.type) === TypeF16) {
    t.selectDeviceOrSkipTestCase('shader-f16');
  }
}).
fn((t) => {
  const expectedResult = true; // Result should always be representable by the type
  validateConstOrOverrideBuiltinEval(
  t,
  builtin,
  expectedResult,
  [t.params.type.create(t.params.value)],
  t.params.stage);

});

g.test('unsigned_integer_argument').
desc(
`
Validates that scalar and vector integer arguments are rejected by ${builtin}()
`).

params((u) => u.combine('type', [TypeF32, ...kAllUnsignedIntegerScalarsAndVectors])).
fn((t) => {
  validateConstOrOverrideBuiltinEval(
  t,
  builtin,
  /* expectedResult */t.params.type === TypeF32,
  [t.params.type.create(1)],
  'constant');

});
//# sourceMappingURL=sign.spec.js.map