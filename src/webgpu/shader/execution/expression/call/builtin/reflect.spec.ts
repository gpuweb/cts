export const description = `
Execution tests for the 'reflect' builtin function

T is vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn reflect(e1: T, e2: T ) -> T
For the incident vector e1 and surface orientation e2, returns the reflection
direction e1-2*dot(e2,e1)*e2.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { TypeF32, TypeVec } from '../../../../../util/conversion.js';
import { reflectInterval } from '../../../../../util/f32_interval.js';
import { sparseVectorF32Range } from '../../../../../util/math.js';
import { makeCaseCache } from '../../case_cache.js';
import { allInputSources, generateVectorPairToVectorCases, run } from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

export const d = makeCaseCache('reflect', {
  f32_vec2: () => {
    return generateVectorPairToVectorCases(
      sparseVectorF32Range(2),
      sparseVectorF32Range(2),
      reflectInterval
    );
  },
  f32_vec3: () => {
    return generateVectorPairToVectorCases(
      sparseVectorF32Range(3),
      sparseVectorF32Range(3),
      reflectInterval
    );
  },
  f32_vec4: () => {
    return generateVectorPairToVectorCases(
      sparseVectorF32Range(4),
      sparseVectorF32Range(4),
      reflectInterval
    );
  },
});

g.test('abstract_float')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(`abstract float tests`)
  .params(u => u.combine('inputSource', allInputSources).combine('vectorize', [2, 3, 4] as const))
  .unimplemented();

g.test('f32_vec2')
  .specURL('https://www.w3.org/TR/WGSL/#numeric-builtin-functions')
  .desc(`f32 tests using vec2s`)
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get('f32_vec2');
    await run(
      t,
      builtin('reflect'),
      [TypeVec(2, TypeF32), TypeVec(2, TypeF32)],
      TypeVec(2, TypeF32),
      t.params,
      cases
    );
  });

g.test('f32_vec3')
  .specURL('https://www.w3.org/TR/WGSL/#numeric-builtin-functions')
  .desc(`f32 tests using vec3s`)
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get('f32_vec3');
    await run(
      t,
      builtin('reflect'),
      [TypeVec(3, TypeF32), TypeVec(3, TypeF32)],
      TypeVec(3, TypeF32),
      t.params,
      cases
    );
  });

g.test('f32_vec4')
  .specURL('https://www.w3.org/TR/WGSL/#numeric-builtin-functions')
  .desc(`f32 tests using vec4s`)
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get('f32_vec4');
    await run(
      t,
      builtin('reflect'),
      [TypeVec(4, TypeF32), TypeVec(4, TypeF32)],
      TypeVec(4, TypeF32),
      t.params,
      cases
    );
  });

g.test('f16')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(`f16 tests`)
  .params(u => u.combine('inputSource', allInputSources).combine('vectorize', [2, 3, 4] as const))
  .unimplemented();
