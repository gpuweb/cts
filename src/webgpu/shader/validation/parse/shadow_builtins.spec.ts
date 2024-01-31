export const description = `Validation tests for identifiers`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { keysOf } from '../../../../common/util/data_tables.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('function_param')
  .desc(
    `Test that a function param can shadow a builtin, but the builtin is available for other params.`
  )
  .fn(t => {
    const code = `
fn f(f: i32, i32: i32, t: i32) -> i32 { return i32; }
    `;
    t.expectCompileResult(true, code);
  });

const kTests = {
  abs: {
    keyword: `abs`,
    src: `_ = abs(1);`,
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
    src: `_ = all(true);`,
  },
  any: {
    keyword: `any`,
    src: `_ = any(true);`,
  },
  array_templated: {
    keyword: `array`,
    src: `_ = array<i32, 2>(1, 2);`,
  },
  array: {
    keyword: `array`,
    src: `_ = array(1, 2);`,
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
    src: `_ = bool(1);`,
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
    src: `_ = clamp(1, 2, 3);`,
  },
  cos: {
    keyword: `cos`,
    src: `_ = cos(2);`,
  },
  cosh: {
    keyword: `cosh`,
    src: `_ = cosh(2.2);`,
  },
  countLeadingZeros: {
    keyword: `countLeadingZeros`,
    src: `_ = countLeadingZeros(1);`,
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
    src: `_ = cross(vec3(1, 2, 3), vec3(4, 5, 6));`,
  },
  degrees: {
    keyword: `degrees`,
    src: `_ = degrees(1);`,
  },
  determinant: {
    keyword: `determinant`,
    src: `_ = determinant(mat2x2(1, 2, 3, 4));`,
  },
  distance: {
    keyword: `distance`,
    src: `_ = distance(1, 2);`,
  },
  dot: {
    keyword: `dot`,
    src: `_ = dot(vec2(1, 2,), vec2(2, 3));`,
  },
  dot4U8Packed: {
    keyword: `dot4U8Packed`,
    src: `_ = dot4U8Packed(1, 2);`,
  },
  dot4I8Packed: {
    keyword: `dot4I8Packed`,
    src: `_ = dot4I8Packed(1, 2);`,
  },
  dpdx: {
    keyword: `dpdx`,
    src: `_ = dpdx(2);`,
  },
  dpdxCoarse: {
    keyword: `dpdxCoarse`,
    src: `_ = dpdxCoarse(2);`,
  },
  dpdxFine: {
    keyword: `dpdxFine`,
    src: `_ = dpdxFine(2);`,
  },
  dpdy: {
    keyword: `dpdy`,
    src: `_ = dpdy(2);`,
  },
  dpdyCoarse: {
    keyword: `dpdyCoarse`,
    src: `_ = dpdyCoarse(2);`,
  },
  dpdyFine: {
    keyword: `dpdyFine`,
    src: `_ = dpdyFine(2);`,
  },
  exp: {
    keyword: `exp`,
    src: `_ = exp(1);`,
  },
  exp2: {
    keyword: `exp2`,
    src: `_ = exp2(2);`,
  },
  extractBits: {
    keyword: `extractBits`,
    src: `_ = extractBits(1, 2, 3);`,
  },
  f32: {
    keyword: `f32`,
    src: `_ = f32(1i);`,
  },
  faceForward: {
    keyword: `faceForward`,
    src: `_ = faceForward(vec2(1, 2), vec2(3, 4), vec2(5, 6));`,
  },
  firstLeadingBit: {
    keyword: `firstLeadingBit`,
    src: `_ = firstLeadingBit(1);`,
  },
  firstTrailingBit: {
    keyword: `firstTrailingBit`,
    src: `_ = firstTrailingBit(1);`,
  },
  floor: {
    keyword: `floor`,
    src: `_ = floor(1.2);`,
  },
  fma: {
    keyword: `fma`,
    src: `_ = fma(1, 2, 3);`,
  },
  fract: {
    keyword: `fract`,
    src: `_ = fract(1);`,
  },
  frexp: {
    keyword: `frexp`,
    src: `_ = frexp(1);`,
  },
  fwidth: {
    keyword: `fwidth`,
    src: `_ = fwidth(2);`,
  },
  fwidthCoarse: {
    keyword: `fwidthCoarse`,
    src: `_ = fwidthCoarse(2);`,
  },
  fwidthFine: {
    keyword: `fwidthFine`,
    src: `_ = fwidthFine(2);`,
  },
  i32: {
    keyword: `i32`,
    src: `_ = i32(2u);`,
  },
  insertBits: {
    keyword: `insertBits`,
    src: `_ = insertBits(1, 2, 3, 4);`,
  },
  inverseSqrt: {
    keyword: `inverseSqrt`,
    src: `_ = inverseSqrt(1);`,
  },
  ldexp: {
    keyword: `ldexp`,
    src: `_ = ldexp(1, 2);`,
  },
  length: {
    keyword: `length`,
    src: `_ = length(1);`,
  },
  log: {
    keyword: `log`,
    src: `_ = log(2);`,
  },
  log2: {
    keyword: `log2`,
    src: `_ = log2(2);`,
  },
  mat2x2_templated: {
    keyword: `mat2x2`,
    src: `_ = mat2x2<f32>(1, 2, 3, 4);`,
  },
  mat2x2: {
    keyword: `mat2x2`,
    src: `_ = mat2x2(1, 2, 3, 4);`,
  },
  mat2x3_templated: {
    keyword: `mat2x3`,
    src: `_ = mat2x3<f32>(1, 2, 3, 4, 5, 6);`,
  },
  mat2x3: {
    keyword: `mat2x3`,
    src: `_ = mat2x3(1, 2, 3, 4, 5, 6);`,
  },
  mat2x4_templated: {
    keyword: `mat2x4`,
    src: `_ = mat2x4<f32>(1, 2, 3, 4, 5, 6, 7, 8);`,
  },
  mat2x4: {
    keyword: `mat2x4`,
    src: `_ = mat2x4(1, 2, 3, 4, 5, 6, 7, 8);`,
  },
  mat3x2_templated: {
    keyword: `mat3x2`,
    src: `_ = mat3x2<f32>(1, 2, 3, 4, 5, 6);`,
  },
  mat3x2: {
    keyword: `mat3x2`,
    src: `_ = mat3x2(1, 2, 3, 4, 5, 6);`,
  },
  mat3x3_templated: {
    keyword: `mat3x3`,
    src: `_ = mat3x3<f32>(1, 2, 3, 4, 5, 6, 7, 8, 9);`,
  },
  mat3x3: {
    keyword: `mat3x3`,
    src: `_ = mat3x3(1, 2, 3, 4, 5, 6, 7, 8, 9);`,
  },
  mat3x4_templated: {
    keyword: `mat3x4`,
    src: `_ = mat3x4<f32>(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);`,
  },
  mat3x4: {
    keyword: `mat3x4`,
    src: `_ = mat3x4(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);`,
  },
  mat4x2_templated: {
    keyword: `mat4x2`,
    src: `_ = mat4x2<f32>(1, 2, 3, 4, 5, 6, 7, 8);`,
  },
  mat4x2: {
    keyword: `mat4x2`,
    src: `_ = mat4x2(1, 2, 3, 4, 5, 6, 7, 8);`,
  },
  mat4x3_templated: {
    keyword: `mat4x3`,
    src: `_ = mat4x3<f32>(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);`,
  },
  mat4x3: {
    keyword: `mat4x3`,
    src: `_ = mat4x3(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);`,
  },
  mat4x4_templated: {
    keyword: `mat4x4`,
    src: `_ = mat4x4<f32>(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16);`,
  },
  mat4x4: {
    keyword: `mat4x4`,
    src: `_ = mat4x4(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16);`,
  },
  max: {
    keyword: `max`,
    src: `_ = max(1, 2);`,
  },
  min: {
    keyword: `min`,
    src: `_ = min(1, 2);`,
  },
  mix: {
    keyword: `mix`,
    src: `_ = mix(1, 2, 3);`,
  },
  modf: {
    keyword: `modf`,
    src: `_ = modf(1.2);`,
  },
  normalize: {
    keyword: `normalize`,
    src: `_ = normalize(vec2(1, 2));`,
  },
  pow: {
    keyword: `pow`,
    src: `_ = pow(1, 2);`,
  },
  quantizeToF16: {
    keyword: `quantizeToF16`,
    src: `_ = quantizeToF16(1.2);`,
  },
  radians: {
    keyword: `radians`,
    src: `_ = radians(1.2);`,
  },
  reflect: {
    keyword: `reflect`,
    src: `_ = reflect(vec2(1, 2), vec2(3, 4));`,
  },
  refract: {
    keyword: `refract`,
    src: `_ = refract(vec2(1, 1), vec2(2, 2), 3);`,
  },
  reverseBits: {
    keyword: `reverseBits`,
    src: `_ = reverseBits(1);`,
  },
  round: {
    keyword: `round`,
    src: `_ = round(1.2);`,
  },
  saturate: {
    keyword: `saturate`,
    src: `_ = saturate(1);`,
  },
  select: {
    keyword: `select`,
    src: `_ = select(1, 2, false);`,
  },
  sign: {
    keyword: `sign`,
    src: `_ = sign(1);`,
  },
  sin: {
    keyword: `sin`,
    src: `_ = sin(2);`,
  },
  sinh: {
    keyword: `sinh`,
    src: `_ = sinh(3);`,
  },
  smoothstep: {
    keyword: `smoothstep`,
    src: `_ = smoothstep(1, 2, 3);`,
  },
  sqrt: {
    keyword: `sqrt`,
    src: `_ = sqrt(24);`,
  },
  step: {
    keyword: `step`,
    src: `_ = step(4, 5);`,
  },
  tan: {
    keyword: `tan`,
    src: `_ = tan(2);`,
  },
  tanh: {
    keyword: `tanh`,
    src: `_ = tanh(2);`,
  },
  transpose: {
    keyword: `transpose`,
    src: `_ = transpose(mat2x2(1, 2, 3, 4));`,
  },
  trunc: {
    keyword: `trunc`,
    src: `_ = trunc(2);`,
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
};

g.test('shadow_hides_builtin')
  .desc(`Test that shadows hide buitins.`)
  .params(u =>
    u
      .combine('builtin', keysOf(kTests))
      .combine('inject', ['none', 'function', 'sibling', 'module'])
      .beginSubcases()
  )
  .fn(t => {
    const data = kTests[t.params.builtin];
    const value = `let ${data.keyword} = 4;`;

    const module_scope = t.params.inject === 'module' ? `var<private> ${data.keyword} : i32;` : ``;
    const sibling_func = t.params.inject === 'sibling' ? value : ``;
    const func = t.params.inject === 'function' ? value : ``;

    const code = `
struct Data {
  rt_arr: array<i32>,
}
@group(0) @binding(0) var<storage> placeholder: Data;

${module_scope}

fn sibling() {
  ${sibling_func}
}

@fragment
fn main() -> @location(0) vec4f {
  ${func}
  ${data.src}
  return vec4f(1);
}
    `;

    const pass = t.params.inject === 'none' || t.params.inject === 'sibling';
    t.expectCompileResult(pass, code);
  });

const kFloat16Tests = {
  f16: {
    keyword: `f16`,
    src: `_ = f16(2);`,
  },
};

g.test('shadow_hides_builtin_f16')
  .desc(`Test that shadows hide buitins when shader-f16 is enabled.`)
  .params(u =>
    u
      .combine('builtin', keysOf(kFloat16Tests))
      .combine('inject', ['none', 'function', 'sibling', 'module'])

      .beginSubcases()
  )
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase({ requiredFeatures: ['shader-f16'] });
  })
  .fn(t => {
    const data = kFloat16Tests[t.params.builtin];
    const value = `let ${data.keyword} = 4;`;

    const module_scope = t.params.inject === 'module' ? `var<private> ${data.keyword} : f16;` : ``;
    const sibling_func = t.params.inject === 'sibling' ? value : ``;
    const func = t.params.inject === 'function' ? value : ``;

    const code = `
enable f16;

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
    const pass = t.params.inject === 'none' || t.params.inject === 'sibling';
    t.expectCompileResult(pass, code);
  });

const kTextureTypeTests = {
  texture_1d: {
    keyword: `texture_1d`,
    src: `var t: texture_1d<f32>;`,
  },
  texture_2d: {
    keyword: `texture_2d`,
    src: `var t: texture_2d<f32>;`,
  },
  texture_2d_array: {
    keyword: `texture_2d_array`,
    src: `var t: texture_2d_array<f32>;`,
  },
  texture_3d: {
    keyword: `texture_3d`,
    src: `var t: texture_3d<f32>;`,
  },
  texture_cube: {
    keyword: `texture_cube`,
    src: `var t: texture_cube<f32>;`,
  },
  texture_cube_array: {
    keyword: `texture_cube_array`,
    src: `var t: texture_cube_array<f32>;`,
  },
  texture_multisampled_2d: {
    keyword: `texture_multisampled_2d`,
    src: `var t: texture_multisampled_2d<f32>;`,
  },
  texture_depth_multisampled_2d: {
    keyword: `texture_depth_multisampled_2d`,
    src: `var t: texture_depth_multisampled_2d;`,
  },
  texture_external: {
    keyword: `texture_external`,
    src: `var t: texture_external;`,
  },
  texture_storage_1d: {
    keyword: `texture_storage_1d`,
    src: `var t: texture_storage_1d<rgba8unorm, read_write>;`,
  },
  texture_storage_2d: {
    keyword: `texture_storage_2d`,
    src: `var t: texture_storage_2d<rgba8unorm, read_write>;`,
  },
  texture_storage_2d_array: {
    keyword: `texture_storage_2d_array`,
    src: `var t: texture_storage_2d_array<rgba8unorm, read_write>;`,
  },
  texture_storage_3d: {
    keyword: `texture_storage_3d`,
    src: `var t: texture_storage_3d<rgba8unorm, read_write>;`,
  },
  texture_depth_2d: {
    keyword: `texture_depth_2d`,
    src: `var t: texture_depth_2d;`,
  },
  texture_depth_2d_array: {
    keyword: `texture_depth_2d_array`,
    src: `var t: texture_depth_2d_array;`,
  },
  texture_depth_cube: {
    keyword: `texture_depth_cube`,
    src: `var t: texture_depth_cube;`,
  },
  texture_depth_cube_array: {
    keyword: `texture_depth_cube_array`,
    src: `var t: texture_depth_cube_array;`,
  },
  sampler: {
    keyword: `sampler`,
    src: `var s: sampler;`,
  },
  sampler_comparison: {
    keyword: `sampler_comparison`,
    src: `var s: sampler_comparison;`,
  },
};

g.test('shadow_hides_builtin_texture_type')
  .desc(`Test that shadows hide buitins when textures are used.`)
  .params(u =>
    u
      .combine('builtin', keysOf(kTextureTypeTests))
      .combine('inject', ['none', 'function', 'module'])

      .beginSubcases()
  )
  .fn(t => {
    const data = kTextureTypeTests[t.params.builtin];
    const value = `let ${data.keyword} = 4;`;

    const module_scope = t.params.inject === 'module' ? `var<private> ${data.keyword} : f32;` : ``;
    const func = t.params.inject === 'function' ? value : ``;

    const code = `
${module_scope}
@group(0) @binding(0) ${data.src}

fn func() {
  ${func}
}
    `;
    const pass = t.params.inject === 'none' || t.params.inject === 'function';
    t.expectCompileResult(pass, code);
  });

const kTextureTests = {
  textureDimensions: {
    keyword: `textureDimensions`,
    src: `_ = textureDimensions(t_2d);`,
  },
  textureGather: {
    keyword: `textureGather`,
    src: `_ = textureGather(1, t_2d, s, vec2(1, 2));`,
  },
  textureGatherCompare: {
    keyword: `textureGatherCompare`,
    src: `_ = textureGatherCompare(t_2d_depth, sc, vec2(1, 2), 3);`,
  },
  textureLoad: {
    keyword: `textureLoad`,
    src: `_ = textureLoad(t_2d, vec2(1, 2), 1);`,
  },
  textureNumLayers: {
    keyword: `textureNumLayers`,
    src: `_ = textureNumLayers(t_2d_array);`,
  },
  textureNumLevels: {
    keyword: `textureNumLevels`,
    src: `_ = textureNumLevels(t_2d);`,
  },
  textureNumSamples: {
    keyword: `textureNumSamples`,
    src: `_ = textureNumSamples(t_2d_ms);`,
  },
  textureSample: {
    keyword: `textureSample`,
    src: `_ = textureSample(t_2d, s, vec2(1, 2));`,
  },
  textureSampleBias: {
    keyword: `textureSampleBias`,
    src: `_ = textureSampleBias(t_2d, s, vec2(1, 2), 2);`,
  },
  textureSampleCompare: {
    keyword: `textureSampleCompare`,
    src: `_ = textureSampleCompare(t_2d_depth, sc, vec2(1, 2), 2);`,
  },
  textureSampleCompareLevel: {
    keyword: `textureSampleCompareLevel`,
    src: `_ = textureSampleCompareLevel(t_2d_depth, sc, vec2(1, 2), 3, vec2(1, 2));`,
  },
  textureSampleGrad: {
    keyword: `textureSampleGrad`,
    src: `_ = textureSampleGrad(t_2d, s, vec2(1, 2), vec2(1, 2), vec2(1, 2));`,
  },
  textureSampleLevel: {
    keyword: `textureSampleLevel`,
    src: `_ = textureSampleLevel(t_2d, s, vec2(1, 2), 3);`,
  },
  textureSampleBaseClampToEdge: {
    keyword: `textureSampleBaseClampToEdge`,
    src: `_ = textureSampleBaseClampToEdge(t_2d, s, vec2(1, 2));`,
  },
};

g.test('shadow_hides_builtin_texture')
  .desc(`Test that shadows hide texture buitins.`)
  .params(u =>
    u
      .combine('builtin', keysOf(kTextureTests))
      .combine('inject', ['none', 'function', 'sibling', 'module'])
      .beginSubcases()
  )
  .fn(t => {
    const data = kTextureTests[t.params.builtin];
    const value = `let ${data.keyword} = 4;`;

    const module_scope = t.params.inject === 'module' ? `var<private> ${data.keyword} : i32;` : ``;
    const sibling_func = t.params.inject === 'sibling' ? value : ``;
    const func = t.params.inject === 'function' ? value : ``;

    const code = `
@group(0) @binding(0) var t_2d: texture_2d<f32>;
@group(0) @binding(1) var t_2d_depth: texture_depth_2d;
@group(0) @binding(2) var t_2d_array: texture_2d_array<f32>;
@group(0) @binding(3) var t_2d_ms: texture_multisampled_2d<f32>;

@group(1) @binding(0) var s: sampler;
@group(1) @binding(1) var sc: sampler_comparison;

${module_scope}

fn sibling() {
  ${sibling_func}
}

@fragment
fn main() -> @location(0) vec4f {
  ${func}
  ${data.src}
  return vec4f(1);
}
    `;

    const pass = t.params.inject === 'none' || t.params.inject === 'sibling';
    t.expectCompileResult(pass, code);
  });

g.test('shadow_hides_builtin_atomic_type')
  .desc(`Test that shadows hide buitins when atomic types are used.`)
  .params(u =>
    u
      .combine('inject', ['none', 'function', 'module'])

      .beginSubcases()
  )
  .fn(t => {
    const value = `let atomic = 4;`;
    const module_scope = t.params.inject === 'module' ? `var<private> atomic: i32;` : ``;
    const func = t.params.inject === 'function' ? value : ``;

    const code = `
${module_scope}

var<workgroup> val: atomic<i32>;

fn func() {
  ${func}
}
    `;
    const pass = t.params.inject === 'none' || t.params.inject === 'function';
    t.expectCompileResult(pass, code);
  });
