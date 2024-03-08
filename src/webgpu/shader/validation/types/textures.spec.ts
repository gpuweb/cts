export const description = `
Validation tests for various texture types in shaders.

TODO:
- Sampled Texture Types
- Multisampled Texture Types
- External Sampled Texture Types
- Depth Texture Types
- Sampler Types
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import {
  isTextureFormatUsableAsStorageFormat,
  kAllTextureFormats,
  kColorTextureFormats,
  kTextureFormatInfo,
} from '../../../format_info.js';
import { getPlainTypeInfo } from '../../../util/shader.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('texel_formats')
  .desc(
    'Test channels and channel format of various texel formats when using as the storage texture format'
  )
  .params(u =>
    u
      .combine('format', kColorTextureFormats)
      .filter(p => kTextureFormatInfo[p.format].color.storage)
      .beginSubcases()
      .combine('shaderScalarType', ['f32', 'u32', 'i32', 'bool', 'f16'] as const)
  )
  .beforeAllSubcases(t => {
    if (t.params.shaderScalarType === 'f16') {
      t.selectDeviceOrSkipTestCase({ requiredFeatures: ['shader-f16'] });
    }

    if (!isTextureFormatUsableAsStorageFormat(t.params.format, t.isCompatibility)) {
      t.skip('storage usage is unsupported');
    }
  })
  .fn(t => {
    const { format, shaderScalarType } = t.params;
    const info = kTextureFormatInfo[format];
    const validShaderScalarType = getPlainTypeInfo(info.color.type);
    const shaderValueType = `vec4<${shaderScalarType}>`;
    const wgsl = `
    @group(0) @binding(0) var tex: texture_storage_2d<${format}, read>;
    @compute @workgroup_size(1) fn main() {
        let v : ${shaderValueType} = textureLoad(tex, vec2u(0));
        _ = v;
    }
`;
    t.expectCompileResult(validShaderScalarType === shaderScalarType, wgsl);
  });

g.test('texel_formats,as_value')
  .desc('Test that texel format cannot be used as value')
  .fn(t => {
    const wgsl = `
    @compute @workgroup_size(1) fn main() {
        var i = rgba8unorm;
    }
`;
    t.expectCompileResult(false, wgsl);
  });

g.test('storage_texture_types')
  .desc(
    `Test that for texture_storage_xx<format, access>
- format must be an enumerant for one of the texel formats for storage textures
- access must be an enumerant for one of the access modes
`
  )
  .params(u =>
    u
      .combine('format', kAllTextureFormats)
      .combine('access', ['read', 'write', 'read_write'] as const)
  )
  .fn(t => {
    const { format, access } = t.params;
    const info = kTextureFormatInfo[format];
    let storage = info.color?.storage || info.depth?.storage || info.stencil?.storage || false;
    if (t.isCompatibility) {
      // Adjust if storage is supported under compatibility mode for formats in kCompatModeUnsupportedStorageTextureFormats.
      storage = isTextureFormatUsableAsStorageFormat(format, t.isCompatibility);
    }
    const readWriteStorage =
      info.color?.readWriteStorage ||
      info.depth?.readWriteStorage ||
      info.stencil?.readWriteStorage ||
      false;
    const valid = access === 'read_write' ? readWriteStorage : storage;
    const wgsl = `@group(0) @binding(0) var tex: texture_storage_2d<${format}, ${access}>;`;
    t.expectCompileResult(valid, wgsl);
  });
