const builtin = 'countOneBits';
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
    const expectedResult = true; // countOneBits() should never error
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

const kGoodArgs = '(1u)';
const kBadArgs = {
  // Bad number of args
  '0args': '',
  '2args': '(1u,2u)',
  // Bad value for arg 0
  '0bool': '(false)',
  '0array': '(array(1u))',
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
  .fn(t => {
    t.expectCompileResult(false, `fn f() { ${builtin}${kGoodArgs}; }`);
  });
