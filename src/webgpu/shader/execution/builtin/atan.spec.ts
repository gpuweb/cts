export const description = `
Execution Tests for the 'atan' builtin function
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { f32, TypeF32 } from '../../../util/conversion.js';

import { ulpThreshold, Case, Config, run } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('float_builtin_functions,atan')
  .uniqueId('b13828d6243d13dd')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
atan:
T is f32 or vecN<f32> atan(e: T ) -> T Returns the arc tangent of e. Component-wise when T is a vector. (GLSLstd450Atan)
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    // TODO(https://github.com/gpuweb/cts/issues/792): Decide what the ground-truth is for these tests.
    const truth_func = (x: number): number => {
      return Math.atan(x);
    };
    // Well defined/border cases
    const manual_inputs: Array<number> = [
      Number.NEGATIVE_INFINITY, // -Inf -> -90°
      -Math.sqrt(3), // -sqrt(3) -> -60°
      -1, // -1 -> -45°
      -Math.sqrt(3) / 3, // -sqrt(3)/3 -> -30°
      0, // 0 -> 0°
      Math.sqrt(3) / 3, // sqrt(3)/3 -> 30°
      1, // 1 -> 45°
      Math.sqrt(3), // sqrt(3) -> 60°
      Number.POSITIVE_INFINITY, // Inf -> 90°
    ];
    const manual_cases = new Array<Case>(manual_inputs.length);
    for (let i = 0; i < manual_cases.length; i++) {
      manual_cases[i] = {
        input: f32(manual_inputs[i]),
        expected: f32(truth_func(manual_inputs[i])),
      };
    }

    // Spread of cases over wide domain
    const automatic_cases = new Array<Case>(1000);
    const increment = (Number.MAX_SAFE_INTEGER - Number.MIN_SAFE_INTEGER) / automatic_cases.length;
    for (let i = 0; i < automatic_cases.length; i++) {
      const x = Number.MIN_SAFE_INTEGER + increment * i;
      automatic_cases[i] = { input: f32(x), expected: f32(truth_func(x)) };
    }

    const cfg: Config = t.params;
    cfg.cmpFloats = ulpThreshold(4096);
    run(t, 'atan', [TypeF32], TypeF32, cfg, manual_cases.concat(automatic_cases));
  });
