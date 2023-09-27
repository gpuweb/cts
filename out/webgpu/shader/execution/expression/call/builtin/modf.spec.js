/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution tests for the 'modf' builtin function

T is f32 or f16
@const fn modf(e:T) -> result_struct
Splits |e| into fractional and whole number parts.
The whole part is (|e| % 1.0), and the fractional part is |e| minus the whole part.
Returns the result_struct for the given type.

S is f32 or f16
T is vecN<S>
@const fn modf(e:T) -> result_struct
Splits the components of |e| into fractional and whole number parts.
The |i|'th component of the whole and fractional parts equal the whole and fractional parts of modf(e[i]).
Returns the result_struct for the given type.

`;import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { toVector, TypeF16, TypeF32, TypeVec } from '../../../../../util/conversion.js';
import { FP } from '../../../../../util/floating_point.js';
import {
fullF16Range,
fullF32Range,
fullF64Range,
vectorF16Range,
vectorF32Range,
vectorF64Range } from
'../../../../../util/math.js';
import { makeCaseCache } from '../../case_cache.js';
import {
allInputSources,
basicExpressionBuilder,

run } from

'../../expression.js';

export const g = makeTestGroup(GPUTest);

/** @returns an ShaderBuilder that evaluates modf and returns .whole from the result structure */
function wholeBuilder() {
  return basicExpressionBuilder((value) => `modf(${value}).whole`);
}

/** @returns an ShaderBuilder that evaluates modf and returns .fract from the result structure */
function fractBuilder() {
  return basicExpressionBuilder((value) => `modf(${value}).fract`);
}

/** @returns a fract Case for a scalar vector input */
function makeScalarCaseFract(kind, n) {
  const fp = FP[kind];
  n = fp.quantize(n);
  const result = fp.modfInterval(n).fract;

  return { input: fp.scalarBuilder(n), expected: result };
}

/** @returns a whole Case for a scalar vector input */
function makeScalarCaseWhole(kind, n) {
  const fp = FP[kind];
  n = fp.quantize(n);
  const result = fp.modfInterval(n).whole;

  return { input: fp.scalarBuilder(n), expected: result };
}

/** @returns a fract Case for a given vector input */
function makeVectorCaseFract(kind, v) {
  const fp = FP[kind];
  v = v.map(fp.quantize);
  const fs = v.map((e) => {
    return fp.modfInterval(e).fract;
  });

  return { input: toVector(v, fp.scalarBuilder), expected: fs };
}

/** @returns a whole Case for a given vector input */
function makeVectorCaseWhole(kind, v) {
  const fp = FP[kind];
  v = v.map(fp.quantize);
  const ws = v.map((e) => {
    return fp.modfInterval(e).whole;
  });

  return { input: toVector(v, fp.scalarBuilder), expected: ws };
}

const scalar_range = {
  f32: fullF32Range(),
  f16: fullF16Range(),
  abstract: fullF64Range()
};

const vector_range = {
  f32: {
    2: vectorF32Range(2),
    3: vectorF32Range(3),
    4: vectorF32Range(4)
  },
  f16: {
    2: vectorF16Range(2),
    3: vectorF16Range(3),
    4: vectorF16Range(4)
  },
  abstract: {
    2: vectorF64Range(2),
    3: vectorF64Range(3),
    4: vectorF64Range(4)
  }
};

// Cases: [f32|f16]_[fract|whole]
const scalar_cases = ['f32', 'f16'].
flatMap((kind) =>
['whole', 'fract'].map((portion) => ({
  [`${kind}_${portion}`]: () => {
    const makeCase = portion === 'whole' ? makeScalarCaseWhole : makeScalarCaseFract;
    return scalar_range[kind].map(makeCase.bind(null, kind));
  }
}))).

reduce((a, b) => ({ ...a, ...b }), {});

// Cases: [f32|f16]_vecN_[fract|whole]
const vec_cases = ['f32', 'f16'].
flatMap((kind) =>
[2, 3, 4].flatMap((n) =>
['whole', 'fract'].map((portion) => ({
  [`${kind}_vec${n}_${portion}`]: () => {
    const makeCase = portion === 'whole' ? makeVectorCaseWhole : makeVectorCaseFract;
    return vector_range[kind][n].map(makeCase.bind(null, kind));
  }
})))).


reduce((a, b) => ({ ...a, ...b }), {});

export const d = makeCaseCache('modf', {
  ...scalar_cases,
  ...vec_cases
});

g.test('f32_fract').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is f32

struct __modf_result_f32 {
  fract : f32, // fractional part
  whole : f32  // whole part
}
`).

params((u) => u.combine('inputSource', allInputSources)).
fn(async (t) => {
  const cases = await d.get('f32_fract');
  await run(t, fractBuilder(), [TypeF32], TypeF32, t.params, cases);
});

g.test('f32_whole').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is f32

struct __modf_result_f32 {
  fract : f32, // fractional part
  whole : f32  // whole part
}
`).

params((u) => u.combine('inputSource', allInputSources)).
fn(async (t) => {
  const cases = await d.get('f32_whole');
  await run(t, wholeBuilder(), [TypeF32], TypeF32, t.params, cases);
});

g.test('f32_vec2_fract').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is vec2<f32>

struct __modf_result_vec2_f32 {
  fract : vec2<f32>, // fractional part
  whole : vec2<f32>  // whole part
}
`).

params((u) => u.combine('inputSource', allInputSources)).
fn(async (t) => {
  const cases = await d.get('f32_vec2_fract');
  await run(t, fractBuilder(), [TypeVec(2, TypeF32)], TypeVec(2, TypeF32), t.params, cases);
});

g.test('f32_vec2_whole').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is vec2<f32>

struct __modf_result_vec2_f32 {
  fract : vec2<f32>, // fractional part
  whole : vec2<f32>  // whole part
}
`).

params((u) => u.combine('inputSource', allInputSources)).
fn(async (t) => {
  const cases = await d.get('f32_vec2_whole');
  await run(t, wholeBuilder(), [TypeVec(2, TypeF32)], TypeVec(2, TypeF32), t.params, cases);
});

g.test('f32_vec3_fract').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is vec3<f32>

struct __modf_result_vec3_f32 {
  fract : vec3<f32>, // fractional part
  whole : vec3<f32>  // whole part
}
`).

params((u) => u.combine('inputSource', allInputSources)).
fn(async (t) => {
  const cases = await d.get('f32_vec3_fract');
  await run(t, fractBuilder(), [TypeVec(3, TypeF32)], TypeVec(3, TypeF32), t.params, cases);
});

g.test('f32_vec3_whole').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is vec3<f32>

struct __modf_result_vec3_f32 {
  fract : vec3<f32>, // fractional part
  whole : vec3<f32>  // whole part
}
`).

params((u) => u.combine('inputSource', allInputSources)).
fn(async (t) => {
  const cases = await d.get('f32_vec3_whole');
  await run(t, wholeBuilder(), [TypeVec(3, TypeF32)], TypeVec(3, TypeF32), t.params, cases);
});

g.test('f32_vec4_fract').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is vec4<f32>

struct __modf_result_vec4_f32 {
  fract : vec4<f32>, // fractional part
  whole : vec4<f32>  // whole part
}
`).

params((u) => u.combine('inputSource', allInputSources)).
fn(async (t) => {
  const cases = await d.get('f32_vec4_fract');
  await run(t, fractBuilder(), [TypeVec(4, TypeF32)], TypeVec(4, TypeF32), t.params, cases);
});

g.test('f32_vec4_whole').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is vec4<f32>

struct __modf_result_vec4_f32 {
  fract : vec4<f32>, // fractional part
  whole : vec4<f32>  // whole part
}
`).

params((u) => u.combine('inputSource', allInputSources)).
fn(async (t) => {
  const cases = await d.get('f32_vec4_whole');
  await run(t, wholeBuilder(), [TypeVec(4, TypeF32)], TypeVec(4, TypeF32), t.params, cases);
});

g.test('f16_fract').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is f16

struct __modf_result_f16 {
  fract : f16, // fractional part
  whole : f16  // whole part
}
`).

params((u) => u.combine('inputSource', allInputSources)).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase({ requiredFeatures: ['shader-f16'] });
}).
fn(async (t) => {
  const cases = await d.get('f16_fract');
  await run(t, fractBuilder(), [TypeF16], TypeF16, t.params, cases);
});

g.test('f16_whole').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is f16

struct __modf_result_f16 {
  fract : f16, // fractional part
  whole : f16  // whole part
}
`).

params((u) => u.combine('inputSource', allInputSources)).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase({ requiredFeatures: ['shader-f16'] });
}).
fn(async (t) => {
  const cases = await d.get('f16_whole');
  await run(t, wholeBuilder(), [TypeF16], TypeF16, t.params, cases);
});

g.test('f16_vec2_fract').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is vec2<f16>

struct __modf_result_vec2_f16 {
  fract : vec2<f16>, // fractional part
  whole : vec2<f16>  // whole part
}
`).

params((u) => u.combine('inputSource', allInputSources)).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase({ requiredFeatures: ['shader-f16'] });
}).
fn(async (t) => {
  const cases = await d.get('f16_vec2_fract');
  await run(t, fractBuilder(), [TypeVec(2, TypeF16)], TypeVec(2, TypeF16), t.params, cases);
});

g.test('f16_vec2_whole').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is vec2<f16>

struct __modf_result_vec2_f16 {
  fract : vec2<f16>, // fractional part
  whole : vec2<f16>  // whole part
}
`).

params((u) => u.combine('inputSource', allInputSources)).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase({ requiredFeatures: ['shader-f16'] });
}).
fn(async (t) => {
  const cases = await d.get('f16_vec2_whole');
  await run(t, wholeBuilder(), [TypeVec(2, TypeF16)], TypeVec(2, TypeF16), t.params, cases);
});

g.test('f16_vec3_fract').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is vec3<f16>

struct __modf_result_vec3_f16 {
  fract : vec3<f16>, // fractional part
  whole : vec3<f16>  // whole part
}
`).

params((u) => u.combine('inputSource', allInputSources)).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase({ requiredFeatures: ['shader-f16'] });
}).
fn(async (t) => {
  const cases = await d.get('f16_vec3_fract');
  await run(t, fractBuilder(), [TypeVec(3, TypeF16)], TypeVec(3, TypeF16), t.params, cases);
});

g.test('f16_vec3_whole').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is vec3<f16>

struct __modf_result_vec3_f16 {
  fract : vec3<f16>, // fractional part
  whole : vec3<f16>  // whole part
}
`).

params((u) => u.combine('inputSource', allInputSources)).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase({ requiredFeatures: ['shader-f16'] });
}).
fn(async (t) => {
  const cases = await d.get('f16_vec3_whole');
  await run(t, wholeBuilder(), [TypeVec(3, TypeF16)], TypeVec(3, TypeF16), t.params, cases);
});

g.test('f16_vec4_fract').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is vec4<f16>

struct __modf_result_vec4_f16 {
  fract : vec4<f16>, // fractional part
  whole : vec4<f16>  // whole part
}
`).

params((u) => u.combine('inputSource', allInputSources)).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase({ requiredFeatures: ['shader-f16'] });
}).
fn(async (t) => {
  const cases = await d.get('f16_vec4_fract');
  await run(t, fractBuilder(), [TypeVec(4, TypeF16)], TypeVec(4, TypeF16), t.params, cases);
});

g.test('f16_vec4_whole').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is vec4<f16>

struct __modf_result_vec4_f16 {
  fract : vec4<f16>, // fractional part
  whole : vec4<f16>  // whole part
}
`).

params((u) => u.combine('inputSource', allInputSources)).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase({ requiredFeatures: ['shader-f16'] });
}).
fn(async (t) => {
  const cases = await d.get('f16_vec4_whole');
  await run(t, wholeBuilder(), [TypeVec(4, TypeF16)], TypeVec(4, TypeF16), t.params, cases);
});
//# sourceMappingURL=modf.spec.js.map