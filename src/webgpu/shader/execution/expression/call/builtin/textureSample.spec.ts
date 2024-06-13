export const description = `
Samples a texture.

- TODO: test cube maps with derivatives. These are currently filtered out via kCoord3DViewsForDerivativeTests
        or by t.skip below.

note: uniformity validation is covered in src/webgpu/shader/validation/uniformity/uniformity.spec.ts
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import {
  isCompressedTextureFormat,
  isDepthTextureFormat,
  isEncodableTextureFormat,
  kCompressedTextureFormats,
  kDepthStencilFormats,
  kEncodableTextureFormats,
  kTextureFormatInfo,
  textureDimensionAndFormatCompatible,
} from '../../../../../format_info.js';
import { TextureTestMixin } from '../../../../../gpu_test.js';

import {
  vec2,
  vec3,
  TextureCall,
  putDataInTextureThenDrawAndCheckResultsComparedToSoftwareRasterizer,
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
  kCoord3DViewsForDerivativeTests,
  isSupportedViewFormatCombo,
  vec1,
  generateTextureBuiltinInputs1D,
} from './texture_utils.js';

const kTestableColorFormats = [...kEncodableTextureFormats, ...kCompressedTextureFormats] as const;

export const g = makeTestGroup(TextureTestMixin(WGSLTextureSampleTest));

g.test('sampled_1d_coords')
  .specURL('https://www.w3.org/TR/WGSL/#texturesample')
  .desc(
    `
fn textureSample(t: texture_1d<f32>, s: sampler, coords: f32) -> vec4<f32>

Parameters:
 * t  The sampled, depth, or external texture to sample.
 * s  The sampler type.
 * coords The texture coordinates used for sampling.
`
  )
  .params(u =>
    u
      .combine('format', kTestableColorFormats)
      .filter(t => textureDimensionAndFormatCompatible('1d', t.format))
      .filter(t => isPotentiallyFilterableAndFillable(t.format))
      .combine('samplePoints', kSamplePointMethods)
      .beginSubcases()
      .combine('addressModeU', ['clamp-to-edge', 'repeat', 'mirror-repeat'] as const)
      .combine('minFilter', ['nearest', 'linear'] as const)
  )
  .beforeAllSubcases(t =>
    skipIfTextureFormatNotSupportedNotAvailableOrNotFilterable(t, t.params.format)
  )
  .fn(async t => {
    const { format, samplePoints, addressModeU, minFilter } = t.params;

    // We want at least 4 blocks or something wide enough for 3 mip levels.
    const size = chooseTextureSize({ minSize: 8, minBlocks: 4, format, viewDimension: '1d' });

    const descriptor: GPUTextureDescriptor = {
      format,
      dimension: '1d',
      size,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    };
    const { texels, texture } = await createTextureWithRandomDataAndGetTexels(t, descriptor);
    const sampler: GPUSamplerDescriptor = {
      addressModeU,
      minFilter,
      magFilter: minFilter,
    };

    const calls: TextureCall<vec1>[] = generateTextureBuiltinInputs1D(50, {
      sampler,
      method: samplePoints,
      descriptor,
      hashInputs: [format, samplePoints, addressModeU, minFilter],
    }).map(({ coords, offset }) => {
      return {
        builtin: 'textureSample',
        coordType: 'f',
        coords,
      };
    });
    const viewDescriptor = {};
    const textureType = 'texture_1d<f32>';
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

g.test('sampled_2d_coords')
  .specURL('https://www.w3.org/TR/WGSL/#texturesample')
  .desc(
    `
fn textureSample(t: texture_2d<f32>, s: sampler, coords: vec2<f32>) -> vec4<f32>
fn textureSample(t: texture_2d<f32>, s: sampler, coords: vec2<f32>, offset: vec2<i32>) -> vec4<f32>

Parameters:
 * t  The sampled, depth, or external texture to sample.
 * s  The sampler type.
 * coords The texture coordinates used for sampling.
 * offset
    * The optional texel offset applied to the unnormalized texture coordinate before sampling the texture.
    * This offset is applied before applying any texture wrapping modes.
    * The offset expression must be a creation-time expression (e.g. vec2<i32>(1, 2)).
    * Each offset component must be at least -8 and at most 7.
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
    };
    const { texels, texture } = await createTextureWithRandomDataAndGetTexels(t, descriptor);
    const sampler: GPUSamplerDescriptor = {
      addressModeU,
      addressModeV,
      minFilter,
      magFilter: minFilter,
    };

    const calls: TextureCall<vec2>[] = generateTextureBuiltinInputs2D(50, {
      sampler,
      method: samplePoints,
      descriptor,
      offset: true,
      hashInputs: [format, samplePoints, addressModeU, addressModeV, minFilter, offset],
    }).map(({ coords, offset }) => {
      return {
        builtin: 'textureSample',
        coordType: 'f',
        coords,
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

g.test('sampled_2d_coords,derivatives')
  .specURL('https://www.w3.org/TR/WGSL/#texturesample')
  .desc(
    `
fn textureSample(t: texture_2d<f32>, s: sampler, coords: vec2<f32>) -> vec4<f32>
fn textureSample(t: texture_2d<f32>, s: sampler, coords: vec2<f32>, offset: vec2<i32>) -> vec4<f32>

test mip level selection based on derivatives
    `
  )
  .params(u =>
    u
      .combine('format', kTestableColorFormats)
      .filter(t => isPotentiallyFilterableAndFillable(t.format))
      .combine('mipmapFilter', ['nearest', 'linear'] as const)
      .beginSubcases()
      // note: this is the derivative we want at sample time. It is not the value
      // passed directly to the shader. This way if we change the texture size
      // or render target size we can compute the correct values to achieve the
      // same results.
      .combineWithParams([
        { ddx: 0.5, ddy: 0.5 }, // test mag filter
        { ddx: 1, ddy: 1 }, // test level 0
        { ddx: 2, ddy: 1 }, // test level 1 via ddx
        { ddx: 1, ddy: 4 }, // test level 2 via ddy
        { ddx: 1.5, ddy: 1.5 }, // test mix between 1 and 2
        { ddx: 6, ddy: 6 }, // test mix between 2 and 3 (there is no 3 so we should get just 2)
        { ddx: 1.5, ddy: 1.5, offset: [7, -8] as const }, // test mix between 1 and 2 with offset
        { ddx: 1.5, ddy: 1.5, offset: [3, -3] as const }, // test mix between 1 and 2 with offset
        { ddx: 1.5, ddy: 1.5, uvwStart: [-3.5, -4] as const }, // test mix between 1 and 2 with negative coords
      ])
  )
  .beforeAllSubcases(t =>
    skipIfTextureFormatNotSupportedNotAvailableOrNotFilterable(t, t.params.format)
  )
  .fn(async t => {
    const { format, mipmapFilter, ddx, ddy, uvwStart, offset } = t.params;

    // We want at least 4 blocks or something wide enough for 3 mip levels.
    const [width, height] = chooseTextureSize({ minSize: 8, minBlocks: 4, format });

    const descriptor: GPUTextureDescriptor = {
      format,
      mipLevelCount: 3,
      size: { width, height },
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    };

    const sampler: GPUSamplerDescriptor = {
      addressModeU: 'repeat',
      addressModeV: 'repeat',
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter,
    };
    const viewDescriptor = {};
    await putDataInTextureThenDrawAndCheckResultsComparedToSoftwareRasterizer(
      t,
      descriptor,
      viewDescriptor,
      sampler,
      { ddx, ddy, uvwStart, offset }
    );
  });

g.test('sampled_3d_coords')
  .specURL('https://www.w3.org/TR/WGSL/#texturesample')
  .desc(
    `
fn textureSample(t: texture_3d<f32>, s: sampler, coords: vec3<f32>) -> vec4<f32>
fn textureSample(t: texture_3d<f32>, s: sampler, coords: vec3<f32>, offset: vec3<i32>) -> vec4<f32>
fn textureSample(t: texture_cube<f32>, s: sampler, coords: vec3<f32>) -> vec4<f32>

Parameters:
 * t  The sampled, depth, or external texture to sample.
 * s  The sampler type.
 * coords The texture coordinates used for sampling.
 * offset
    * The optional texel offset applied to the unnormalized texture coordinate before sampling the texture.
    * This offset is applied before applying any texture wrapping modes.
    * The offset expression must be a creation-time expression (e.g. vec2<i32>(1, 2)).
    * Each offset component must be at least -8 and at most 7.
      Values outside of this range will result in a shader-creation error.

* TODO: test 3d compressed textures formats. Just remove the filter below 'viewDimension'
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

    const calls: TextureCall<vec3>[] = (
      viewDimension === '3d'
        ? generateTextureBuiltinInputs3D(50, {
            method: samplePoints as SamplePointMethods,
            sampler,
            descriptor,
            hashInputs: [
              format,
              viewDimension,
              samplePoints,
              addressModeU,
              addressModeV,
              addressModeW,
              minFilter,
              offset,
            ],
          })
        : generateSamplePointsCube(50, {
            method: samplePoints,
            sampler,
            descriptor,
            hashInputs: [
              format,
              viewDimension,
              samplePoints,
              addressModeU,
              addressModeV,
              addressModeW,
              minFilter,
            ],
          })
    ).map(({ coords, offset }) => {
      return {
        builtin: 'textureSample',
        coordType: 'f',
        coords,
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

g.test('sampled_3d_coords,derivatives')
  .specURL('https://www.w3.org/TR/WGSL/#texturesample')
  .desc(
    `
fn textureSample(t: texture_3d<f32>, s: sampler, coords: vec3<f32>) -> vec4<f32>
fn textureSample(t: texture_3d<f32>, s: sampler, coords: vec3<f32>, offset: vec3<i32>) -> vec4<f32>
fn textureSample(t: texture_cube<f32>, s: sampler, coords: vec3<f32>) -> vec4<f32>

test mip level selection based on derivatives

* TODO: test 3d compressed textures formats. Just remove the filter below 'viewDimension'
`
  )
  .params(u =>
    u
      .combine('format', kTestableColorFormats)
      .filter(t => {
        const type = kTextureFormatInfo[t.format].color?.type;
        const canPotentialFilter = type === 'float' || type === 'unfilterable-float';
        // We can't easily put random bytes into compressed textures if they are float formats
        // since we want the range to be +/- 1000 and not +/- infinity or NaN.
        const isFillable = !isCompressedTextureFormat(t.format) || !t.format.endsWith('float');
        return canPotentialFilter && isFillable;
      })
      .combine('viewDimension', kCoord3DViewsForDerivativeTests)
      .filter(t => isSupportedViewFormatCombo(t.format, t.viewDimension))
      .combine('mipmapFilter', ['nearest', 'linear'] as const)
      .beginSubcases()
      // note: this is the derivative we want at sample time. It is not the value
      // passed directly to the shader. This way if we change the texture size
      // or render target size we can compute the correct values to achieve the
      // same results.
      .combineWithParams([
        { ddx: 0.5, ddy: 0.5 }, // test mag filter
        { ddx: 1, ddy: 1 }, // test level 0
        { ddx: 2, ddy: 1 }, // test level 1 via ddx
        { ddx: 1, ddy: 4 }, // test level 2 via ddy
        { ddx: 1.5, ddy: 1.5 }, // test mix between 1 and 2
        { ddx: 6, ddy: 6 }, // test mix between 2 and 3 (there is no 3 so we should get just 2)
        { ddx: 1.5, ddy: 1.5, offset: [4, 7, -8] as const }, // test mix between 1 and 2 with offset
        { ddx: 1.5, ddy: 1.5, offset: [3, -3, 2] as const }, // test mix between 1 and 2 with offset
        { ddx: 1.5, ddy: 1.5, uvwStart: [-3.5, -4, -5] as const }, // test mix between 1 and 2 with negative coords
      ])
      .filter(t => !(t.viewDimension === 'cube' && t.offset !== undefined))
  )
  .beforeAllSubcases(t => {
    const { format } = t.params;
    t.skipIfTextureFormatNotSupported(format);
    const info = kTextureFormatInfo[format];
    if (info.color?.type === 'unfilterable-float') {
      t.selectDeviceOrSkipTestCase('float32-filterable');
    } else {
      t.selectDeviceForTextureFormatOrSkipTestCase(t.params.format);
    }
  })
  .fn(async t => {
    const { format, mipmapFilter, ddx, ddy, uvwStart, offset, viewDimension } = t.params;

    // We want at least 4 blocks or something wide enough for 3 mip levels.
    const size = chooseTextureSize({
      minSize: 8,
      minBlocks: 4,
      format,
      viewDimension,
    });

    const descriptor: GPUTextureDescriptor = {
      format,
      dimension: viewDimension === '3d' ? '3d' : '2d',
      ...(t.isCompatibility && { textureBindingViewDimension: viewDimension }),
      mipLevelCount: 3,
      size,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    };

    const sampler: GPUSamplerDescriptor = {
      addressModeU: 'repeat',
      addressModeV: 'repeat',
      addressModeW: 'repeat',
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter,
    };
    const viewDescriptor = {
      dimension: viewDimension,
    };
    await putDataInTextureThenDrawAndCheckResultsComparedToSoftwareRasterizer(
      t,
      descriptor,
      viewDescriptor,
      sampler,
      { ddx, ddy, uvwStart, offset }
    );
  });

g.test('depth_2d_coords')
  .specURL('https://www.w3.org/TR/WGSL/#texturesample')
  .desc(
    `
fn textureSample(t: texture_depth_2d, s: sampler, coords: vec2<f32>) -> f32
fn textureSample(t: texture_depth_2d, s: sampler, coords: vec2<f32>, offset: vec2<i32>) -> f32

Parameters:
 * t  The sampled, depth, or external texture to sample.
 * s  The sampler type.
 * coords The texture coordinates used for sampling.
 * offset
    * The optional texel offset applied to the unnormalized texture coordinate before sampling the texture.
    * This offset is applied before applying any texture wrapping modes.
    * The offset expression must be a creation-time expression (e.g. vec2<i32>(1, 2)).
    * Each offset component must be at least -8 and at most 7.
      Values outside of this range will result in a shader-creation error.
`
  )
  .params(u =>
    u
      .combine('format', kDepthStencilFormats)
      // filter out stencil only formats
      .filter(t => isDepthTextureFormat(t.format))
      // MAINTENANCE_TODO: Remove when support for depth24plus, depth24plus-stencil8, and depth32float-stencil8 is added.
      .filter(t => isEncodableTextureFormat(t.format))
      .beginSubcases()
      .combine('samplePoints', kSamplePointMethods)
      .combine('addressModeU', ['clamp-to-edge', 'repeat', 'mirror-repeat'] as const)
      .combine('addressModeV', ['clamp-to-edge', 'repeat', 'mirror-repeat'] as const)
      .combine('minFilter', ['nearest', 'linear'] as const)
      .combine('offset', [false, true] as const)
  )
  .fn(async t => {
    const { format, samplePoints, addressModeU, addressModeV, minFilter, offset } = t.params;

    // We want at least 4 blocks or something wide enough for 3 mip levels.
    const [width, height] = chooseTextureSize({ minSize: 8, minBlocks: 4, format });
    const descriptor: GPUTextureDescriptor = {
      format,
      size: { width, height },
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
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
      offset,
      hashInputs: [format, samplePoints, addressModeU, addressModeV, minFilter, offset],
    }).map(({ coords, offset }) => {
      return {
        builtin: 'textureSample',
        coordType: 'f',
        coords,
        offset,
      };
    });

    const viewDescriptor = {};
    const textureType = 'texture_depth_2d';
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

g.test('depth_2d_coords,derivatives')
  .specURL('https://www.w3.org/TR/WGSL/#texturesample')
  .desc(
    `
fn textureSample(t: texture_depth_2d, s: sampler, coords: vec2<f32>) -> f32
fn textureSample(t: texture_depth_2d, s: sampler, coords: vec2<f32>, offset: vec2<i32>) -> f32

test mip level selection based on derivatives
`
  )
  .params(u =>
    u
      .combine('format', kDepthStencilFormats)
      // filter out stencil only formats
      .filter(t => isDepthTextureFormat(t.format))
      // MAINTENANCE_TODO: Remove when support for depth24plus, depth24plus-stencil8, and depth32float-stencil8 is added.
      .filter(t => isEncodableTextureFormat(t.format))
      .beginSubcases()
      .combine('mipmapFilter', ['nearest', 'linear'] as const)
      // note: this is the derivative we want at sample time. It is not the value
      // passed directly to the shader. This way if we change the texture size
      // or render target size we can compute the correct values to achieve the
      // same results.
      .combineWithParams([
        { ddx: 0.5, ddy: 0.5 }, // test mag filter
        { ddx: 1, ddy: 1 }, // test level 0
        { ddx: 2, ddy: 1 }, // test level 1 via ddx
        { ddx: 1, ddy: 4 }, // test level 2 via ddy
        { ddx: 1.5, ddy: 1.5 }, // test mix between 1 and 2
        { ddx: 6, ddy: 6 }, // test mix between 2 and 3 (there is no 3 so we should get just 2)
        { ddx: 1.5, ddy: 1.5, offset: [7, -8] as const }, // test mix between 1 and 2 with offset
        { ddx: 1.5, ddy: 1.5, offset: [3, -3] as const }, // test mix between 1 and 2 with offset
        { ddx: 1.5, ddy: 1.5, uvwStart: [-3.5, -4] as const }, // test mix between 1 and 2 with negative coords
      ])
  )
  .fn(async t => {
    const { format, mipmapFilter, ddx, ddy, uvwStart, offset } = t.params;

    // We want at least 4 blocks or something wide enough for 3 mip levels.
    const [width, height] = chooseTextureSize({ minSize: 8, minBlocks: 4, format });
    const descriptor: GPUTextureDescriptor = {
      format,
      size: { width, height },
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
      mipLevelCount: 3,
    };
    const sampler: GPUSamplerDescriptor = {
      addressModeU: 'repeat',
      addressModeV: 'repeat',
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter,
    };
    const viewDescriptor = {};
    await putDataInTextureThenDrawAndCheckResultsComparedToSoftwareRasterizer(
      t,
      descriptor,
      viewDescriptor,
      sampler,
      { ddx, ddy, uvwStart, offset, depthTexture: true }
    );
  });

g.test('sampled_array_2d_coords')
  .specURL('https://www.w3.org/TR/WGSL/#texturesample')
  .desc(
    `
A is i32 or u32

fn textureSample(t: texture_2d_array<f32>, s: sampler, coords: vec2<f32>, array_index: A) -> vec4<f32>
fn textureSample(t: texture_2d_array<f32>, s: sampler, coords: vec2<f32>, array_index: A, offset: vec2<i32>) -> vec4<f32>

Parameters:
 * t  The sampled, depth, or external texture to sample.
 * s  The sampler type.
 * coords The texture coordinates used for sampling.
 * array_index The 0-based texture array index to sample.
 * offset
    * The optional texel offset applied to the unnormalized texture coordinate before sampling the texture.
    * This offset is applied before applying any texture wrapping modes.
    * The offset expression must be a creation-time expression (e.g. vec2<i32>(1, 2)).
    * Each offset component must be at least -8 and at most 7.
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
      offset,
      hashInputs: [format, samplePoints, A, addressModeU, addressModeV, minFilter, offset],
    }).map(({ coords, arrayIndex, offset }) => {
      return {
        builtin: 'textureSample',
        coordType: 'f',
        coords,
        arrayIndex,
        arrayIndexType: A === 'i32' ? 'i' : 'u',
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

g.test('sampled_array_2d_coords,derivatives')
  .specURL('https://www.w3.org/TR/WGSL/#texturesample')
  .desc(
    `
A is i32 or u32

fn textureSample(t: texture_2d_array<f32>, s: sampler, coords: vec2<f32>, array_index: A) -> vec4<f32>
fn textureSample(t: texture_2d_array<f32>, s: sampler, coords: vec2<f32>, array_index: A, offset: vec2<i32>) -> vec4<f32>

test mip level selection based on derivatives
`
  )
  .params(u =>
    u
      .combine('format', kTestableColorFormats)
      .filter(t => isPotentiallyFilterableAndFillable(t.format))
      .combine('mipmapFilter', ['nearest', 'linear'] as const)
      .beginSubcases()
      .combine('A', ['i32', 'u32'] as const)
      // note: this is the derivative we want at sample time. It is not the value
      // passed directly to the shader. This way if we change the texture size
      // or render target size we can compute the correct values to achieve the
      // same results.
      .combineWithParams([
        { ddx: 0.5, ddy: 0.5 }, // test mag filter
        { ddx: 1, ddy: 1 }, // test level 0
        { ddx: 2, ddy: 1 }, // test level 1 via ddx
        { ddx: 1, ddy: 4 }, // test level 2 via ddy
        { ddx: 1.5, ddy: 1.5 }, // test mix between 1 and 2
        { ddx: 6, ddy: 6 }, // test mix between 2 and 3 (there is no 3 so we should get just 2)
        { ddx: 1.5, ddy: 1.5, offset: [7, -8] as const }, // test mix between 1 and 2 with offset
        { ddx: 1.5, ddy: 1.5, offset: [3, -3] as const }, // test mix between 1 and 2 with offset
        { ddx: 1.5, ddy: 1.5, uvwStart: [-3.5, -4] as const }, // test mix between 1 and 2 with negative coords
      ])
  )
  .beforeAllSubcases(t =>
    skipIfTextureFormatNotSupportedNotAvailableOrNotFilterable(t, t.params.format)
  )
  .fn(async t => {
    const { format, A, mipmapFilter, ddx, ddy, uvwStart, offset } = t.params;

    // We want at least 4 blocks or something wide enough for 3 mip levels.
    const viewDimension: GPUTextureViewDimension = '2d-array';
    const size = chooseTextureSize({ minSize: 8, minBlocks: 4, format, viewDimension });

    const descriptor: GPUTextureDescriptor = {
      format,
      mipLevelCount: 3,
      size,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    };

    const sampler: GPUSamplerDescriptor = {
      addressModeU: 'repeat',
      addressModeV: 'repeat',
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter,
    };
    const viewDescriptor = {
      dimension: viewDimension,
    };
    await putDataInTextureThenDrawAndCheckResultsComparedToSoftwareRasterizer(
      t,
      descriptor,
      viewDescriptor,
      sampler,
      {
        ddx,
        ddy,
        uvwStart,
        offset,
        arrayIndexType: A === 'i32' ? 'i' : 'u',
      }
    );
  });

g.test('sampled_array_3d_coords')
  .specURL('https://www.w3.org/TR/WGSL/#texturesample')
  .desc(
    `
A is i32 or u32

fn textureSample(t: texture_cube_array<f32>, s: sampler, coords: vec3<f32>, array_index: A) -> vec4<f32>

Parameters:
 * t  The sampled, depth, or external texture to sample.
 * s  The sampler type.
 * coords The texture coordinates used for sampling.
 * array_index The 0-based texture array index to sample.
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
      arrayIndex: { num: texture.depthOrArrayLayers / 6, type: A },
      hashInputs: [format, viewDimension, A, samplePoints, addressMode, minFilter],
    }).map(({ coords, arrayIndex }) => {
      return {
        builtin: 'textureSample',
        coordType: 'f',
        coords,
        arrayIndex,
        arrayIndexType: A === 'i32' ? 'i' : 'u',
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

g.test('sampled_array_3d_coords,derivatives')
  .specURL('https://www.w3.org/TR/WGSL/#texturesample')
  .desc(
    `
A is i32 or u32

fn textureSample(t: texture_cube_array<f32>, s: sampler, coords: vec3<f32>, array_index: A) -> vec4<f32>

test mip level selection based on derivatives

Parameters:
 * t  The sampled, depth, or external texture to sample.
 * s  The sampler type.
 * coords The texture coordinates used for sampling.
 * array_index The 0-based texture array index to sample.
`
  )
  .params(u =>
    u
      .combine('format', kTestableColorFormats)
      .filter(t => {
        const type = kTextureFormatInfo[t.format].color?.type;
        const canPotentialFilter = type === 'float' || type === 'unfilterable-float';
        // We can't easily put random bytes into compressed textures if they are float formats
        // since we want the range to be +/- 1000 and not +/- infinity or NaN.
        const isFillable = !isCompressedTextureFormat(t.format) || !t.format.endsWith('float');
        return canPotentialFilter && isFillable;
      })
      .combine('mipmapFilter', ['nearest', 'linear'] as const)
      .beginSubcases()
      .combine('A', ['i32', 'u32'] as const)
      // note: this is the derivative we want at sample time. It is not the value
      // passed directly to the shader. This way if we change the texture size
      // or render target size we can compute the correct values to achieve the
      // same results.
      .combineWithParams([
        { ddx: 0.5, ddy: 0.5 }, // test mag filter
        { ddx: 1, ddy: 1 }, // test level 0
        { ddx: 2, ddy: 1 }, // test level 1 via ddx
        { ddx: 1, ddy: 4 }, // test level 2 via ddy
        { ddx: 1.5, ddy: 1.5 }, // test mix between 1 and 2
        { ddx: 6, ddy: 6 }, // test mix between 2 and 3 (there is no 3 so we should get just 2)
        { ddx: 1.5, ddy: 1.5, uvwStart: [-3.5, -4, -5] as const }, // test mix between 1 and 2 with negative coords
      ])
  )
  .beforeAllSubcases(t => {
    skipIfTextureFormatNotSupportedNotAvailableOrNotFilterable(t, t.params.format);
    t.skipIfTextureViewDimensionNotSupported('cube-array');
    t.skip('testing cube maps with derivatives is not yet supported');
  })
  .fn(async t => {
    const { format, mipmapFilter, ddx, ddy, uvwStart, A } = t.params;

    const viewDimension: GPUTextureViewDimension = 'cube-array';
    // We want at least 4 blocks or something wide enough for 3 mip levels.
    const size = chooseTextureSize({
      minSize: 32,
      minBlocks: 4,
      format,
      viewDimension,
    });

    const descriptor: GPUTextureDescriptor = {
      format,
      ...(t.isCompatibility && { textureBindingViewDimension: viewDimension }),
      mipLevelCount: 3,
      size,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    };

    const sampler: GPUSamplerDescriptor = {
      addressModeU: 'repeat',
      addressModeV: 'repeat',
      addressModeW: 'repeat',
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter,
    };
    const viewDescriptor = {
      dimension: viewDimension,
    };
    await putDataInTextureThenDrawAndCheckResultsComparedToSoftwareRasterizer(
      t,
      descriptor,
      viewDescriptor,
      sampler,
      { ddx, ddy, uvwStart, arrayIndexType: A === 'i32' ? 'i' : 'u' }
    );
  });

g.test('depth_3d_coords')
  .specURL('https://www.w3.org/TR/WGSL/#texturesample')
  .desc(
    `
fn textureSample(t: texture_depth_cube, s: sampler, coords: vec3<f32>) -> f32

Parameters:
 * t  The sampled, depth, or external texture to sample.
 * s  The sampler type.
 * coords The texture coordinates used for sampling.
`
  )
  .params(u =>
    u
      .combine('format', kDepthStencilFormats)
      // filter out stencil only formats
      .filter(t => isDepthTextureFormat(t.format))
      // MAINTENANCE_TODO: Remove when support for depth24plus, depth24plus-stencil8, and depth32float-stencil8 is added.
      .filter(t => isEncodableTextureFormat(t.format))
      .combineWithParams([
        { viewDimension: 'cube' },
        { viewDimension: 'cube-array', A: 'i32' },
        { viewDimension: 'cube-array', A: 'u32' },
      ] as const)
      .beginSubcases()
      .combine('samplePoints', kCubeSamplePointMethods)
      .combine('addressMode', ['clamp-to-edge', 'repeat', 'mirror-repeat'] as const)
      .combine('minFilter', ['nearest', 'linear'] as const)
  )
  .beforeAllSubcases(t => {
    t.skipIfTextureViewDimensionNotSupported(t.params.viewDimension);
  })
  .fn(async t => {
    const { format, viewDimension, samplePoints, A, addressMode, minFilter } = t.params;

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
      ...(t.isCompatibility && { textureBindingViewDimension: viewDimension }),
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
      arrayIndex: A ? { num: texture.depthOrArrayLayers / 6, type: A } : undefined,
      hashInputs: [format, viewDimension, samplePoints, addressMode, minFilter],
    }).map(({ coords, arrayIndex }) => {
      return {
        builtin: 'textureSample',
        coordType: 'f',
        coords,
        arrayIndex,
        arrayIndexType: A ? (A === 'i32' ? 'i' : 'u') : undefined,
      };
    });
    const viewDescriptor = {
      dimension: viewDimension,
    };
    const textureType =
      viewDimension === 'cube' ? 'texture_depth_cube' : 'texture_depth_cube_array';
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

g.test('depth_3d_coords,derivatives')
  .specURL('https://www.w3.org/TR/WGSL/#texturesample')
  .desc(
    `
fn textureSample(t: texture_depth_cube, s: sampler, coords: vec3<f32>) -> f32

test mip level selection based on derivatives

Parameters:
 * t  The sampled, depth, or external texture to sample.
 * s  The sampler type.
 * coords The texture coordinates used for sampling.
`
  )
  .params(u =>
    u
      .combine('format', kDepthStencilFormats)
      // filter out stencil only formats
      .filter(t => isDepthTextureFormat(t.format))
      // MAINTENANCE_TODO: Remove when support for depth24plus, depth24plus-stencil8, and depth32float-stencil8 is added.
      .filter(t => isEncodableTextureFormat(t.format))
      .combine('mipmapFilter', ['nearest', 'linear'] as const)
      .beginSubcases()
      // note: this is the derivative we want at sample time. It is not the value
      // passed directly to the shader. This way if we change the texture size
      // or render target size we can compute the correct values to achieve the
      // same results.
      .combineWithParams([
        { ddx: 0.5, ddy: 0.5 }, // test mag filter
        { ddx: 1, ddy: 1 }, // test level 0
        { ddx: 2, ddy: 1 }, // test level 1 via ddx
        { ddx: 1, ddy: 4 }, // test level 2 via ddy
        { ddx: 1.5, ddy: 1.5 }, // test mix between 1 and 2
        { ddx: 6, ddy: 6 }, // test mix between 2 and 3 (there is no 3 so we should get just 2)
      ])
  )
  .beforeAllSubcases(t => {
    t.skip('testing cube maps with derivatives is not yet supported');
  })
  .fn(async t => {
    const { format, mipmapFilter, ddx, ddy } = t.params;
    const viewDimension: GPUTextureViewDimension = 'cube';

    // We want at least 4 blocks or something wide enough for 3 mip levels.
    const size = chooseTextureSize({
      minSize: 32,
      minBlocks: 4,
      format,
      viewDimension,
    });

    const descriptor: GPUTextureDescriptor = {
      format,
      ...(t.isCompatibility && { textureBindingViewDimension: viewDimension }),
      mipLevelCount: 3,
      size,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    };

    const sampler: GPUSamplerDescriptor = {
      addressModeU: 'repeat',
      addressModeV: 'repeat',
      addressModeW: 'repeat',
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter,
    };
    const viewDescriptor = {
      dimension: viewDimension,
    };
    await putDataInTextureThenDrawAndCheckResultsComparedToSoftwareRasterizer(
      t,
      descriptor,
      viewDescriptor,
      sampler,
      { ddx, ddy, depthTexture: true }
    );
  });

g.test('depth_array_2d_coords')
  .specURL('https://www.w3.org/TR/WGSL/#texturesample')
  .desc(
    `
A is i32 or u32

fn textureSample(t: texture_depth_2d_array, s: sampler, coords: vec2<f32>, array_index: A) -> f32
fn textureSample(t: texture_depth_2d_array, s: sampler, coords: vec2<f32>, array_index: A, offset: vec2<i32>) -> f32

Parameters:
 * t  The sampled, depth, or external texture to sample.
 * s  The sampler type.
 * coords The texture coordinates used for sampling.
 * array_index The 0-based texture array index to sample.
 * offset
    * The optional texel offset applied to the unnormalized texture coordinate before sampling the texture.
    * This offset is applied before applying any texture wrapping modes.
    * The offset expression must be a creation-time expression (e.g. vec2<i32>(1, 2)).
    * Each offset component must be at least -8 and at most 7.
      Values outside of this range will result in a shader-creation error.
`
  )
  .params(u =>
    u
      .combine('format', kDepthStencilFormats)
      // filter out stencil only formats
      .filter(t => isDepthTextureFormat(t.format))
      // MAINTENANCE_TODO: Remove when support for depth24plus, depth24plus-stencil8, and depth32float-stencil8 is added.
      .filter(t => isEncodableTextureFormat(t.format))
      .beginSubcases()
      .combine('samplePoints', kSamplePointMethods)
      .combine('addressMode', ['clamp-to-edge', 'repeat', 'mirror-repeat'] as const)
      .combine('minFilter', ['nearest', 'linear'] as const)
      .combine('A', ['i32', 'u32'] as const)
      .combine('L', ['i32', 'u32'] as const)
      .combine('offset', [false, true] as const)
  )
  .fn(async t => {
    const { format, samplePoints, addressMode, minFilter, A, L, offset } = t.params;

    // We want at least 4 blocks or something wide enough for 3 mip levels.
    const [width, height] = chooseTextureSize({ minSize: 8, minBlocks: 4, format });
    const descriptor: GPUTextureDescriptor = {
      format,
      size: { width, height },
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
      ...(t.isCompatibility && { textureBindingViewDimension: '2d-array' }),
    };
    const { texels, texture } = await createTextureWithRandomDataAndGetTexels(t, descriptor);
    const sampler: GPUSamplerDescriptor = {
      addressModeU: addressMode,
      addressModeV: addressMode,
      minFilter,
      magFilter: minFilter,
      mipmapFilter: minFilter,
    };

    const calls: TextureCall<vec2>[] = generateTextureBuiltinInputs2D(50, {
      method: samplePoints,
      sampler,
      descriptor,
      arrayIndex: { num: texture.depthOrArrayLayers, type: A },
      offset,
      hashInputs: [format, samplePoints, addressMode, minFilter, L, A, offset],
    }).map(({ coords, arrayIndex, offset }) => {
      return {
        builtin: 'textureSample',
        coordType: 'f',
        coords,
        arrayIndex,
        arrayIndexType: A === 'i32' ? 'i' : 'u',
        offset,
      };
    });
    const textureType = 'texture_depth_2d_array';
    const viewDescriptor: GPUTextureViewDescriptor = { dimension: '2d-array' };
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

g.test('depth_array_2d_coords,derivatives')
  .specURL('https://www.w3.org/TR/WGSL/#texturesample')
  .desc(
    `
A is i32 or u32

fn textureSample(t: texture_depth_2d_array, s: sampler, coords: vec2<f32>, array_index: A) -> f32
fn textureSample(t: texture_depth_2d_array, s: sampler, coords: vec2<f32>, array_index: A, offset: vec2<i32>) -> f32

test mip level selection based on derivatives
`
  )
  .params(u =>
    u
      .combine('format', kDepthStencilFormats)
      // filter out stencil only formats
      .filter(t => isDepthTextureFormat(t.format))
      // MAINTENANCE_TODO: Remove when support for depth24plus, depth24plus-stencil8, and depth32float-stencil8 is added.
      .filter(t => isEncodableTextureFormat(t.format))
      .combine('mipmapFilter', ['nearest', 'linear'] as const)
      .beginSubcases()
      .combine('A', ['i32', 'u32'] as const)
      // note: this is the derivative we want at sample time. It is not the value
      // passed directly to the shader. This way if we change the texture size
      // or render target size we can compute the correct values to achieve the
      // same results.
      .combineWithParams([
        { ddx: 0.5, ddy: 0.5 }, // test mag filter
        { ddx: 1, ddy: 1 }, // test level 0
        { ddx: 2, ddy: 1 }, // test level 1 via ddx
        { ddx: 1, ddy: 4 }, // test level 2 via ddy
        { ddx: 1.5, ddy: 1.5 }, // test mix between 1 and 2
        { ddx: 6, ddy: 6 }, // test mix between 2 and 3 (there is no 3 so we should get just 2)
        { ddx: 1.5, ddy: 1.5, offset: [7, -8] as const }, // test mix between 1 and 2 with offset
        { ddx: 1.5, ddy: 1.5, offset: [3, -3] as const }, // test mix between 1 and 2 with offset
        { ddx: 1.5, ddy: 1.5, uvwStart: [-3.5, -4] as const }, // test mix between 1 and 2 with negative coords
      ])
  )
  .fn(async t => {
    const { format, A, mipmapFilter, ddx, ddy, uvwStart, offset } = t.params;

    // We want at least 4 blocks or something wide enough for 3 mip levels.
    const viewDimension: GPUTextureViewDimension = '2d-array';
    const size = chooseTextureSize({ minSize: 8, minBlocks: 4, format, viewDimension });

    const descriptor: GPUTextureDescriptor = {
      format,
      mipLevelCount: 3,
      size,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    };

    const sampler: GPUSamplerDescriptor = {
      addressModeU: 'repeat',
      addressModeV: 'repeat',
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter,
    };
    const viewDescriptor = {
      dimension: viewDimension,
    };
    await putDataInTextureThenDrawAndCheckResultsComparedToSoftwareRasterizer(
      t,
      descriptor,
      viewDescriptor,
      sampler,
      {
        ddx,
        ddy,
        uvwStart,
        offset,
        arrayIndexType: A === 'i32' ? 'i' : 'u',
        depthTexture: true,
      }
    );
  });

g.test('depth_array_3d_coords')
  .specURL('https://www.w3.org/TR/WGSL/#texturesample')
  .desc(
    `
A is i32 or u32

fn textureSample(t: texture_depth_cube_array, s: sampler, coords: vec3<f32>, array_index: A) -> f32

Parameters:
 * t  The sampled, depth, or external texture to sample.
 * s  The sampler type.
 * coords The texture coordinates used for sampling.
 * array_index The 0-based texture array index to sample.
`
  )
  .params(u =>
    u
      .combine('format', kDepthStencilFormats)
      // filter out stencil only formats
      .filter(t => isDepthTextureFormat(t.format))
      // MAINTENANCE_TODO: Remove when support for depth24plus, depth24plus-stencil8, and depth32float-stencil8 is added.
      .filter(t => isEncodableTextureFormat(t.format))
      .beginSubcases()
      .combine('samplePoints', kCubeSamplePointMethods)
      .combine('addressMode', ['clamp-to-edge', 'repeat', 'mirror-repeat'] as const)
      .combine('minFilter', ['nearest', 'linear'] as const)
      .combine('A', ['i32', 'u32'] as const)
  )
  .beforeAllSubcases(t => {
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
      ...(t.isCompatibility && { textureBindingViewDimension: viewDimension }),
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
      arrayIndex: A ? { num: texture.depthOrArrayLayers / 6, type: A } : undefined,
      hashInputs: [format, viewDimension, samplePoints, addressMode, minFilter],
    }).map(({ coords, arrayIndex }) => {
      return {
        builtin: 'textureSample',
        coordType: 'f',
        coords,
        arrayIndex,
        arrayIndexType: A ? (A === 'i32' ? 'i' : 'u') : undefined,
      };
    });
    const viewDescriptor = {
      dimension: viewDimension,
    };
    const textureType = 'texture_depth_cube_array';
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

g.test('depth_array_3d_coords,derivatives')
  .specURL('https://www.w3.org/TR/WGSL/#texturesample')
  .desc(
    `
A is i32 or u32

fn textureSample(t: texture_depth_cube_array, s: sampler, coords: vec3<f32>, array_index: A) -> f32

Parameters:
 * t  The sampled, depth, or external texture to sample.
 * s  The sampler type.
 * coords The texture coordinates used for sampling.
 * array_index The 0-based texture array index to sample.

test mip level selection based on derivatives
`
  )
  .params(u =>
    u
      .combine('format', kDepthStencilFormats)
      // filter out stencil only formats
      .filter(t => isDepthTextureFormat(t.format))
      // MAINTENANCE_TODO: Remove when support for depth24plus, depth24plus-stencil8, and depth32float-stencil8 is added.
      .filter(t => isEncodableTextureFormat(t.format))
      .combine('mipmapFilter', ['nearest', 'linear'] as const)
      .beginSubcases()
      .combine('A', ['i32', 'u32'] as const)
      // note: this is the derivative we want at sample time. It is not the value
      // passed directly to the shader. This way if we change the texture size
      // or render target size we can compute the correct values to achieve the
      // same results.
      .combineWithParams([
        { ddx: 0.5, ddy: 0.5 }, // test mag filter
        { ddx: 1, ddy: 1 }, // test level 0
        { ddx: 2, ddy: 1 }, // test level 1 via ddx
        { ddx: 1, ddy: 4 }, // test level 2 via ddy
        { ddx: 1.5, ddy: 1.5 }, // test mix between 1 and 2
        { ddx: 6, ddy: 6 }, // test mix between 2 and 3 (there is no 3 so we should get just 2)
        { ddx: 1.5, ddy: 1.5, uvwStart: [-3.5, -4, -5] as const }, // test mix between 1 and 2 with negative coords
      ])
  )
  .beforeAllSubcases(t => {
    t.skipIfTextureViewDimensionNotSupported('cube-array');
    t.skip('testing cube maps with derivatives is not yet supported');
  })
  .fn(async t => {
    const { format, mipmapFilter, ddx, ddy, uvwStart, A } = t.params;

    const viewDimension: GPUTextureViewDimension = 'cube-array';
    // We want at least 4 blocks or something wide enough for 3 mip levels.
    const size = chooseTextureSize({
      minSize: 32,
      minBlocks: 4,
      format,
      viewDimension,
    });

    const descriptor: GPUTextureDescriptor = {
      format,
      ...(t.isCompatibility && { textureBindingViewDimension: viewDimension }),
      mipLevelCount: 3,
      size,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    };

    const sampler: GPUSamplerDescriptor = {
      addressModeU: 'repeat',
      addressModeV: 'repeat',
      addressModeW: 'repeat',
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter,
    };
    const viewDescriptor = {
      dimension: viewDimension,
    };
    await putDataInTextureThenDrawAndCheckResultsComparedToSoftwareRasterizer(
      t,
      descriptor,
      viewDescriptor,
      sampler,
      { ddx, ddy, uvwStart, depthTexture: true, arrayIndexType: A === 'i32' ? 'i' : 'u' }
    );
  });
