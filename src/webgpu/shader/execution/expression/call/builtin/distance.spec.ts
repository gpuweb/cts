export const description = `
Execution tests for the 'distance' builtin function

S is AbstractFloat, f32, f16
T is S or vecN<S>
@const fn distance(e1: T ,e2: T ) -> f32
Returns the distance between e1 and e2 (e.g. length(e1-e2)).

`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { TypeF32, TypeVec } from '../../../../../util/conversion.js';
import { distanceInterval } from '../../../../../util/f32_interval.js';
import { fullF32Range, sparseVectorF32Range } from '../../../../../util/math.js';
import { makeCaseCache } from '../../case_cache.js';
import {
  allInputSources,
  generateBinaryToF32IntervalCases,
  generateVectorPairToF32IntervalCases,
  run,
} from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

export const d = makeCaseCache('distance', {
  f32: () => {
    return generateBinaryToF32IntervalCases(fullF32Range(), fullF32Range(), distanceInterval);
  },
  f32_vec2: () => {
    return generateVectorPairToF32IntervalCases(
      sparseVectorF32Range(2),
      sparseVectorF32Range(2),
      distanceInterval
    );
  },
  f32_vec3: () => {
    return generateVectorPairToF32IntervalCases(
      sparseVectorF32Range(3),
      sparseVectorF32Range(3),
      distanceInterval
    );
  },
  f32_vec4: () => {
    return generateVectorPairToF32IntervalCases(
      sparseVectorF32Range(4),
      sparseVectorF32Range(4),
      distanceInterval
    );
  },
});

g.test('abstract_float')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
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
    await run(t, builtin('distance'), [TypeF32, TypeF32], TypeF32, t.params, cases);
  });

g.test('f32_vec2')
  .specURL('https://www.w3.org/TR/WGSL/#numeric-builtin-functions')
  .desc(`f32 tests using vec2s`)
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get('f32_vec2');
    await run(
      t,
      builtin('distance'),
      [TypeVec(2, TypeF32), TypeVec(2, TypeF32)],
      TypeF32,
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
      builtin('distance'),
      [TypeVec(3, TypeF32), TypeVec(3, TypeF32)],
      TypeF32,
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
      builtin('distance'),
      [TypeVec(4, TypeF32), TypeVec(4, TypeF32)],
      TypeF32,
      t.params,
      cases
    );
  });

g.test('f16')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(`f16 tests`)
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .unimplemented();
