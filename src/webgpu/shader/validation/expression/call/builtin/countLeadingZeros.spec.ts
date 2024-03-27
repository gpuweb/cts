const builtin = 'countLeadingZeros';
export const description = `
Validation tests for the ${builtin}() builtin.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { keysOf, objectsToRecord } from '../../../../../../common/util/data_tables.js';
import {
  kConcreteIntegerScalarsAndVectors,
  kFloatScalarsAndVectors,
} from '../../../../../util/conversion.js';
import { ShaderValidationTest } from '../../../shader_validation_test.js';

import {
  fullRangeForType,
  kConstantAndOverrideStages,
  stageSupportsType,
  validateConstOrOverrideBuiltinEval,
} from './const_override_validation.js';

export const g = makeTestGroup(ShaderValidationTest);

const kValuesTypes = objectsToRecord(kConcreteIntegerScalarsAndVectors);

g.test('values')
  .desc(
    `
Validates that constant evaluation and override evaluation of ${builtin}() never errors
`
  )
  .params(u =>
    u
      .combine('stage', kConstantAndOverrideStages)
      .combine('type', keysOf(kValuesTypes))
      .filter(u => stageSupportsType(u.stage, kValuesTypes[u.type]))
      .beginSubcases()
      .expand('value', u => fullRangeForType(kValuesTypes[u.type]))
  )
  .fn(t => {
    const expectedResult = true; // countLeadingZeros() should never error
    validateConstOrOverrideBuiltinEval(
      t,
      builtin,
      expectedResult,
      [kValuesTypes[t.params.type].create(t.params.value)],
      t.params.stage
    );
  });

const kFloatTypes = objectsToRecord(kFloatScalarsAndVectors);

g.test('float_argument')
  .desc(
    `
Validates that float arguments are rejected by ${builtin}()
`
  )
  .params(u => u.combine('type', keysOf(kFloatTypes)))
  .fn(t => {
    const type = kFloatTypes[t.params.type];
    validateConstOrOverrideBuiltinEval(
      t,
      builtin,
      /* expectedResult */ false,
      [type.create(0)],
      'constant'
    );
  });

const kArgCases = {
  good: '(1u)',
  bad_no_parens: '',
  // Bad number of args
  bad_too_few: '()',
  bad_too_many: '(1u,2u)',
  // Bad value for arg 0 (Note that float type arguments are handled in 'float_argument' above)
  bad_0bool: '(false)',
  bad_0array: '(array(1u))',
  bad_0struct: '(modf(2.2))',
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
  .fn(t => {
    t.expectCompileResult(false, `fn f() { ${builtin}${kArgCases['good']}; }`);
  });
