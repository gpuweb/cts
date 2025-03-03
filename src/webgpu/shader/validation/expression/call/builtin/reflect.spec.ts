const builtin = 'reflect';
export const description = `
Validation tests for the ${builtin}() builtin.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { keysOf, objectsToRecord } from '../../../../../../common/util/data_tables.js';
import {
  Type,
  kConvertableToFloatVectors,
  scalarTypeOf,
  ScalarType,
} from '../../../../../util/conversion.js';
import { QuantizeFunc, quantizeToF16, quantizeToF32 } from '../../../../../util/math.js';
import { ShaderValidationTest } from '../../../shader_validation_test.js';

import {
  fullRangeForType,
  kConstantAndOverrideStages,
  stageSupportsType,
  validateConstOrOverrideBuiltinEval,
} from './const_override_validation.js';

export const g = makeTestGroup(ShaderValidationTest);

const kValidArgumentTypes = objectsToRecord(kConvertableToFloatVectors);

function quantizeFunctionForScalarType(type: ScalarType): QuantizeFunc<number> {
  switch (type) {
    case Type.f32:
      return quantizeToF32;
    case Type.f16:
      return quantizeToF16;
    default:
      return (v: number) => v;
  }
}

g.test('values')
  .desc(
    `
Validates that constant evaluation and override evaluation of ${builtin}() never errors
`
  )
  .params(u =>
    u
      .combine('stage', kConstantAndOverrideStages)
      .combine('type', keysOf(kValidArgumentTypes))
      .filter(u => stageSupportsType(u.stage, kValidArgumentTypes[u.type]))
      .beginSubcases()
      .expand('a', u => fullRangeForType(kValidArgumentTypes[u.type], 5))
      .expand('b', u => fullRangeForType(kValidArgumentTypes[u.type], 5))
  )
  .fn(t => {
    let expectedResult = true;

    const scalarType = scalarTypeOf(kValidArgumentTypes[t.params.type]);
    const quantizeFn = quantizeFunctionForScalarType(scalarType);
    // Reflect equation: a - 2 * dot(b, a) * b
    // Should be invalid if the reflect calculations result in intermediate
    // values that exceed the maximum representable float value for the given type.
    const a = Number(t.params.a);
    const b = Number(t.params.b);
    const ab = quantizeFn(a * b);
    const dp = quantizeFn(ab * kValidArgumentTypes[t.params.type].width);
    const dp2 = quantizeFn(dp * 2);
    const dp2b = quantizeFn(dp2 * b);
    const a_dp2b = quantizeFn(a - dp2b);

    if (
      !Number.isFinite(ab) ||
      !Number.isFinite(dp) ||
      !Number.isFinite(dp2) ||
      !Number.isFinite(dp2b) ||
      !Number.isFinite(a_dp2b)
    ) {
      expectedResult = false;
    }

    const type = kValidArgumentTypes[t.params.type];

    // Validates reflect(vecN(a, a, a), vecN(b, b, b));
    validateConstOrOverrideBuiltinEval(
      t,
      builtin,
      expectedResult,
      [type.create(t.params.a), type.create(t.params.b)],
      t.params.stage
    );
  });

const kArgCases = {
  good: '(vec3(0), vec3(1))',
  bad_no_parens: '',
  // Bad number of args
  bad_0args: '()',
  bad_1arg: '(vec3(0))',
  bad_3arg: '(vec3(0), vec3(1), vec3(2))',
  // Bad value for arg 0
  bad_0bool: '(false, vec3(1))',
  bad_0array: '(array(1.1,2.2), vec3(1))',
  bad_0struct: '(modf(2.2), vec3(1))',
  // Bad value type for arg 1
  bad_1bool: '(vec3(0), true)',
  bad_1array: '(vec3(0), array(1.1,2.2))',
  bad_1struct: '(vec3(0), modf(2.2))',
};

g.test('args')
  .desc(`Test compilation failure of ${builtin} with variously shaped and typed arguments`)
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
    t.expectCompileResult(t.params.use, `fn f() { ${use_it}${builtin}${kArgCases['good']}; }`);
  });
