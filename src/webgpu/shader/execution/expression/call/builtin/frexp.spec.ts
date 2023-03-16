export const description = `
Execution tests for the 'frexp' builtin function

S is f32 or f16
T is S or vecN<S>

@const fn frexp(e: T) -> result_struct

Splits e into a significand and exponent of the form significand * 2^exponent.
Returns the result_struct for the appropriate overload.


The magnitude of the significand is in the range of [0.5, 1.0) or 0.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { anyOf } from '../../../../../util/compare.js';
import { f32, i32, toVector, TypeF32, TypeI32, TypeVec } from '../../../../../util/conversion.js';
import {
  cartesianProduct,
  frexp,
  fullF32Range,
  isSubnormalNumberF32,
  quantizeToF32,
  vectorF32Range,
} from '../../../../../util/math.js';
import { makeCaseCache } from '../../case_cache.js';
import {
  allInputSources,
  basicExpressionBuilder,
  Case,
  run,
  ShaderBuilder,
} from '../../expression.js';

export const g = makeTestGroup(GPUTest);

/* @returns an ShaderBuilder that evaluates frexp and returns .fract from the result structure */
function fractBuilder(): ShaderBuilder {
  return basicExpressionBuilder(value => `frexp(${value}).fract`);
}

/* @returns an ShaderBuilder that evaluates frexp and returns .exp from the result structure */
function expBuilder(): ShaderBuilder {
  return basicExpressionBuilder(value => `frexp(${value}).exp`);
}

/* @returns a fract Case for a given vector input */
function makeVectorCaseFract(v: number[]): Case {
  v = v.map(quantizeToF32);
  const fs = v.map(e => {
    const result = [frexp(e).fract];
    if (isSubnormalNumberF32(e)) {
      result.push(frexp(0).fract);
    }
    return result;
  });

  const options = cartesianProduct(...fs);
  const expected = anyOf(...options.map(o => toVector(o, f32)));
  return { input: toVector(v, f32), expected };
}

/* @returns an exp Case for a given vector input */
function makeVectorCaseExp(v: number[]): Case {
  v = v.map(quantizeToF32);
  const fs = v.map(e => {
    const result = [frexp(e).exp];
    if (isSubnormalNumberF32(e)) {
      result.push(frexp(0).exp);
    }
    return result;
  });

  const options = cartesianProduct(...fs);
  const expected = anyOf(...options.map(o => toVector(o, i32)));
  return { input: toVector(v, f32), expected };
}

export const d = makeCaseCache('frexp', {
  f32_fract: () => {
    const makeCase = (n: number): Case => {
      n = quantizeToF32(n);
      const expected = [f32(frexp(n).fract)];
      if (isSubnormalNumberF32(n)) {
        expected.push(f32(frexp(0).fract));
      }
      return { input: f32(n), expected: anyOf(...expected) };
    };
    return fullF32Range().map(makeCase);
  },
  f32_exp: () => {
    const makeCase = (n: number): Case => {
      n = quantizeToF32(n);
      const expected = [i32(frexp(n).exp)];
      if (isSubnormalNumberF32(n)) {
        expected.push(i32(frexp(0).exp));
      }
      return { input: f32(n), expected: anyOf(...expected) };
    };
    return fullF32Range().map(makeCase);
  },
  f32_vec2_fract: () => {
    return vectorF32Range(2).map(makeVectorCaseFract);
  },
  f32_vec2_exp: () => {
    return vectorF32Range(2).map(makeVectorCaseExp);
  },
  f32_vec3_fract: () => {
    return vectorF32Range(3).map(makeVectorCaseFract);
  },
  f32_vec3_exp: () => {
    return vectorF32Range(3).map(makeVectorCaseExp);
  },
  f32_vec4_fract: () => {
    return vectorF32Range(4).map(makeVectorCaseFract);
  },
  f32_vec4_exp: () => {
    return vectorF32Range(4).map(makeVectorCaseExp);
  },
});

g.test('f32_fract')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is f32

struct __frexp_result {
  fract : f32, // fract part
  exp : i32  // exponent part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get('f32_fract');
    await run(t, fractBuilder(), [TypeF32], TypeF32, t.params, cases);
  });

g.test('f32_exp')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is f32

struct __frexp_result {
  fract : f32, // fract part
  exp : i32  // exponent part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get('f32_exp');
    await run(t, expBuilder(), [TypeF32], TypeI32, t.params, cases);
  });

g.test('f32_vec2_fract')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is vec2<f32>

struct __frexp_result {
  fract : vec2<f32>, // fract part
  exp : vec2<i32>  // exponent part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get('f32_vec2_fract');
    await run(t, fractBuilder(), [TypeVec(2, TypeF32)], TypeVec(2, TypeF32), t.params, cases);
  });

g.test('f32_vec2_exp')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is vec2<f32>

struct __frexp_result_vec2_f32 {
  fract : vec2<f32>, // fractional part
  exp : vec2<i32>  // exponent part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get('f32_vec2_exp');
    await run(t, expBuilder(), [TypeVec(2, TypeF32)], TypeVec(2, TypeI32), t.params, cases);
  });

g.test('f32_vec3_fract')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is vec3<f32>

struct __frexp_result_vec3_f32 {
  fract : vec3<f32>, // fractional part
  exp : vec3<i32>  // exponent part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get('f32_vec3_fract');
    await run(t, fractBuilder(), [TypeVec(3, TypeF32)], TypeVec(3, TypeF32), t.params, cases);
  });

g.test('f32_vec3_exp')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is vec3<f32>

struct __frexp_result_vec3_f32 {
  fract : vec3<f32>, // fractional part
  exp : vec3<i32>  // exponent part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get('f32_vec3_exp');
    await run(t, expBuilder(), [TypeVec(3, TypeF32)], TypeVec(3, TypeI32), t.params, cases);
  });

g.test('f32_vec4_fract')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is vec4<f32>

struct __frexp_result_vec4_f32 {
  fract : vec4<f32>, // fractional part
  exp : vec4<i32>  // exponent part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get('f32_vec4_fract');
    await run(t, fractBuilder(), [TypeVec(4, TypeF32)], TypeVec(4, TypeF32), t.params, cases);
  });

g.test('f32_vec4_exp')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is vec4<f32>

struct __frexp_result_vec4_f32 {
  fract : vec4<f32>, // fractional part
  exp : vec4<i32>  // exponent part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get('f32_vec4_exp');
    await run(t, expBuilder(), [TypeVec(4, TypeF32)], TypeVec(4, TypeI32), t.params, cases);
  });

g.test('f16_fract')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is f16

struct __frexp_result {
  fract : f16, // fract part
  exp : i32  // exponent part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .unimplemented();

g.test('f16_exp')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is f16

struct __frexp_result {
  fract : f16, // fract part
  exp : i32  // exponent part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .unimplemented();

g.test('f16_vec2_fract')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is vec2<f16>

struct __frexp_result {
  fract : vec2<f16>, // fract part
  exp : vec2<i32>  // exponent part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .unimplemented();

g.test('f16_vec2_exp')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is vec2<f16>

struct __frexp_result_vec2_f16 {
  fract : vec2<f16>, // fractional part
  exp : vec2<i32>  // exponent part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .unimplemented();

g.test('f16_vec3_fract')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is vec3<f16>

struct __frexp_result_vec3_f16 {
  fract : vec3<f16>, // fractional part
  exp : vec3<i32>  // exponent part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .unimplemented();

g.test('f16_vec3_exp')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is vec3<f16>

struct __frexp_result_vec3_f16 {
  fract : vec3<f16>, // fractional part
  exp : vec3<i32>  // exponent part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .unimplemented();

g.test('f16_vec4_fract')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is vec4<f16>

struct __frexp_result_vec4_f16 {
  fract : vec4<f16>, // fractional part
  exp : vec4<i32>  // exponent part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .unimplemented();

g.test('f16_vec4_exp')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is vec4<f16>

struct __frexp_result_vec4_f16 {
  fract : vec4<f16>, // fractional part
  exp : vec4<i32>  // exponent part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .unimplemented();
