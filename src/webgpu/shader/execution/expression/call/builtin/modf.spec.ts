export const description = `
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

`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { toVector, TypeF32, TypeStruct, TypeVec } from '../../../../../util/conversion.js';
import { FP, FPInterval, FPKind, FPStruct } from '../../../../../util/floating_point.js';
import { fullF32Range, vectorF32Range } from '../../../../../util/math.js';
import { makeCaseCache } from '../../case_cache.js';
import {
  allInputSources,
  basicExpressionBuilder,
  Case,
  run,
  ShaderBuilder,
} from '../../expression.js';

export const g = makeTestGroup(GPUTest);

function structBuilder(): ShaderBuilder {
  return basicExpressionBuilder(
    value => `modf(${value})`,
    result => `ModfOutput(${result}.fract, ${result}.whole)`
  );
}

/** @returns a whole Case for a given vector input */
function makeVectorCase(kind: FPKind, input: number[]): Case {
  const fp = FP[kind];
  input.map(fp.quantize);
  const fs: FPInterval[] = [];
  const ws: FPInterval[] = [];
  input.forEach(i => {
    const result = fp.modfInterval(i);
    fs.push(result.elements[0] as FPInterval);
    ws.push(result.elements[1] as FPInterval);
  });

  return {
    input: toVector(input, fp.scalarBuilder),
    expected: new FPStruct(fp.toVector(fs), fp.toVector(ws)),
  };
}

export const d = makeCaseCache('modf', {
  f32_scalar: () => {
    const makeCase = (n: number): Case => {
      n = FP.f32.quantize(n);
      return { input: FP.f32.scalarBuilder(n), expected: FP.f32.modfInterval(n) };
    };
    return fullF32Range().map(makeCase);
  },
  f32_vec2: () => {
    return vectorF32Range(2).map(makeVectorCase.bind(null, 'f32'));
  },
  f32_vec3: () => {
    return vectorF32Range(3).map(makeVectorCase.bind(null, 'f32'));
  },
  f32_vec4: () => {
    return vectorF32Range(4).map(makeVectorCase.bind(null, 'f32'));
  },
});

g.test('f32_scalar')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is f32

struct __modf_result_f32 {
  fract : f32, // fractional part
  whole : f32  // whole part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get('f32_scalar');
    await run(
      t,
      structBuilder(),
      [TypeF32],
      TypeStruct('ModfOutput', TypeF32, TypeF32),
      t.params,
      cases
    );
  });

g.test('f32_vec2')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is vec2<f32>

struct __modf_result_vec2_f32 {
  fract : vec2<f32>, // fractional part
  whole : vec2<f32>  // whole part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get('f32_vec2');
    await run(
      t,
      structBuilder(),
      [TypeVec(2, TypeF32)],
      TypeStruct('ModfOutput', TypeVec(2, TypeF32), TypeVec(2, TypeF32)),
      t.params,
      cases
    );
  });

g.test('f32_vec3')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is vec3<f32>

struct __modf_result_vec3_f32 {
  fract : vec3<f32>, // fractional part
  whole : vec3<f32>  // whole part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get('f32_vec3');
    await run(
      t,
      structBuilder(),
      [TypeVec(3, TypeF32)],
      TypeStruct('ModfOutput', TypeVec(3, TypeF32), TypeVec(3, TypeF32)),
      t.params,
      cases
    );
  });

g.test('f32_vec4')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is vec4<f32>

struct __modf_result_vec4_f32 {
  fract : vec4<f32>, // fractional part
  whole : vec4<f32>  // whole part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cases = await d.get('f32_vec4');
    await run(
      t,
      structBuilder(),
      [TypeVec(4, TypeF32)],
      TypeStruct('ModfOutput', TypeVec(4, TypeF32), TypeVec(4, TypeF32)),
      t.params,
      cases
    );
  });

g.test('f16_scalar')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is f16

struct __modf_result_f16 {
  fract : f16, // fractional part
  whole : f16  // whole part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .unimplemented();

g.test('f16_vec2')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is vec2<f16>

struct __modf_result_vec2_f16 {
  fract : vec2<f16>, // fractional part
  whole : vec2<f16>  // whole part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .unimplemented();

g.test('f16_vec3')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is vec3<f16>

struct __modf_result_vec3_f16 {
  fract : vec3<f16>, // fractional part
  whole : vec3<f16>  // whole part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .unimplemented();

g.test('f16_vec4')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is vec4<f16>

struct __modf_result_vec4_f16 {
  fract : vec4<f16>, // fractional part
  whole : vec4<f16>  // whole part
}
`
  )
  .params(u => u.combine('inputSource', allInputSources))
  .unimplemented();
