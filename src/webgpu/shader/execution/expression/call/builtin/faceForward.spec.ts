export const description = `
Execution tests for the 'faceForward' builtin function

T is vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn faceForward(e1: T ,e2: T ,e3: T ) -> T
Returns e1 if dot(e2,e3) is negative, and -e1 otherwise.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { anyOf } from '../../../../../util/compare.js';
import { f32, TypeF32, TypeVec, Vector } from '../../../../../util/conversion.js';
import {
  faceForwardIntervals,
  faceForwardLargestIntermediateValue,
} from '../../../../../util/f32_interval.js';
import {
  cartesianProduct,
  isFiniteF32,
  quantizeToF32,
  sparseVectorF32Range,
} from '../../../../../util/math.js';
import { makeCaseCache } from '../../case_cache.js';
import { allInputSources, Case, run } from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

/**
 * @returns a `faceForward` Case for a triplet of vectors of f32s input
 *
 * Needs to be a custom implementation, since faceFowardIntervals returns an
 * array of vector of intervals, which are to be treated as discrete
 * possibilities.
 */
function makeCase(x: number[], y: number[], z: number[]): Case {
  x = x.map(quantizeToF32);
  y = y.map(quantizeToF32);
  z = z.map(quantizeToF32);

  const x_f32 = x.map(f32);
  const y_f32 = y.map(f32);
  const z_f32 = z.map(f32);

  const intervals = faceForwardIntervals(x, y, z);

  return {
    input: [new Vector(x_f32), new Vector(y_f32), new Vector(z_f32)],
    expected: anyOf(...intervals),
  };
}

/** Helper to generate cases for a given dimension */
function generateCases(
  dim: number,
  liv?: (x: number[], y: number[], z: number[]) => number
): Case[] {
  if (liv === undefined) {
    return cartesianProduct(
      sparseVectorF32Range(dim),
      sparseVectorF32Range(dim),
      sparseVectorF32Range(dim)
    ).map(e => makeCase(e[0], e[1], e[2]));
  }

  return cartesianProduct(
    sparseVectorF32Range(dim),
    sparseVectorF32Range(dim),
    sparseVectorF32Range(dim)
  )
    .filter(i => {
      return isFiniteF32(liv(i[0], i[1], i[2]));
    })
    .map(e => makeCase(e[0], e[1], e[2]));
}

export const d = makeCaseCache('faceForward', {
  f32_vec2_const: () => {
    return generateCases(2, faceForwardLargestIntermediateValue);
  },
  f32_vec2_non_const: () => {
    return generateCases(2);
  },
  f32_vec3_const: () => {
    return generateCases(3, faceForwardLargestIntermediateValue);
  },
  f32_vec3_non_const: () => {
    return generateCases(3);
  },
  f32_vec4_const: () => {
    return generateCases(4, faceForwardLargestIntermediateValue);
  },
  f32_vec4_non_const: () => {
    return generateCases(4);
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
    const cases = await d.get(
      t.params.inputSource === 'const' ? 'f32_vec2_const' : 'f32_vec2_non_const'
    );
    await run(
      t,
      builtin('faceForward'),
      [TypeVec(2, TypeF32), TypeVec(2, TypeF32), TypeVec(2, TypeF32)],
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
    const cases = await d.get(
      t.params.inputSource === 'const' ? 'f32_vec3_const' : 'f32_vec3_non_const'
    );
    await run(
      t,
      builtin('faceForward'),
      [TypeVec(3, TypeF32), TypeVec(3, TypeF32), TypeVec(3, TypeF32)],
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
    const cases = await d.get(
      t.params.inputSource === 'const' ? 'f32_vec4_const' : 'f32_vec4_non_const'
    );
    await run(
      t,
      builtin('faceForward'),
      [TypeVec(4, TypeF32), TypeVec(4, TypeF32), TypeVec(4, TypeF32)],
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
