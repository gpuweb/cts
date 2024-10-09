export const description = `
Execution tests for the 'textureSampleBias' builtin function

Samples a texture with a bias to the mip level.

- TODO: test cube maps with more than one mip level.
- TODO: Test un-encodable formats.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { kCompressedTextureFormats, kEncodableTextureFormats } from '../../../../../format_info.js';
import { TextureTestMixin } from '../../../../../gpu_test.js';

import {
  vec2,
  vec3,
  TextureCall,
  generateTextureBuiltinInputs2D,
  generateTextureBuiltinInputs3D,
  kSamplePointMethods,
  doTextureCalls,
  checkCallResults,
  createTextureWithRandomDataAndGetTexels,
  generateSamplePointsCube,
  kCubeSamplePointMethods,
  SamplePointMethods,
  chooseTextureSize,
  isPotentiallyFilterableAndFillable,
  skipIfTextureFormatNotSupportedNotAvailableOrNotFilterable,
  getTextureTypeForTextureViewDimension,
  WGSLTextureSampleTest,
  isSupportedViewFormatCombo,
} from './texture_utils.js';

const kTestableColorFormats = [...kEncodableTextureFormats, ...kCompressedTextureFormats] as const;

export const g = makeTestGroup(TextureTestMixin(WGSLTextureSampleTest));

g.test('sampled_2d_coords')
  .specURL('https://www.w3.org/TR/WGSL/#texturesamplebias')
  .desc(
    `
fn textureSampleBias(t: texture_2d<f32>, s: sampler, coords: vec2<f32>, bias: f32) -> vec4<f32>
fn textureSampleBias(t: texture_2d<f32>, s: sampler, coords: vec2<f32>, bias: f32, offset: vec2<i32>) -> vec4<f32>

Parameters:
 * t: The sampled texture to read from
 * s: The sampler type
 * coords: The texture coordinates
 * bias: The bias to apply to the mip level before sampling. bias must be between -16.0 and 15.99.
 * offset:
    - The optional texel offset applied to the unnormalized texture coordinate before sampling the texture.
      This offset is applied before applying any texture wrapping modes.
    - The offset expression must be a creation-time expression (e.g. vec2<i32>(1, 2)).
    - Each offset component must be at least -8 and at most 7.
      Values outside of this range will result in a shader-creation error.
`
  )
  .params(u =>
    u
      .combine('format', kTestableColorFormats)
      .filter(t => isPotentiallyFilterableAndFillable(t.format))
      .combine('samplePoints', kSamplePointMethods)
      .beginSubcases()
      .combine('addressModeU', ['clamp-to-edge', 'repeat', 'mirror-repeat'] as const)
      .combine('addressModeV', ['clamp-to-edge', 'repeat', 'mirror-repeat'] as const)
      .combine('minFilter', ['nearest', 'linear'] as const)
      .combine('offset', [false, true] as const)
  )
  .beforeAllSubcases(t =>
    skipIfTextureFormatNotSupportedNotAvailableOrNotFilterable(t, t.params.format)
  )
  .fn(async t => {
    const { format, samplePoints, addressModeU, addressModeV, minFilter, offset } = t.params;

    // We want at least 4 blocks or something wide enough for 3 mip levels.
    const [width, height] = chooseTextureSize({ minSize: 8, minBlocks: 4, format });

    const descriptor: GPUTextureDescriptor = {
      format,
      size: { width, height },
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
      mipLevelCount: 3,
    };
    const { texels, texture } = await createTextureWithRandomDataAndGetTexels(t, descriptor);
    const sampler: GPUSamplerDescriptor = {
      addressModeU,
      addressModeV,
      minFilter,
      magFilter: minFilter,
      mipmapFilter: minFilter,
    };

    const calls: TextureCall<vec2>[] = generateTextureBuiltinInputs2D(50, {
      sampler,
      method: samplePoints,
      descriptor,
      bias: true,
      offset,
      hashInputs: [format, samplePoints, addressModeU, addressModeV, minFilter, offset],
    }).map(({ coords, derivativeMult, offset, bias }) => {
      return {
        builtin: 'textureSampleBias',
        coordType: 'f',
        coords,
        derivativeMult,
        bias,
        offset,
      };
    });
    const viewDescriptor = {};
    const textureType = 'texture_2d<f32>';
    const results = await doTextureCalls(t, texture, viewDescriptor, textureType, sampler, calls);
    const res = await checkCallResults(
      t,
      { texels, descriptor, viewDescriptor },
      textureType,
      sampler,
      calls,
      results
    );
    t.expectOK(res);
  });

g.test('sampled_3d_coords')
  .specURL('https://www.w3.org/TR/WGSL/#texturesamplebias')
  .desc(
    `
fn textureSampleBias(t: texture_3d<f32>, s: sampler, coords: vec3<f32>, bias: f32) -> vec4<f32>
fn textureSampleBias(t: texture_3d<f32>, s: sampler, coords: vec3<f32>, bias: f32, offset: vec3<i32>) -> vec4<f32>
fn textureSampleBias(t: texture_cube<f32>, s: sampler, coords: vec3<f32>, bias: f32) -> vec4<f32>

Parameters:
 * t: The sampled texture to read from
 * s: The sampler type
 * coords: The texture coordinates
 * bias: The bias to apply to the mip level before sampling. bias must be between -16.0 and 15.99.
 * offset:
    - The optional texel offset applied to the unnormalized texture coordinate before sampling the texture.
      This offset is applied before applying any texture wrapping modes.
    - The offset expression must be a creation-time expression (e.g. vec2<i32>(1, 2)).
    - Each offset component must be at least -8 and at most 7.
      Values outside of this range will result in a shader-creation error.
`
  )
  .params(u =>
    u
      .combine('format', kTestableColorFormats)
      .filter(t => isPotentiallyFilterableAndFillable(t.format))
      .combine('viewDimension', ['3d', 'cube'] as const)
      .filter(t => isSupportedViewFormatCombo(t.format, t.viewDimension))
      .combine('samplePoints', kCubeSamplePointMethods)
      .filter(t => t.samplePoints !== 'cube-edges' || t.viewDimension !== '3d')
      .beginSubcases()
      .combine('addressModeU', ['clamp-to-edge', 'repeat', 'mirror-repeat'] as const)
      .combine('addressModeV', ['clamp-to-edge', 'repeat', 'mirror-repeat'] as const)
      .combine('addressModeW', ['clamp-to-edge', 'repeat', 'mirror-repeat'] as const)
      .combine('minFilter', ['nearest', 'linear'] as const)
      .combine('offset', [false, true] as const)
      .filter(t => t.viewDimension !== 'cube' || t.offset !== true)
  )
  .beforeAllSubcases(t =>
    skipIfTextureFormatNotSupportedNotAvailableOrNotFilterable(t, t.params.format)
  )
  .fn(async t => {
    const {
      format,
      viewDimension,
      samplePoints,
      addressModeU,
      addressModeV,
      addressModeW,
      minFilter,
      offset,
    } = t.params;

    const size = chooseTextureSize({ minSize: 8, minBlocks: 2, format, viewDimension });
    const descriptor: GPUTextureDescriptor = {
      format,
      dimension: viewDimension === '3d' ? '3d' : '2d',
      ...(t.isCompatibility && { textureBindingViewDimension: viewDimension }),
      size,
      // MAINTENANCE_TODO: use 3 for cube maps when derivatives are supported for cube maps.
      mipLevelCount: viewDimension === '3d' ? 3 : 1,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    };
    const { texels, texture } = await createTextureWithRandomDataAndGetTexels(t, descriptor);
    const sampler: GPUSamplerDescriptor = {
      addressModeU,
      addressModeV,
      addressModeW,
      minFilter,
      magFilter: minFilter,
    };

    const hashInputs = [
      format,
      viewDimension,
      samplePoints,
      addressModeU,
      addressModeV,
      addressModeW,
      minFilter,
      offset,
    ];
    const calls: TextureCall<vec3>[] = (
      viewDimension === '3d'
        ? generateTextureBuiltinInputs3D(50, {
            method: samplePoints as SamplePointMethods,
            sampler,
            descriptor,
            bias: true,
            offset,
            hashInputs,
          })
        : generateSamplePointsCube(50, {
            method: samplePoints,
            sampler,
            descriptor,
            bias: true,
            hashInputs,
          })
    ).map(({ coords, derivativeMult, offset, bias }) => {
      return {
        builtin: 'textureSampleBias',
        coordType: 'f',
        coords,
        derivativeMult,
        bias,
        offset,
      };
    });
    const viewDescriptor = {
      dimension: viewDimension,
    };
    const textureType = getTextureTypeForTextureViewDimension(viewDimension)!;
    const results = await doTextureCalls(t, texture, viewDescriptor, textureType, sampler, calls);
    const res = await checkCallResults(
      t,
      { texels, descriptor, viewDescriptor },
      textureType,
      sampler,
      calls,
      results
    );
    t.expectOK(res);
  });

g.test('arrayed_2d_coords')
  .specURL('https://www.w3.org/TR/WGSL/#texturesamplebias')
  .desc(
    `
A: i32, u32

fn textureSampleBias(t: texture_2d_array<f32>, s: sampler, coords: vec2<f32>, array_index: A, bias: f32) -> vec4<f32>
fn textureSampleBias(t: texture_2d_array<f32>, s: sampler, coords: vec2<f32>, array_index: A, bias: f32, offset: vec2<i32>) -> vec4<f32>

Parameters:
 * t: The sampled texture to read from
 * s: The sampler type
 * coords: The texture coordinates
 * array_index: The 0-based texture array index to sample.
 * bias: The bias to apply to the mip level before sampling. bias must be between -16.0 and 15.99.
 * offset:
    - The optional texel offset applied to the unnormalized texture coordinate before sampling the texture.
      This offset is applied before applying any texture wrapping modes.
    - The offset expression must be a creation-time expression (e.g. vec2<i32>(1, 2)).
    - Each offset component must be at least -8 and at most 7.
      Values outside of this range will result in a shader-creation error.
`
  )
  .params(u =>
    u
      .combine('format', kTestableColorFormats)
      .filter(t => isPotentiallyFilterableAndFillable(t.format))
      .beginSubcases()
      .combine('samplePoints', kSamplePointMethods)
      .combine('A', ['i32', 'u32'] as const)
      .combine('addressModeU', ['clamp-to-edge', 'repeat', 'mirror-repeat'] as const)
      .combine('addressModeV', ['clamp-to-edge', 'repeat', 'mirror-repeat'] as const)
      .combine('minFilter', ['nearest', 'linear'] as const)
      .combine('offset', [false, true] as const)
  )
  .beforeAllSubcases(t =>
    skipIfTextureFormatNotSupportedNotAvailableOrNotFilterable(t, t.params.format)
  )
  .fn(async t => {
    const { format, samplePoints, A, addressModeU, addressModeV, minFilter, offset } = t.params;

    // We want at least 4 blocks or something wide enough for 3 mip levels.
    const [width, height] = chooseTextureSize({ minSize: 8, minBlocks: 4, format });
    const depthOrArrayLayers = 4;

    const descriptor: GPUTextureDescriptor = {
      format,
      size: { width, height, depthOrArrayLayers },
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
      mipLevelCount: 3,
    };
    const { texels, texture } = await createTextureWithRandomDataAndGetTexels(t, descriptor);
    const sampler: GPUSamplerDescriptor = {
      addressModeU,
      addressModeV,
      minFilter,
      magFilter: minFilter,
      mipmapFilter: minFilter,
    };

    const calls: TextureCall<vec2>[] = generateTextureBuiltinInputs2D(50, {
      method: samplePoints,
      sampler,
      descriptor,
      arrayIndex: { num: texture.depthOrArrayLayers, type: A },
      bias: true,
      offset,
      hashInputs: [format, samplePoints, A, addressModeU, addressModeV, minFilter, offset],
    }).map(({ coords, derivativeMult, arrayIndex, bias, offset }) => {
      return {
        builtin: 'textureSampleBias',
        coordType: 'f',
        coords,
        derivativeMult,
        arrayIndex,
        arrayIndexType: A === 'i32' ? 'i' : 'u',
        bias,
        offset,
      };
    });
    const textureType = 'texture_2d_array<f32>';
    const viewDescriptor = {};
    const results = await doTextureCalls(t, texture, viewDescriptor, textureType, sampler, calls);
    const res = await checkCallResults(
      t,
      { texels, descriptor, viewDescriptor },
      textureType,
      sampler,
      calls,
      results
    );
    t.expectOK(res);
  });

g.test('arrayed_3d_coords')
  .specURL('https://www.w3.org/TR/WGSL/#texturesamplebias')
  .desc(
    `
A: i32, u32

fn textureSampleBias(t: texture_cube_array<f32>, s: sampler, coords: vec3<f32>, array_index: A, bias: f32) -> vec4<f32>

Parameters:
 * t: The sampled texture to read from
 * s: The sampler type
 * coords: The texture coordinates
 * array_index: The 0-based texture array index to sample.
 * bias: The bias to apply to the mip level before sampling. bias must be between -16.0 and 15.99.
 * offset:
    - The optional texel offset applied to the unnormalized texture coordinate before sampling the texture.
      This offset is applied before applying any texture wrapping modes.
    - The offset expression must be a creation-time expression (e.g. vec2<i32>(1, 2)).
    - Each offset component must be at least -8 and at most 7.
      Values outside of this range will result in a shader-creation error.
`
  )
  .params(u =>
    u
      .combine('format', kTestableColorFormats)
      .filter(t => isPotentiallyFilterableAndFillable(t.format))
      .beginSubcases()
      .combine('samplePoints', kCubeSamplePointMethods)
      .combine('A', ['i32', 'u32'] as const)
      .combine('addressMode', ['clamp-to-edge', 'repeat', 'mirror-repeat'] as const)
      .combine('minFilter', ['nearest', 'linear'] as const)
  )
  .beforeAllSubcases(t => {
    skipIfTextureFormatNotSupportedNotAvailableOrNotFilterable(t, t.params.format);
    t.skipIfTextureViewDimensionNotSupported('cube-array');
  })
  .fn(async t => {
    const { format, samplePoints, A, addressMode, minFilter } = t.params;

    const viewDimension: GPUTextureViewDimension = 'cube-array';
    const size = chooseTextureSize({
      minSize: 32,
      minBlocks: 4,
      format,
      viewDimension,
    });
    const descriptor: GPUTextureDescriptor = {
      format,
      size,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
      // MAINTENANCE_TODO: use 3 for cube maps when derivatives are supported for cube maps.
      mipLevelCount: 1,
    };
    const { texels, texture } = await createTextureWithRandomDataAndGetTexels(t, descriptor);
    const sampler: GPUSamplerDescriptor = {
      addressModeU: addressMode,
      addressModeV: addressMode,
      addressModeW: addressMode,
      minFilter,
      magFilter: minFilter,
      mipmapFilter: minFilter,
    };

    const calls: TextureCall<vec3>[] = generateSamplePointsCube(50, {
      method: samplePoints,
      sampler,
      descriptor,
      bias: true,
      arrayIndex: { num: texture.depthOrArrayLayers / 6, type: A },
      hashInputs: [format, viewDimension, A, samplePoints, addressMode, minFilter],
    }).map(({ coords, derivativeMult, arrayIndex, bias }) => {
      return {
        builtin: 'textureSampleBias',
        coordType: 'f',
        coords,
        derivativeMult,
        arrayIndex,
        arrayIndexType: A === 'i32' ? 'i' : 'u',
        bias,
      };
    });
    const viewDescriptor = {
      dimension: viewDimension,
    };
    const textureType = getTextureTypeForTextureViewDimension(viewDimension);
    const results = await doTextureCalls(t, texture, viewDescriptor, textureType, sampler, calls);
    const res = await checkCallResults(
      t,
      { texels, descriptor, viewDescriptor },
      textureType,
      sampler,
      calls,
      results
    );
    t.expectOK(res);
  });
