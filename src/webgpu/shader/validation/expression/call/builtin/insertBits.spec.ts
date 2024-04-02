const builtin = 'insertBits';
export const description = `
Validation tests for the ${builtin}() builtin.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { keysOf, objectsToRecord } from '../../../../../../common/util/data_tables.js';
import {
  kConcreteIntegerScalarsAndVectors,
  kFloatScalarsAndVectors,
  u32,
} from '../../../../../util/conversion.js';
import { linearRange } from '../../../../../util/math.js';
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
Validates that constant evaluation and override evaluation of ${builtin}() never errors on valid inputs
`
  )
  .params(u =>
    u
      .combine('stage', kConstantAndOverrideStages)
      .combine('type', keysOf(kValuesTypes))
      .filter(u => stageSupportsType(u.stage, kValuesTypes[u.type]))
      .beginSubcases()
      .expand('value', u => fullRangeForType(kValuesTypes[u.type]))
      .expand('newbits', u => fullRangeForType(kValuesTypes[u.type]))
      .expand('offset', _ => linearRange(0, 32, 1).map(f => Math.floor(f)))
      .expand('count', u => linearRange(0, 32 - u.offset, 1).map(f => Math.floor(f)))
  )
  .fn(t => {
    const expectedResult = true; // insertBits() should never error
    validateConstOrOverrideBuiltinEval(
      t,
      builtin,
      expectedResult,
      [
        kValuesTypes[t.params.type].create(t.params.value),
        kValuesTypes[t.params.type].create(t.params.newbits),
        u32(t.params.offset),
        u32(t.params.count),
      ],
      t.params.stage
    );
  });

g.test('mismatched')
  .desc(
    `
Validates that even with valid types, if 'e' and 'newbits' do not match types ${builtin}() errors
`
  )
  .params(u =>
    u
      .combine('e', keysOf(kValuesTypes))
      .combine('newbits', keysOf(kValuesTypes))
      .filter(u => u.e !== u.newbits)
  )
  .fn(t => {
    const eT = kValuesTypes[t.params.e];
    const newbitsT = kValuesTypes[t.params.newbits];
    validateConstOrOverrideBuiltinEval(
      t,
      builtin,
      /* expectedResult */ false,
      [eT.create(0), newbitsT.create(0), u32(0), u32(32)],
      'constant'
    );
  });

const kFloatTypes = objectsToRecord(kFloatScalarsAndVectors);

// g.test('float_argument')
//   .desc(
//     `
// Validates that float arguments are rejected by ${builtin}()
// `
//   )
//   .params(u => u.combine('type', keysOf(kFloatTypes)))
//   .fn(t => {
//     const type = kFloatTypes[t.params.type];
//     validateConstOrOverrideBuiltinEval(
//       t,
//       builtin,
//       /* expectedResult */ false,
//       [type.create(0)],
//       'constant'
//     );
//   });

// // const kArgCases = {
// //   good: '(1u)',
// //   bad_no_parens: '',
// //   // Bad number of args
// //   bad_too_few: '()',
// //   bad_too_many: '(1u,2u)',
// //   // Bad value for arg 0 (Note that float type arguments are handled in 'float_argument' above)
// //   bad_0bool: '(false)',
// //   bad_0array: '(array(1u))',
// //   bad_0struct: '(modf(2.2))',
// // };

// g.test('args')
//   .desc(`Test compilation failure of ${builtin} with variously shaped and typed arguments`)
//   .params(u => u.combine('arg', keysOf(kArgCases)))
//   .fn(t => {
//     t.expectCompileResult(
//       t.params.arg === 'good',
//       `const c = ${builtin}${kArgCases[t.params.arg]};`
//     );
//   });

// g.test('must_use')
//   .desc(`Result of ${builtin} must be used`)
//   .fn(t => {
//     t.expectCompileResult(false, `fn f() { ${builtin}${kArgCases['good']}; }`);
//   });
