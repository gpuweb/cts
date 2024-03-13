const builtin = 'max';
export const description = `
Validation tests for the ${builtin}() builtin.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { keysOf, objectsToRecord } from '../../../../../../common/util/data_tables.js';
import {
  Type,
  kAllNumericScalarsAndVectors,
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

const kValuesTypes = objectsToRecord(kAllNumericScalarsAndVectors);

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
      .expand('a', u => fullRangeForType(kValuesTypes[u.type]))
      .expand('b', u => fullRangeForType(kValuesTypes[u.type]))
  )
  .beforeAllSubcases(t => {
    if (scalarTypeOf(kValuesTypes[t.params.type]) === Type.f16) {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    const type = kValuesTypes[t.params.type];
    const expectedResult = true; // should never error
    validateConstOrOverrideBuiltinEval(
      t,
      builtin,
      expectedResult,
      [type.create(t.params.a), type.create(t.params.b)],
      t.params.stage
    );
  });

const kGoodArgs = '(1.1, 2.2)';
const kBadArgs = {
  no_parens: '',
  // Bad number of args
  '0args': '()',
  '1arg': '(1.0)',
  // Bad value for arg 0
  '0bool': '(false, 1.0)',
  '0array': '(array(1.1,2.2), 1.0)',
  '0struct': '(modf(2.2), 1.0)',
  // Bad value for arg 1
  '1bool': '(1.0, true)',
  '1array': '(1.0, array(1.1,2.2))',
  '1struct': '(1.0, modf(2.2))',
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
