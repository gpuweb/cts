export const description = `WGSL execution test. Section: Value-testing built-in functions Function: isInf`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { assert } from '../../../../common/util/util.js';
import { GPUTest } from '../../../gpu_test.js';
import { NumberRepr } from '../../../util/conversion.js';
import { generateTypes } from '../../types.js';
import { subnormalF32Examples, normalF32Examples } from '../../values.js';

import { runValueCheckTest } from './value_testing_built_in_functions.spec.js';

export const g = makeTestGroup(GPUTest);

g.test('value_testing_builtin_functions,isInf')
  .uniqueId('3591ae3f3daa3871')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#value-testing-builtin-functions')
  .desc(
    `
isInf:
isInf(e: I ) -> T Test for infinity according to IEEE-754. Component-wise when I is a vector. (OpIsInf)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u =>
    u
      .combine('baseType', ['f32'] as const)
      .combine('containerType', ['scalar', 'vector'] as const)
      .combine('storageClass', ['storage'] as const) // Needed by generateTypes
      .expandWithParams(generateTypes)
  )
  .fn(async t => {
    assert(t.params._kTypeInfo !== undefined, 'generated type is undefined');
    const make = (the_input: number, expected: boolean) => {
      return {
        input: NumberRepr.fromF32(the_input),
        expected: [NumberRepr.fromF32(expected ? 1.0 : 0.0)],
      };
    };
    const cases = [
      // Non-infinity
      make(0.0, false),
      make(10.0, false),
      make(-10.0, false),
      // Infinities
      make(Infinity, true),
      make(-Infinity, true),
      // NaNs
      make(NaN, false),
      make(-NaN, false),
    ]
      // Normal values are not infinite.
      .concat(normalF32Examples().map(n => make(n, false)))
      // Subnormal values are not infinite.
      .concat(subnormalF32Examples().map(n => make(n, false)));

    runValueCheckTest(
      t,
      t.params.type,
      t.params._kTypeInfo.arrayLength,
      'isInf',
      Float32Array,
      cases
    );
  });
