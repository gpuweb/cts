const builtin = 'normalize';
export const description = `
Validation tests for the ${builtin}() builtin.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { keysOf, objectsToRecord } from '../../../../../../common/util/data_tables.js';
import {
  Type,
  kConcreteIntegerScalarsAndVectors,
  kConvertableToFloatVectors,
  scalarTypeOf,
} from '../../../../../util/conversion.js';
import { ShaderValidationTest } from '../../../shader_validation_test.js';

import {
  fullRangeForType,
  kConstantAndOverrideStages,
  stageSupportsType,
  validateConstOrOverrideBuiltinEval,
} from './const_override_validation.js';

export const g = makeTestGroup(ShaderValidationTest);

const kValidArgumentTypes = objectsToRecord(kConvertableToFloatVectors);

// These should probably go in a utilities file somewhere?
const f32_cast_array = new Float32Array(1);
function toF32(v: number): number {
  f32_cast_array[0] = v;
  return f32_cast_array[0];
}

const f16_max = 65504;
const f16_min = -65504;
const f16_epsilon = 0.0000000596046;
function toF16(v: number): number {
  if (Math.abs(v) < f16_epsilon) {
    return 0;
  }
  if (v > f16_max) {
    return Infinity;
  }
  if (v < f16_min) {
    return -Infinity;
  }
  return v;
}

g.test('values')
  .desc(
    `
Validates that constant evaluation and override evaluation of ${builtin}() rejects invalid values
`
  )
  .params(u =>
    u
      .combine('stage', kConstantAndOverrideStages)
      .combine('type', keysOf(kValidArgumentTypes))
      .filter(u => stageSupportsType(u.stage, kValidArgumentTypes[u.type]))
      .beginSubcases()
      .expand('value', u => fullRangeForType(kValidArgumentTypes[u.type]))
  )
  .beforeAllSubcases(t => {
    if (scalarTypeOf(kValidArgumentTypes[t.params.type]) === Type.f16) {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    let expectedResult = true;

    const scalarType = scalarTypeOf(kValidArgumentTypes[t.params.type]);

    let castFn;
    switch (scalarType) {
      case Type.f32:
        castFn = toF32;
        break;
      case Type.f16:
        castFn = toF16;
        break;
      default:
        castFn = (v: number) => v;
        break;
    }

    // Should be invalid if the normalization calculations result in intermediate
    // values that exceed the maximum representable float value for the given type,
    // or if the length is smaller than the smallest representable float value.
    const v = Number(t.params.value);
    const vv = castFn(v * v);
    const dp = castFn(vv * kValidArgumentTypes[t.params.type].width);
    const len = castFn(Math.sqrt(dp));
    if (vv === Infinity || dp === Infinity || len === 0) {
      expectedResult = false;
    }

    validateConstOrOverrideBuiltinEval(
      t,
      builtin,
      expectedResult,
      [kValidArgumentTypes[t.params.type].create(t.params.value)],
      t.params.stage
    );
  });

const kInvalidArgumentTypes = objectsToRecord([
  Type.f32,
  Type.f16,
  Type.abstractInt,
  Type.bool,
  Type.vec(2, Type.bool),
  Type.vec(3, Type.bool),
  Type.vec(4, Type.bool),
  ...kConcreteIntegerScalarsAndVectors,
]);

g.test('invalid_argument')
  .desc(
    `
Validates that all scalar arguments and vector integer or boolean arguments are rejected by ${builtin}()
`
  )
  .params(u => u.combine('type', keysOf(kInvalidArgumentTypes)))
  .beforeAllSubcases(t => {
    if (kInvalidArgumentTypes[t.params.type] === Type.f16) {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    const expectedResult = false; // should always error with invalid argument types
    validateConstOrOverrideBuiltinEval(
      t,
      builtin,
      expectedResult,
      [kInvalidArgumentTypes[t.params.type].create(0)],
      'constant'
    );
  });

const kArgCases = {
  good: '(vec3f(1, 0, 0))',
  bad_no_parens: '',
  // Bad number of args
  bad_0args: '()',
  bad_2args: '(vec3f(),vec3f())',
  // Bad value for arg 0
  bad_0array: '(array(1.1,2.2))',
  bad_0struct: '(modf(2.2))',
};

g.test('args')
  .desc(`Test compilation failure of ${builtin}  with variously shaped and typed arguments`)
  .params(u => u.combine('arg', keysOf(kArgCases)))
  .fn(t => {
    t.expectCompileResult(
      t.params.arg === 'good',
      `const c = ${builtin}${kArgCases[t.params.arg]};`
    );
  });

g.test('must_use')
  .desc(`Result of ${builtin} must be used`)
  .params(u => u.combine('use', [true, false]))
  .fn(t => {
    const use_it = t.params.use ? '_ = ' : '';
    t.expectCompileResult(false, `fn f() { ${use_it}${builtin}${kArgCases['good']}; }`);
  });
