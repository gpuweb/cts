const builtin = 'refract';
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
      .expand('c', u => fullRangeForType(kValidArgumentTypes[u.type], 5))
  )
  .beforeAllSubcases(t => {
    if (scalarTypeOf(kValidArgumentTypes[t.params.type]) === Type.f16) {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    let expectedResult = true;

    const type = kValidArgumentTypes[t.params.type];
    const scalarType = scalarTypeOf(kValidArgumentTypes[t.params.type]);
    const quantizeFn = quantizeFunctionForScalarType(scalarType);

    // Refract equation:
    //   let k = 1.0 - c * c * (1.0 - dot(b, a) * dot(b, a))
    //   if (k < 0.0) { return vecN(0.0); }
    //   return c * a - (c * dot(b, a) + sqrt(k)) * b
    // Should be invalid if the calculations result in intermediate values that
    // exceed the maximum representable float value for the given type.
    const a = Number(t.params.a);
    const b = Number(t.params.b);
    const c = Number(t.params.c);

    const b_dot_a = quantizeFn(b * a * type.width);
    const b_dot_a_2 = quantizeFn(b_dot_a * b_dot_a);
    const c2 = quantizeFn(c * c);
    const one_minus_b_dot_a_2 = quantizeFn(1.0 - b_dot_a_2);
    const c2_one_minus_b_dot_a_2 = quantizeFn(c2 * one_minus_b_dot_a_2);
    const k = quantizeFn(1.0 - c2_one_minus_b_dot_a_2);

    if (
      !Number.isFinite(b_dot_a) ||
      !Number.isFinite(b_dot_a_2) ||
      !Number.isFinite(c2) ||
      !Number.isFinite(one_minus_b_dot_a_2) ||
      !Number.isFinite(c2_one_minus_b_dot_a_2) ||
      !Number.isFinite(k)
    ) {
      expectedResult = false;
    }

    if (k >= 0) {
      const ca = quantizeFn(c * a);
      const cbda = quantizeFn(c * b_dot_a);
      const sqrt_k = quantizeFn(Math.sqrt(k));
      const cdba_sqrt_k = quantizeFn(cbda + sqrt_k);
      const cdba_sqrt_k_b = quantizeFn(cdba_sqrt_k * b);
      const result = quantizeFn(ca - cdba_sqrt_k_b);

      if (
        !Number.isFinite(ca) ||
        !Number.isFinite(cbda) ||
        !Number.isFinite(sqrt_k) ||
        !Number.isFinite(cdba_sqrt_k) ||
        !Number.isFinite(cdba_sqrt_k_b) ||
        !Number.isFinite(result)
      ) {
        expectedResult = false;
      }
    }

    // Validates refract(vecN(a), vecN(b), c);
    validateConstOrOverrideBuiltinEval(
      t,
      builtin,
      expectedResult,
      [type.create(t.params.a), type.create(t.params.b), scalarType.create(t.params.c)],
      t.params.stage
    );
  });

const kArgCases = {
  good: '(vec3(0), vec3(1), 2.0)',
  bad_no_parens: '',
  // Bad number of args
  bad_0args: '()',
  bad_1arg: '(vec3(0))',
  bad_2arg: '(vec3(0), vec3(1))',
  bad_3arg: '(vec3(0), vec3(1), 2.0, vec3(3))',
  // Mismatched vec sizes
  bad_vec2_vec3: '(vec2(0), vec3(1), 2.0)',
  bad_vec3_vec4: '(vec3(0), vec4(1), 2.0)',
  bad_vec4_vec2: '(vec4(0), vec2(1), 2.0)',
  // Bad value for arg 0
  bad_0bool: '(false, vec3(1), 2.0)',
  bad_0array: '(array(1.1,2.2), vec3(1), 2.0)',
  bad_0struct: '(modf(2.2), vec3(1), 2.0)',
  bad_0int: '(0i, vec3(1), 2.0)',
  bad_0uint: '(0u, vec3(1), 2.0)',
  bad_0f32: '(0.0, vec3(1), 2.0)',
  bad_0f16: '(0.0h, vec3(1), 2.0)',
  bad_0veci: '(vec3i(0), vec3(1), 2.0)',
  bad_0vecu: '(vec3u(0), vec3(1), 2.0)',
  // Bad value type for arg 1
  bad_1bool: '(vec3(0), true, 2.0)',
  bad_1array: '(vec3(0), array(1.1,2.2), 2.0)',
  bad_1struct: '(vec3(0), modf(2.2), 2.0)',
  bad_1int: '(vec3(0), 1i, 2.0)',
  bad_1uint: '(vec3(0), 1u, 2.0)',
  bad_1f32: '(vec3(0), 1.0, 2.0)',
  bad_1f16: '(vec3(0), 1.0h, 2.0)',
  bad_1veci: '(vec3(0), vec3i(1), 2.0)',
  bad_1vecu: '(vec3(0), vec3u(1), 2.0)',
  // Bad value type for arg 2
  bad_2bool: '(vec3(0), vec3(1), true)',
  bad_2array: '(vec3(0), vec3(1), array(1.1,2.2))',
  bad_2struct: '(vec3(0), vec3(1), modf(2.2))',
  bad_2int: '(vec3(0), vec3(1), 2i)',
  bad_2uint: '(vec3(0), vec3(1), 2u)',
  bad_2veci: '(vec3(0), vec3(1), vec3i(2))',
  bad_2vecu: '(vec3(0), vec3(1), vec3u(2))',
  bad_2vecf: '(vec3(0), vec3(1), vec3f(2))',
  bad_2vech: '(vec3(0), vec3(1), vec3h(2))',
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
