export const description = `
Execution Tests for the 'inverseSqrt' builtin function
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { assert } from '../../../../common/util/util.js';
import { GPUTest } from '../../../gpu_test.js';
import { f32, f32Bits, Scalar, TypeF32, u32 } from '../../../util/conversion.js';

import { Case, Config, kBit, run, ulpThreshold } from './builtin.js';

export const g = makeTestGroup(GPUTest);

// Calculates the linear interpolation between two values of a given ratio
function lerp(min: number, max: number, t: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(t)) {
    return Number.NaN;
  }
  if (min === max) {
    return min;
  }

  if (min > max) {
    const temp = min;
    min = max;
    max = temp;
  }

  if (t > 1) {
    return max;
  }

  if (t < 0) {
    return min;
  }

  return min + t * (max - min);
}

// Unwrap Scalar params into numbers and test preconditions
function unwrapRangeParams(min: Scalar, max: Scalar, steps: Scalar) {
  assert(min.type.kind === 'f32', '|min| needs to be a f32');
  assert(max.type.kind === 'f32', '|max| needs to be a f32');
  assert(steps.type.kind === 'u32', '|steps| needs to be a u32');

  const f32_min = min.value as number;
  const f32_max = max.value as number;
  const u32_steps = steps.value as number;

  assert(f32_max > f32_min, '|max| must be greater than |min|');
  assert(u32_steps > 0, '|steps| must be greater than 0');

  return { f32_min, f32_max, u32_steps };
}

// Linear range generator, since TypeScript doesn't provide one
function linearRange(min: Scalar, max: Scalar, steps: Scalar): Array<number> {
  const { f32_min, f32_max, u32_steps } = unwrapRangeParams(min, max, steps);

  return Array.from(Array(u32_steps).keys()).map(i => lerp(f32_min, f32_max, i / (u32_steps - 1)));
}

// Non-linear range generator, biased to towards min.
function biasedRange(min: Scalar, max: Scalar, steps: Scalar): Array<number> {
  const { f32_min, f32_max, u32_steps } = unwrapRangeParams(min, max, steps);

  return Array.from(Array(u32_steps).keys()).map(i =>
    lerp(f32_min, f32_max, Math.pow(lerp(0, 1, i / (u32_steps - 1)), 2))
  );
}

g.test('float_builtin_functions,inverseSqrt')
  .uniqueId('84fc180ad82c5618')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
inverseSqrt:
T is f32 or vecN<f32> inverseSqrt(e: T ) -> T Returns the reciprocal of sqrt(e). Component-wise when T is a vector. (GLSLstd450InverseSqrt)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    // [1]: Need to decide what the ground-truth is.
    const truthFunc = (x: number): Case => {
      return { input: f32(x), expected: f32(1 / Math.sqrt(x)) };
    };

    // Well defined cases
    let cases: Array<Case> = [
      { input: f32Bits(kBit.f32.infinity.positive), expected: f32(0) },
      { input: f32(1), expected: f32(1) },
    ];

    // 0 < x <= 1 linearly spread
    cases = cases.concat(
      linearRange(f32Bits(kBit.f32.positive.min), f32(1), u32(100)).map(x => truthFunc(x))
    );
    // 1 <= x < 2^32, biased towards 1
    cases = cases.concat(biasedRange(f32(1), f32(2 ** 32), u32(1000)).map(x => truthFunc(x)));

    const cfg: Config = t.params;
    cfg.cmpFloats = ulpThreshold(2);
    run(t, 'inverseSqrt', [TypeF32], TypeF32, cfg, cases);
  });
