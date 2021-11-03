export const description = `
Execution Tests for the 'asin' builtin function
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { f32, TypeF32 } from '../../../util/conversion.js';

import { ulpThreshold, Case, Config, run } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('float_builtin_functions,asin')
  .uniqueId('322c7c5ba84c257a')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
asin:
T is f32 or vecN<f32> asin(e: T ) -> T Returns the arc sine of e. Component-wise when T is a vector. (GLSLstd450Asin)
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
      return Math.asin(x);
    };

    // Well defined/border cases
    const manual_inputs: Array<number> = [
      -100, // < -1 -> NaN
      -1, // -1 -> -90°
      -Math.sqrt(3) / 2, // -sqrt(3)/2 -> -60°
      -Math.sqrt(2) / 2, // -sqrt(2)/2 -> -45°
      -1 / 2, // -1/2 -> -30°
      0, // 0 -> 0°
      1 / 2, // 1/2 -> 30°
      Math.sqrt(3) / 2, // sqrt(3)/2 -> 60°
      Math.sqrt(2) / 2, // sqrt(2)/2 -> 45°
      1, // -1 -> 90°
      10, // > 1 -> NaN
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
    const increment = 2 / automatic_cases.length;
    for (let i = 0; i < automatic_cases.length; i++) {
      const x = -1 + increment * i;
      automatic_cases[i] = { input: f32(x), expected: f32(truth_func(x)) };
    }

    const cfg: Config = t.params;
    cfg.cmpFloats = ulpThreshold(4096);
    run(t, 'asin', [TypeF32], TypeF32, cfg, manual_cases.concat(automatic_cases));
  });
