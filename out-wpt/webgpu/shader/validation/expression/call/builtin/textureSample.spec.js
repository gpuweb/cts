/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/const builtin = 'textureSample';export const description = `
Validation tests for the ${builtin}() builtin.

* test textureSample coords parameter must be correct type
* test textureSample array_index parameter must be correct type
* test textureSample coords parameter must be correct type
* test textureSample offset parameter must be correct type
* test textureSample offset parameter must be a const-expression
* test textureSample offset parameter must be between -8 and +7 inclusive
`;
import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { keysOf, objectsToRecord } from '../../../../../../common/util/data_tables.js';
import {
  Type,
  kAllScalarsAndVectors,
  isConvertible } from


'../../../../../util/conversion.js';
import { ShaderValidationTest } from '../../../shader_validation_test.js';







const kValidTextureSampleParameterTypes = {
  'texture_1d<f32>': { coordsArgType: Type.f32 },
  'texture_2d<f32>': { coordsArgType: Type.vec2f, offsetArgType: Type.vec2i },
  'texture_2d_array<f32>': {
    coordsArgType: Type.vec2f,
    hasArrayIndexArg: true,
    offsetArgType: Type.vec2i
  },
  'texture_3d<f32>': { coordsArgType: Type.vec3f, offsetArgType: Type.vec3i },
  'texture_cube<f32>': { coordsArgType: Type.vec3f },
  'texture_cube_array<f32>': { coordsArgType: Type.vec3f, hasArrayIndexArg: true },
  texture_depth_2d: { coordsArgType: Type.vec2f, offsetArgType: Type.vec2i },
  texture_depth_2d_array: { coordsArgType: Type.vec2f, hasArrayIndexArg: true },
  texture_depth_cube: { coordsArgType: Type.vec3f },
  texture_depth_cube_array: { coordsArgType: Type.vec3f, hasArrayIndexArg: true }
};

const kTextureTypes = keysOf(kValidTextureSampleParameterTypes);
const kValuesTypes = objectsToRecord(kAllScalarsAndVectors);

export const g = makeTestGroup(ShaderValidationTest);

g.test('coords_argument').
desc(
  `
Validates that only incorrect coords arguments are rejected by ${builtin}
`
).
params((u) =>
u.
combine('textureType', keysOf(kValidTextureSampleParameterTypes)).
combine('coordType', keysOf(kValuesTypes)).
beginSubcases().
combine('value', [-1, 0, 1]).
expand('offset', ({ textureType }) => {
  const offset = kValidTextureSampleParameterTypes[textureType].offsetArgType;
  return offset ? [false, true] : [false];
})
).
fn((t) => {
  const { textureType, coordType, offset, value } = t.params;
  const coordArgType = kValuesTypes[coordType];
  const {
    offsetArgType,
    coordsArgType: coordsRequiredType,
    hasArrayIndexArg
  } = kValidTextureSampleParameterTypes[textureType];

  const coordWGSL = coordArgType.create(value).wgsl();
  const arrayWGSL = hasArrayIndexArg ? ', 0' : '';
  const offsetWGSL = offset ? `, ${offsetArgType?.create(0).wgsl()}` : '';

  const code = `
@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var t: ${textureType};
@fragment fn fs() -> @location(0) vec4f {
  let v = textureSample(t, s, ${coordWGSL}${arrayWGSL}${offsetWGSL});
  return vec4f(0);
}
`;
  const expectSuccess = isConvertible(coordArgType, coordsRequiredType);
  t.expectCompileResult(expectSuccess, code);
});

g.test('array_index_argument').
desc(
  `
Validates that only incorrect array_index arguments are rejected by ${builtin}
`
).
params((u) =>
u.
combine('textureType', kTextureTypes)
// filter out types with no array_index
.filter(
  ({ textureType }) => !!kValidTextureSampleParameterTypes[textureType].hasArrayIndexArg
).
combine('arrayIndexType', keysOf(kValuesTypes)).
beginSubcases().
combine('value', [-9, -8, 0, 7, 8])
).
fn((t) => {
  const { textureType, arrayIndexType, value } = t.params;
  const arrayIndexArgType = kValuesTypes[arrayIndexType];
  const args = [arrayIndexArgType.create(value)];
  const { coordsArgType, offsetArgType } = kValidTextureSampleParameterTypes[textureType];

  const coordWGSL = coordsArgType.create(0).wgsl();
  const arrayWGSL = args.map((arg) => arg.wgsl()).join(', ');
  const offsetWGSL = offsetArgType ? `, ${offsetArgType.create(0).wgsl()}` : '';

  const code = `
@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var t: ${textureType};
@fragment fn fs() -> @location(0) vec4f {
  let v = textureSample(t, s, ${coordWGSL}, ${arrayWGSL}${offsetWGSL});
  return vec4f(0);
}
`;
  const expectSuccess =
  isConvertible(arrayIndexArgType, Type.i32) || isConvertible(arrayIndexArgType, Type.u32);
  t.expectCompileResult(expectSuccess, code);
});

g.test('offset_argument').
desc(
  `
Validates that only incorrect offset arguments are rejected by ${builtin}
`
).
params((u) =>
u.
combine('textureType', kTextureTypes)
// filter out types with no offset
.filter(
  ({ textureType }) =>
  kValidTextureSampleParameterTypes[textureType].offsetArgType !== undefined
).
combine('offsetType', keysOf(kValuesTypes)).
beginSubcases().
combine('value', [-9, -8, 0, 7, 8])
).
fn((t) => {
  const { textureType, offsetType, value } = t.params;
  const offsetArgType = kValuesTypes[offsetType];
  const args = [offsetArgType.create(value)];
  const {
    coordsArgType,
    hasArrayIndexArg,
    offsetArgType: offsetRequiredType
  } = kValidTextureSampleParameterTypes[textureType];

  const coordWGSL = coordsArgType.create(0).wgsl();
  const arrayWGSL = hasArrayIndexArg ? ', 0' : '';
  const offsetWGSL = args.map((arg) => arg.wgsl()).join(', ');

  const code = `
@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var t: ${textureType};
@fragment fn fs() -> @location(0) vec4f {
  let v = textureSample(t, s, ${coordWGSL}${arrayWGSL}, ${offsetWGSL});
  return vec4f(0);
}
`;
  const expectSuccess =
  isConvertible(offsetArgType, offsetRequiredType) && value >= -8 && value <= 7;
  t.expectCompileResult(expectSuccess, code);
});

g.test('offset_argument,non_const').
desc(
  `
Validates that only non-const offset arguments are rejected by ${builtin}
`
).
params((u) =>
u.
combine('textureType', kTextureTypes).
combine('varType', ['c', 'u', 'l'])
// filter out types with no offset
.filter(
  ({ textureType }) =>
  kValidTextureSampleParameterTypes[textureType].offsetArgType !== undefined
)
).
fn((t) => {
  const { textureType, varType } = t.params;
  const { coordsArgType, hasArrayIndexArg, offsetArgType } =
  kValidTextureSampleParameterTypes[textureType];

  const coordWGSL = coordsArgType.create(0).wgsl();
  const arrayWGSL = hasArrayIndexArg ? ', 0' : '';
  const offsetWGSL = `${offsetArgType}(${varType})`;
  const castWGSL = offsetArgType.elementType.toString();

  const code = `
@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var t: ${textureType};
@group(0) @binding(2) var<uniform> u: ${offsetArgType};
@fragment fn fs(@builtin(position) p: vec4f) -> @location(0) vec4f {
  const c = 1;
  let l = ${offsetArgType}(${castWGSL}(p.x));
  let v = textureSample(t, s, ${coordWGSL}${arrayWGSL}, ${offsetWGSL});
  return vec4f(0);
}
`;
  const expectSuccess = varType === 'c';
  t.expectCompileResult(expectSuccess, code);
});