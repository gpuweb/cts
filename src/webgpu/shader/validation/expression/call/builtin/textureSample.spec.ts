const builtin = 'textureSample';
export const description = `
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
  isConvertible,
  ScalarType,
  VectorType,
} from '../../../../../util/conversion.js';
import { ShaderValidationTest } from '../../../shader_validation_test.js';

/* Argument names from the WGSL spec */
type TextureSampleArguments = {
  coords: ScalarType | VectorType;
  array_index?: boolean;
  offset?: VectorType;
};

const kValidTextureSampleParameterTypes: { [n: string]: TextureSampleArguments } = {
  'texture_1d<f32>': { coords: Type.f32 },
  'texture_2d<f32>': { coords: Type.vec2f, offset: Type.vec2i },
  'texture_2d_array<f32>': { coords: Type.vec2f, array_index: true, offset: Type.vec2i },
  'texture_3d<f32>': { coords: Type.vec3f, offset: Type.vec3i },
  'texture_cube<f32>': { coords: Type.vec3f },
  'texture_cube_array<f32>': { coords: Type.vec3f, array_index: true },
  texture_depth_2d: { coords: Type.vec2f, offset: Type.vec2i },
  texture_depth_2d_array: { coords: Type.vec2f, array_index: true },
  texture_depth_cube: { coords: Type.vec3f },
  texture_depth_cube_array: { coords: Type.vec3f, array_index: true },
} as const;

const kTextureTypes = keysOf(kValidTextureSampleParameterTypes);
const kValuesTypes = objectsToRecord(kAllScalarsAndVectors);

export const g = makeTestGroup(ShaderValidationTest);

g.test('coords_argument')
  .desc(
    `
Validates that only incorrect coords arguments are rejected by ${builtin}
`
  )
  .params(u =>
    u
      .combine('textureType', keysOf(kValidTextureSampleParameterTypes))
      .combine('coordType', keysOf(kValuesTypes))
      .beginSubcases()
      .combine('value', [-1, 0, 1] as const)
      .expand('offset', ({ textureType }) => {
        const offset = kValidTextureSampleParameterTypes[textureType].offset;
        return offset ? [false, true] : [false];
      })
  )
  .fn(t => {
    const { textureType, coordType, offset, value } = t.params;
    const coordArgType = kValuesTypes[coordType];
    const {
      offset: offsetArgType,
      coords: coordsRequiredType,
      array_index: arrayIndex,
    } = kValidTextureSampleParameterTypes[textureType];

    const coordWGSL = coordArgType.create(value).wgsl();
    const arrayWGSL = arrayIndex ? ', 0' : '';
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

g.test('array_index_argument')
  .desc(
    `
Validates that only incorrect array_index arguments are rejected by ${builtin}
`
  )
  .params(u =>
    u
      .combine('textureType', kTextureTypes)
      // filter out types with no array_index
      .filter(({ textureType }) => !!kValidTextureSampleParameterTypes[textureType].array_index)
      .combine('arrayIndexType', keysOf(kValuesTypes))
      .beginSubcases()
      .combine('value', [-9, -8, 0, 7, 8])
  )
  .fn(t => {
    const { textureType, arrayIndexType, value } = t.params;
    const arrayIndexArgType = kValuesTypes[arrayIndexType];
    const args = [arrayIndexArgType.create(value)];
    const { coords, offset = undefined } = kValidTextureSampleParameterTypes[textureType];

    const coordWGSL = coords.create(0).wgsl();
    const arrayWGSL = args.map(arg => arg.wgsl()).join(', ');
    const offsetWGSL = offset ? `, ${offset.create(0).wgsl()}` : '';

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

g.test('offset_argument')
  .desc(
    `
Validates that only incorrect offset arguments are rejected by ${builtin}
`
  )
  .params(u =>
    u
      .combine('textureType', kTextureTypes)
      // filter out types with no offset
      .filter(
        ({ textureType }) => kValidTextureSampleParameterTypes[textureType].offset !== undefined
      )
      .combine('offsetType', keysOf(kValuesTypes))
      .beginSubcases()
      .combine('value', [-9, -8, 0, 7, 8])
  )
  .fn(t => {
    const { textureType, offsetType, value } = t.params;
    const offsetArgType = kValuesTypes[offsetType];
    const args = [offsetArgType.create(value)];
    const {
      coords,
      array_index,
      offset: offsetRequiredType = undefined,
    } = kValidTextureSampleParameterTypes[textureType];

    const coordWGSL = coords.create(0).wgsl();
    const arrayWGSL = array_index ? ', 0' : '';
    const offsetWGSL = args.map(arg => arg.wgsl()).join(', ');

    const code = `
@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var t: ${textureType};
@fragment fn fs() -> @location(0) vec4f {
  let v = textureSample(t, s, ${coordWGSL}${arrayWGSL}, ${offsetWGSL});
  return vec4f(0);
}
`;

    const expectSuccess =
      isConvertible(offsetArgType, offsetRequiredType!) && value >= -8 && value <= 7;
    t.expectCompileResult(expectSuccess, code);
  });

g.test('offset_argument,non_const')
  .desc(
    `
Validates that only non-const offset arguments are rejected by ${builtin}
`
  )
  .params(u =>
    u
      .combine('textureType', kTextureTypes)
      .combine('varType', ['c', 'u', 'l'])
      // filter out types with no offset
      .filter(
        ({ textureType }) => kValidTextureSampleParameterTypes[textureType].offset !== undefined
      )
  )
  .fn(t => {
    const { textureType, varType } = t.params;
    const {
      coords,
      array_index,
      offset = Type.vec2f,
    } = kValidTextureSampleParameterTypes[textureType];

    const coordWGSL = coords.create(0).wgsl();
    const arrayWGSL = array_index ? ', 0' : '';
    const offsetWGSL = `${offset}(${varType})`;
    const castWGSL = offset.elementType.toString();

    const code = `
@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var t: ${textureType};
@group(0) @binding(2) var<uniform> u: ${offset};
@fragment fn fs(@builtin(position) p: vec4f) -> @location(0) vec4f {
  const c = 1;
  let l = ${offset}(${castWGSL}(p.x));
  let v = textureSample(t, s, ${coordWGSL}${arrayWGSL}, ${offsetWGSL});
  return vec4f(0);
}
`;

    const expectSuccess = varType === 'c';
    t.expectCompileResult(expectSuccess, code);
  });
