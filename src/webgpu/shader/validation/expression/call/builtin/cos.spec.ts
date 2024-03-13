const builtin = 'cos';
export const description = `
Validation tests for the ${builtin}() builtin.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { keysOf, objectsToRecord } from '../../../../../../common/util/data_tables.js';
import {
  Type,
  kConcreteIntegerScalarsAndVectors,
  kConvertableToFloatScalarsAndVectors,
  scalarTypeOf,
} from '../../../../../util/conversion.js';
import { ShaderValidationTest } from '../../../shader_validation_test.js';

import {
  fullRangeForType,
  kConstantAndOverrideStages,
  minusThreePiToThreePiRangeForType,
  stageSupportsType,
  unique,
  validateConstOrOverrideBuiltinEval,
} from './const_override_validation.js';

export const g = makeTestGroup(ShaderValidationTest);

const kValuesTypes = objectsToRecord(kConvertableToFloatScalarsAndVectors);

g.test('values')
  .desc(
    `
Validates that constant evaluation and override evaluation of ${builtin}() rejects invalid values
`
  )
  .params(u =>
    u
      .combine('stage', kConstantAndOverrideStages)
      .combine('type', keysOf(kValuesTypes))
      .filter(u => stageSupportsType(u.stage, kValuesTypes[u.type]))
      .beginSubcases()
      .expand('value', u =>
        unique(
          minusThreePiToThreePiRangeForType(kValuesTypes[u.type]),
          fullRangeForType(kValuesTypes[u.type])
        )
      )
  )
  .beforeAllSubcases(t => {
    if (scalarTypeOf(kValuesTypes[t.params.type]) === Type.f16) {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    validateConstOrOverrideBuiltinEval(
      t,
      builtin,
      /* expectedResult */ true,
      [kValuesTypes[t.params.type].create(t.params.value)],
      t.params.stage
    );
  });

const kIntegerArgumentTypes = objectsToRecord([Type.f32, ...kConcreteIntegerScalarsAndVectors]);

g.test('integer_argument')
  .desc(
    `
Validates that scalar and vector integer arguments are rejected by ${builtin}()
`
  )
  .params(u => u.combine('type', keysOf(kIntegerArgumentTypes)))
  .fn(t => {
    const type = kIntegerArgumentTypes[t.params.type];
    validateConstOrOverrideBuiltinEval(
      t,
      builtin,
      /* expectedResult */ type === Type.f32,
      [type.create(0)],
      'constant'
    );
  });

const kGoodArgs = '(1.1)';
const kBadArgs = {
  no_parens: '',
  // Bad number of args
  '0args': '()',
  '2args': '(1.0,2.0)',
  // Bad value for arg 0
  '0i32': '(1i)',
  '0u32': '(1u)',
  '0bool': '(false)',
  '0vec2u': '(vec2u())',
  '0array': '(array(1.1,2.2))',
  '0struct': '(modf(2.2))',
};

g.test('bad_args')
  .desc(`Test compilation failure of ${builtin} with bad arguments`)
  .params(u => u.combine('arg', keysOf(kBadArgs)))
  .fn(t => {
    t.expectCompileResult(false, `const c = ${builtin}${kBadArgs[t.params.arg]};`);
  });

g.test('must_use')
  .desc(`Result of ${builtin} must be used`)
  .params(u => u.combine('use', [true, false]))
  .fn(t => {
    const use_it = t.params.use ? '_ = ' : '';
    t.expectCompileResult(t.params.use, `fn f() { ${use_it}${builtin}${kGoodArgs}; }`);
  });
