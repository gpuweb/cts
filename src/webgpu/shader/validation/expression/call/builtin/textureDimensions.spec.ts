const builtin = 'textureDimensions';
export const description = `
Validation tests for the ${builtin}() builtin.

* test textureDimensions level parameter must be correct type
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { keysOf, objectsToRecord } from '../../../../../../common/util/data_tables.js';
import {
  Type,
  kAllScalarsAndVectors,
  isConvertible,
  isUnsignedType,
} from '../../../../../util/conversion.js';
import { ShaderValidationTest } from '../../../shader_validation_test.js';

const kTextureDimensionsNonDepthTextureTypes = [
  'texture_1d',
  'texture_2d',
  'texture_2d_array',
  'texture_cube',
  'texture_cube_array',
  'texture_3d',
] as const;

const kTextureDimensionsDepthTextureTypes = [
  'texture_depth_2d',
  'texture_depth_2d_array',
  'texture_depth_cube',
  'texture_depth_cube_array',
] as const;

const kTextureTypes = [
  ...kTextureDimensionsNonDepthTextureTypes,
  ...kTextureDimensionsDepthTextureTypes,
] as const;

const kValuesTypes = objectsToRecord(kAllScalarsAndVectors);

export const g = makeTestGroup(ShaderValidationTest);

g.test('level_argument')
  .specURL('https://gpuweb.github.io/gpuweb/wgsl/#texturedimensions')
  .desc(
    `
Validates that only incorrect level arguments are rejected by ${builtin}
`
  )
  .params(u =>
    u
      .combine('textureType', kTextureTypes)
      .combine('levelType', keysOf(kValuesTypes))
      .beginSubcases()
      .expand('format', t =>
        (kTextureDimensionsNonDepthTextureTypes as readonly string[]).includes(t.textureType)
          ? ['f32', 'i32', 'u32']
          : []
      )
      .combine('value', [-1, 0, 1] as const)
      // filter out unsigned types with negative values
      .filter(t => !isUnsignedType(kValuesTypes[t.levelType]) || t.value >= 0)
  )
  .fn(t => {
    const { textureType, levelType, format, value } = t.params;
    const levelArgType = kValuesTypes[levelType];

    const formatWGSL = format ? `<${format}>` : '';
    const levelWGSL = levelArgType.create(value).wgsl();

    const code = `
@group(0) @binding(0) var t: ${textureType}${formatWGSL};
@fragment fn fs() -> @location(0) vec4f {
  _ = textureDimensions(t, ${levelWGSL});
  return vec4f(0);
}
`;
    const expectSuccess =
      isConvertible(levelArgType, Type.i32) || isConvertible(levelArgType, Type.u32);
    t.expectCompileResult(expectSuccess, code);
  });
