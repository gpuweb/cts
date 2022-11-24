export const description = `
Execution tests for the 'refract' builtin function

T is vecN<I>
I is AbstractFloat, f32, or f16
@const fn refract(e1: T ,e2: T ,e3: I ) -> T
For the incident vector e1 and surface normal e2, and the ratio of indices of
refraction e3, let k = 1.0 -e3*e3* (1.0 - dot(e2,e1) * dot(e2,e1)).
If k < 0.0, returns the refraction vector 0.0, otherwise return the refraction
vector e3*e1- (e3* dot(e2,e1) + sqrt(k)) *e2.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { f32, TypeF32, TypeVec, Vector } from '../../../../../util/conversion.js';
import {
  refractInterval,
  refractLargestIntermediateValue,
} from '../../../../../util/f32_interval.js';
import {
  isFiniteF32,
  quantizeToF32,
  sparseF32Range,
  sparseVectorF32Range,
} from '../../../../../util/math.js';
import { makeCaseCache } from '../../case_cache.js';
import { allInputSources, Case, run } from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

/** Helper to generate cases for a given dimension */
function generateCases(dim: number, op?: (i: number[], s: number[], r: number) => number): Case[] {
  const makeCase = (i: number[], s: number[], r: number): Case => {
    i = i.map(quantizeToF32);
    s = s.map(quantizeToF32);
    r = quantizeToF32(r);

    const i_f32 = i.map(f32);
    const s_f32 = s.map(f32);
    const r_f32 = f32(r);

    return {
      input: [new Vector(i_f32), new Vector(s_f32), r_f32],
      expected: refractInterval(i, s, r),
    };
  };

  // Cannot use cartesianProduct here, because the params have heterogeneous types
  const inputs: { i: number[]; s: number[]; r: number }[] = [];
  sparseVectorF32Range(dim).forEach(i => {
    sparseVectorF32Range(dim).forEach(s => {
      return sparseF32Range().forEach(r => {
        if (op === undefined || isFiniteF32(op(i, s, r))) {
          inputs.push({ s, i, r });
        }
      });
    });
  });

  return inputs.map(e => makeCase(e.i, e.s, e.r));
}

export const d = makeCaseCache('refract', {
  f32_vec2_const: () => {
    return generateCases(2, refractLargestIntermediateValue);
  },
  f32_vec2_non_const: () => {
    return generateCases(2);
  },
  f32_vec3_const: () => {
    return generateCases(3, refractLargestIntermediateValue);
  },
  f32_vec3_non_const: () => {
    return generateCases(3);
  },
  f32_vec4_const: () => {
    return generateCases(4, refractLargestIntermediateValue);
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
      builtin('refract'),
      [TypeVec(2, TypeF32), TypeVec(2, TypeF32), TypeF32],
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
      builtin('refract'),
      [TypeVec(3, TypeF32), TypeVec(3, TypeF32), TypeF32],
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
      builtin('refract'),
      [TypeVec(4, TypeF32), TypeVec(4, TypeF32), TypeF32],
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
