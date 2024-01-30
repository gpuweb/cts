export const description = `Validation tests for identifiers`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { keysOf } from '../../../../common/util/data_tables.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

const kTests = {
  abs: {
    keyword: `abs`,
    src: `_ = abs(1);`
  },
  acos: {
    keyword: `acos`,
    src: `_ = acos(.2);`,
  },
  acosh: {
    keyword: `acosh`,
    src: `_ = acosh(1.2);`,
  },
  all: {
    keyword: `all`,
    src: `_ = all(true);`
  },
  any: {
    keyword: `any`,
    src: `_ = any(true);`
  },
  array_templated: {
    keyword: `array`,
    src: `_ = array<i32, 2>(1, 2);`
  },
  array: {
    keyword: `array`,
    src: `_ = array(1, 2);`
  },
  array_length: {
    keyword: `arrayLength`,
    src: `_ = arrayLength(&placeholder.rt_arr);`,
  },
    asin: {
    keyword: `asin`,
    src: `_ = asin(.2);`,
  },
  asinh: {
    keyword: `asinh`,
    src: `_ = asinh(1.2);`,
  },
  atan: {
    keyword: `atan`,
    src: `_ = atan(1.2);`,
  },
  atanh: {
    keyword: `atanh`,
    src: `_ = atanh(.2);`,
  },
  atan2: {
    keyword: `atan2`,
    src: `_ = atan2(1.2, 2.3);`,
  },
  bool: {
    keyword: `bool`,
    src: `_ = bool(1);`
  },
  bitcast: {
    keyword: `bitcast`,
    src: `_ = bitcast<f32>(1i);`,
  },
  ceil: {
    keyword: `ceil`,
    src: `_ = ceil(1.23);`,
  },
  clamp: {
    keyword: `clamp`,
    src: `_ = clamp(1, 2, 3);`
  },
  cos: {
    keyword: `cos`,
    src: `_ = cos(2);`
  },
  cosh: {
    keyword: `cosh`,
    src: `_ = cosh(2.2);`
  },
  countLeadingZeros: {
    keyword: `countLeadingZeros`,
    src: `_ = countLeadingZeros(1);`
  },
  countOneBits: {
    keyword: `countOneBits`,
    src: `_ = countOneBits(1);`,
  },
  countTrailingZeros: {
    keyword: `countTrailingZeros`,
    src: `_ = countTrailingZeros(1);`,
  },
  cross: {
    keyword: `cross`,
    src: `_ = cross(vec3(1, 2, 3), vec3(4, 5, 6));`
  },
  degrees: {
    keyword: `degrees`,
    src: `_ = degrees(1);`
  },
  determinant: {
    keyword: `determinant`,
    src: `_ = determinant(mat2x2(1, 2, 3, 4));`
  },
  distance: {
    keyword: `distance`,
    src: `_ = distance(1, 2);`
  },
  dot: {
    keyword: `dot`,
    src: `_ = dot(vec2(1, 2,), vec2(2, 3));`
  },
  dot4U8Packed: {
    keyword: `dot4U8Packed`,
    src: `_ = dot4U8Packed(1, 2);`
  },
  dot4I8Packed: {
    keyword: `dot4I8Packed`,
    src: `_ = dot4I8Packed(1, 2);`
  },
  exp: {
    keyword: `exp`,
    src: `_ = exp(1);`
  },
  exp2: {
    keyword: `exp2`,
    src: `_ = exp2(2);`
  },
  extractBits: {
    keyword: `extractBits`,
    src: `_ = extractBits(1, 2, 3);`
  },
  f32: {
    keyword: `f32`,
    src: `_ = f32(1i);`
  },
  i32: {
    keyword: `i32`,
    src: `_ = i32(2u);`,
  },
  mat2x2_templated: {
    keyword: `mat2x2`,
    src: `_ = mat2x2<f32>(1, 2, 3, 4);`
  },
  mat2x2: {
    keyword: `mat2x2`,
    src: `_ = mat2x2(1, 2, 3, 4);`
  },
  mat2x3_templated: {
    keyword: `mat2x3`,
    src: `_ = mat2x3<f32>(1, 2, 3, 4, 5, 6);`
  },
  mat2x3: {
    keyword: `mat2x3`,
    src: `_ = mat2x3(1, 2, 3, 4, 5, 6);`
  },
  mat2x4_templated: {
    keyword: `mat2x4`,
    src: `_ = mat2x4<f32>(1, 2, 3, 4, 5, 6, 7, 8);`
  },
  mat2x4: {
    keyword: `mat2x4`,
    src: `_ = mat2x4(1, 2, 3, 4, 5, 6, 7, 8);`
  },
  mat3x2_templated: {
    keyword: `mat3x2`,
    src: `_ = mat3x2<f32>(1, 2, 3, 4, 5, 6);`
  },
  mat3x2: {
    keyword: `mat3x2`,
    src: `_ = mat3x2(1, 2, 3, 4, 5, 6);`
  },
  mat3x3_templated: {
    keyword: `mat3x3`,
    src: `_ = mat3x3<f32>(1, 2, 3, 4, 5, 6, 7, 8, 9);`
  },
  mat3x3: {
    keyword: `mat3x3`,
    src: `_ = mat3x3(1, 2, 3, 4, 5, 6, 7, 8, 9);`
  },
  mat3x4_templated: {
    keyword: `mat3x4`,
    src: `_ = mat3x4<f32>(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);`
  },
  mat3x4: {
    keyword: `mat3x4`,
    src: `_ = mat3x4(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);`
  },
  mat4x2_templated: {
    keyword: `mat4x2`,
    src: `_ = mat4x2<f32>(1, 2, 3, 4, 5, 6, 7, 8);`
  },
  mat4x2: {
    keyword: `mat4x2`,
    src: `_ = mat4x2(1, 2, 3, 4, 5, 6, 7, 8);`
  },
  mat4x3_templated: {
    keyword: `mat4x3`,
    src: `_ = mat4x3<f32>(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);`
  },
  mat4x3: {
    keyword: `mat4x3`,
    src: `_ = mat4x3(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);`
  },
  mat4x4_templated: {
    keyword: `mat4x4`,
    src: `_ = mat4x4<f32>(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16);`
  },
  mat4x4: {
    keyword: `mat4x4`,
    src: `_ = mat4x4(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16);`
  },
  min: {
    keyword: `min`,
    src: `_ = min(1, 2);`
  },
  select: {
    keyword: `select`,
    src: `_ = select(1, 2, false);`,
  },
  u32: {
    keyword: `u32`,
    src: `_ = u32(1i);`,
  },
  vec2_templated: {
    keyword: `vec2`,
    src: `_ = vec2<f32>(1, 2);`,
  },
  vec2: {
    keyword: `vec2`,
    src: `_ = vec2(1, 2);`,
  },
  vec3_templated: {
    keyword: `vec3`,
    src: `_ = vec3<f32>(1, 2, 3);`,
  },
  vec3: {
    keyword: `vec3`,
    src: `_ = vec3(1, 2, 3);`,
  },
  vec4_templated: {
    keyword: `vec4`,
    src: `_ = vec4<f32>(1, 2, 3, 4);`,
  },
  vec4: {
    keyword: `vec4`,
    src: `_ = vec4(1, 2, 3, 4);`,
  },


}

g.test('shadow_hides_builtin')
  .desc(
    `Test that shadows hide buitins.`
  )
  .params(u =>
    u.combine('builtin', keysOf(kTests))
    .combine('inject', ['', 'function', 'sibling', 'module'])
     .beginSubcases()
  )
  .fn(t => {
    let data = kTests[t.params.builtin];
    let value = `let ${data.keyword} = 4;`;

    let module_scope = t.params.inject === 'module' ? `var<private> ${data.keyword}` : ``;
    let sibling_func = t.params.inject === 'sibling' ? value : ``;
    let func = t.params.inject === 'function' ? value : ``;

    const code = `
struct Data {
  rt_arr: array<i32>,
}
@group(0) @binding(0) var<storage> placeholder: Data;

${module_scope}

fn sibling() {
  ${sibling_func}
}

@vertex
fn vtx() -> @builtin(position) vec4f {
  ${func}
  ${data.src}
  return vec4f(1);
}
    `;

    let pass = t.params.inject === 'module' || t.params.inject === 'sibling';
    t.expectCompileResult(pass, code);

  });

const kFloat16Tests = {
  f16: {
    keyword: `f16`,
    src: `_ = f16(2);`
  },
}

g.test('shadow_hides_builtin_f16')
  .desc(
    `Test that shadows hide buitins when shader-f16 is enabled.`
  )
  .params(u =>
    u.combine('builtin', keysOf(kFloat16Tests))
        .combine('inject', [true, false])

     .beginSubcases()
  )
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase({ requiredFeatures: ['shader-f16'] })
  })
  .fn(t => {
    let data = kFloat16Tests[t.params.builtin];
    let value = t.params.inject ? `let ${data.keyword} = 4;` : ``;

    const code = `
enable f16;

@vertex
fn vtx() -> @builtin(position) vec4f {
  ${value}
  ${data.src}
  return vec4f(1);
}
    `;
    t.expectCompileResult(!t.params.inject, code);

  });
