export const description = `
Execution tests for the 'length' builtin function

S is AbstractFloat, f32, f16
T is S or vecN<S>
@const fn length(e: T ) -> f32
Returns the length of e (e.g. abs(e) if T is a scalar, or sqrt(e[0]^2 + e[1]^2 + ...) if T is a vector).
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { TypeF32, TypeF16, TypeVec } from '../../../../../util/conversion.js';
import { FP } from '../../../../../util/floating_point.js';
import { makeCaseCache } from '../../case_cache.js';
import { allInputSources, run } from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

// Cases: [f32|f16]_[non_]const
const scalar_cases = (['f32', 'f16'] as const)
  .map(trait => ({
    [`${trait}`]: () => {
      return FP[trait].generateScalarToIntervalCases(
        FP[trait].scalarRange(),
        'unfiltered',
        FP[trait].lengthInterval
      );
    },
  }))
  .reduce((a, b) => ({ ...a, ...b }), {});

// Cases: [f32|f16]_vecN_[non_]const
const vec_cases = (['f32', 'f16'] as const)
  .flatMap(trait =>
    ([2, 3, 4] as const).flatMap(dim =>
      ([true, false] as const).map(nonConst => ({
        [`${trait}_vec${dim}_${nonConst ? 'non_const' : 'const'}`]: () => {
          return FP[trait].generateVectorToIntervalCases(
            FP[trait].vectorRange(dim),
            nonConst ? 'unfiltered' : 'finite',
            FP[trait].lengthInterval
          );
        },
      }))
    )
  )
  .reduce((a, b) => ({ ...a, ...b }), {});

export const d = makeCaseCache('length', {
  ...scalar_cases,
  ...vec_cases,
});

g.test('abstract_float')
  .specURL('https://www.w3.org/TR/WGSL/#numeric-builtin-functions')
  .desc(`abstract float tests`)
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .unimplemented();

g.test('f32')
  .specURL('https://www.w3.org/TR/WGSL/#numeric-builtin-functions')
  .desc(`f32 tests`)
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get('f32');
    await run(t, builtin('length'), [TypeF32], TypeF32, t.params, cases);
  });

g.test('f32_vec2')
  .specURL('https://www.w3.org/TR/WGSL/#numeric-builtin-functions')
  .desc(`f32 tests using vec2s`)
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get(
      t.params.inputSource === 'const' ? 'f32_vec2_const' : 'f32_vec2_non_const'
    );
    await run(t, builtin('length'), [TypeVec(2, TypeF32)], TypeF32, t.params, cases);
  });

g.test('f32_vec3')
  .specURL('https://www.w3.org/TR/WGSL/#numeric-builtin-functions')
  .desc(`f32 tests using vec3s`)
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get(
      t.params.inputSource === 'const' ? 'f32_vec3_const' : 'f32_vec3_non_const'
    );
    await run(t, builtin('length'), [TypeVec(3, TypeF32)], TypeF32, t.params, cases);
  });

g.test('f32_vec4')
  .specURL('https://www.w3.org/TR/WGSL/#numeric-builtin-functions')
  .desc(`f32 tests using vec4s`)
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get(
      t.params.inputSource === 'const' ? 'f32_vec4_const' : 'f32_vec4_non_const'
    );
    await run(t, builtin('length'), [TypeVec(4, TypeF32)], TypeF32, t.params, cases);
  });

g.test('f16')
  .specURL('https://www.w3.org/TR/WGSL/#numeric-builtin-functions')
  .desc(`f16 tests`)
  .params(u => u.combine('inputSource', allInputSources))
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase('shader-f16');
  })
  .fn(async t => {
    const cases = await d.get('f16');
    await run(t, builtin('length'), [TypeF16], TypeF16, t.params, cases);
  });

g.test('f16_vec2')
  .specURL('https://www.w3.org/TR/WGSL/#numeric-builtin-functions')
  .desc(`f16 tests using vec2s`)
  .params(u => u.combine('inputSource', allInputSources))
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase('shader-f16');
  })
  .fn(async t => {
    const cases = await d.get(
      t.params.inputSource === 'const' ? 'f16_vec2_const' : 'f16_vec2_non_const'
    );
    await run(t, builtin('length'), [TypeVec(2, TypeF16)], TypeF16, t.params, cases);
  });

g.test('f16_vec3')
  .specURL('https://www.w3.org/TR/WGSL/#numeric-builtin-functions')
  .desc(`f16 tests using vec3s`)
  .params(u => u.combine('inputSource', allInputSources))
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase('shader-f16');
  })
  .fn(async t => {
    const cases = await d.get(
      t.params.inputSource === 'const' ? 'f16_vec3_const' : 'f16_vec3_non_const'
    );
    await run(t, builtin('length'), [TypeVec(3, TypeF16)], TypeF16, t.params, cases);
  });

g.test('f16_vec4')
  .specURL('https://www.w3.org/TR/WGSL/#numeric-builtin-functions')
  .desc(`f16 tests using vec4s`)
  .params(u => u.combine('inputSource', allInputSources))
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase('shader-f16');
  })
  .fn(async t => {
    const cases = await d.get(
      t.params.inputSource === 'const' ? 'f16_vec4_const' : 'f16_vec4_non_const'
    );
    await run(t, builtin('length'), [TypeVec(4, TypeF16)], TypeF16, t.params, cases);
  });
