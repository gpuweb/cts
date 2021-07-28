export const description = `createView validation tests.`;

import { makeTestGroup } from '../../../common/framework/test_group.js';
import {
  kTextureAspects,
  kTextureDimensions,
  kTextureFormatInfo,
  kTextureFormats,
  kTextureViewDimensions,
} from '../../capability_info.js';
import {
  getTextureDimensionFromView,
  reifyTextureViewDescriptor,
} from '../../util/texture/base.js';

import { kResourceStates, ValidationTest } from './validation_test.js';

export const g = makeTestGroup(ValidationTest);

const kLevels = 6;
const kLayers = 6;

g.test('format')
  .desc(
    `Views must have the same format as the base texture, for all {texture format}x{view format}.`
  )
  .params(u =>
    u
      .combine('textureFormat', kTextureFormats)
      .beginSubcases()
      // If undefined, should default to textureFormat.
      .combine('viewFormat', [undefined, ...kTextureFormats])
  )
  .fn(async t => {
    const { textureFormat, viewFormat } = t.params;
    await t.selectDeviceForTextureFormatOrSkipTestCase([textureFormat, viewFormat]);

    const texture = t.device.createTexture({
      format: textureFormat,
      size: [4, 4],
      usage: GPUTextureUsage.SAMPLED,
    });

    const success = viewFormat === undefined || viewFormat === textureFormat;
    t.expectValidationError(() => {
      texture.createView({ format: viewFormat });
    }, !success);
  });

g.test('dimension')
  .desc(
    `For all {texture dimension}, {view dimension}, test that they must be compatible:
  - 1d -> 1d
  - 2d -> 2d, 2d-array, cube, or cube-array
  - 3d -> 3d`
  )
  .params(u =>
    u
      .combine('textureDimension', kTextureDimensions)
      .combine('viewDimension', [...kTextureViewDimensions, undefined])
  )
  .fn(t => {
    const { textureDimension, viewDimension } = t.params;

    const size = textureDimension === '1d' ? [4] : [4, 4, 6];
    const textureDescriptor = {
      format: 'rgba8unorm' as const,
      dimension: textureDimension,
      size,
      usage: GPUTextureUsage.SAMPLED,
    };
    const texture = t.device.createTexture(textureDescriptor);

    const view = { dimension: viewDimension };
    const reified = reifyTextureViewDescriptor(textureDescriptor, view);

    const success = getTextureDimensionFromView(reified.dimension) === textureDimension;
    t.expectValidationError(() => {
      texture.createView(view);
    }, !success);
  });

g.test('aspect')
  .desc(
    `For every {format}x{aspect}, test that the view aspect must exist in the format:
  - "all" is allowed for any format
  - "depth-only" is allowed only for depth and depth-stencil formats
  - "stencil-only" is allowed only for stencil and depth-stencil formats`
  )
  .params(u =>
    u //
      .combine('format', kTextureFormats)
      .combine('aspect', kTextureAspects)
  )
  .fn(async t => {
    const { format, aspect } = t.params;
    await t.selectDeviceForTextureFormatOrSkipTestCase(format);
    const info = kTextureFormatInfo[format];

    const texture = t.device.createTexture({
      format,
      size: [4, 4, 1],
      usage: GPUTextureUsage.SAMPLED,
    });

    const success =
      aspect === 'all' ||
      (aspect === 'depth-only' && info.depth) ||
      (aspect === 'stencil-only' && info.stencil);
    t.expectValidationError(() => {
      texture.createView({ aspect });
    }, !success);
  });

g.test('dimension_layers')
  .desc(
    `For all possible texture view dimensions, test validation of layer counts:
  - 1d, 2d, and 3d must have exactly 1 layer
  - 2d-array must have 1 or more layers
  - cube must have 6 layers
  - cube-array must have a positive multiple of 6 layers`
  )
  .params(u =>
    u
      .combine('dimension', kTextureViewDimensions)
      .beginSubcases()
      .combine('baseArrayLayer', [0, 1, 6])
      .combine('arrayLayerCount', [0, 1, 3, 4, 5, 6, 7, 12])
  )
  .fn(t => {
    const { dimension, arrayLayerCount } = t.params;

    const texture = t.device.createTexture({
      format: 'rgba8unorm',
      dimension: getTextureDimensionFromView(dimension),
      size: [4, 4, 18],
      usage: GPUTextureUsage.SAMPLED,
    });

    let success = arrayLayerCount > 0;
    if (dimension === '1d' || dimension === '2d' || dimension === '3d') {
      success &&= arrayLayerCount === 1;
    } else if (dimension === 'cube') {
      success &&= arrayLayerCount === 6;
    } else if (dimension === 'cube-array') {
      success &&= arrayLayerCount % 6 === 0;
    }

    t.expectValidationError(() => {
      texture.createView({ dimension, arrayLayerCount });
    }, !success);
  });

g.test('2d_array_layers')
  .desc(
    `Views must have at least one layer, and must be within the layers of the base texture.

  - arrayLayerCount=0 at various baseArrayLayer values
  - Cases where baseArrayLayer+arrayLayerCount goes past the end of the texture
  - Cases with baseArrayLayer or arrayLayerCount undefined (compares against reference defaulting impl)
  `
  )
  .paramsSubcasesOnly(u =>
    u
      .combineWithParams([
        { textureLayers: 1, textureLevels: 1 },
        { textureLayers: kLayers, textureLevels: kLevels },
      ])
      .combine('view', [
        {},
        { baseArrayLayer: 0 },
        { arrayLayerCount: 1 },
        { baseArrayLayer: 0, arrayLayerCount: 1 },
        { baseArrayLayer: 1, arrayLayerCount: 1 },
        { baseArrayLayer: kLayers - 2, arrayLayerCount: 1 },
        { baseArrayLayer: kLayers - 1, arrayLayerCount: 1 },
        { baseArrayLayer: 0, arrayLayerCount: 2 },
        { baseArrayLayer: 1, arrayLayerCount: 2 },
        { baseArrayLayer: kLayers - 2, arrayLayerCount: 2 },
        // For 2d-array/cube-array, arrayLayerCount == undefined means to use all remaining layers.
        // Otherwise it means a fixed 1 or 6 layers.
        { arrayLayerCount: undefined, baseArrayLayer: 0 },
        { arrayLayerCount: undefined, baseArrayLayer: 1 },
        { arrayLayerCount: undefined, baseArrayLayer: kLayers - 1 },
        { arrayLayerCount: undefined, baseArrayLayer: kLayers },
        // arrayLayerCount == 0 means zero array layers, which is never valid
        { arrayLayerCount: 0, baseArrayLayer: 0 },
        { arrayLayerCount: 0, baseArrayLayer: 1 },
        { arrayLayerCount: 0, baseArrayLayer: kLayers - 1 },
        { arrayLayerCount: 0, baseArrayLayer: kLayers },
        // array layer range out of bounds
        { baseArrayLayer: 0, arrayLayerCount: kLayers + 1 },
        { baseArrayLayer: 1, arrayLayerCount: kLayers },
        { baseArrayLayer: kLayers - 1, arrayLayerCount: 2 },
        { baseArrayLayer: kLayers, arrayLayerCount: 1 },
      ])
  )
  .fn(t => {
    const { textureLayers, textureLevels, view } = t.params;

    const textureDescriptor: GPUTextureDescriptor = {
      format: 'rgba8unorm',
      size: [32, 32, textureLayers],
      mipLevelCount: textureLevels,
      usage: GPUTextureUsage.SAMPLED,
    };
    const reified = reifyTextureViewDescriptor(textureDescriptor, view);
    let success =
      reified.baseArrayLayer < textureLayers &&
      reified.baseArrayLayer + reified.arrayLayerCount <= textureLayers;
    if (reified.dimension !== '2d-array') success &&= reified.arrayLayerCount === 1;

    const texture = t.device.createTexture(textureDescriptor);
    t.expectValidationError(() => {
      texture.createView(view);
    }, !success);
  });

g.test('mip_levels')
  .desc(
    `Views must have at least one level, and must be within the level of the base texture.

  - mipLevelCount=0 at various baseMipLevel values
  - Cases where baseMipLevel+mipLevelCount goes past the end of the texture
  - Cases with baseMipLevel or mipLevelCount undefined (compares against reference defaulting impl)
  `
  )
  .params(u =>
    u
      .combine('dimension', kTextureDimensions)
      .beginSubcases()
      .combineWithParams([
        { textureLayers: 1, textureLevels: 1 },
        { textureLayers: kLayers, textureLevels: kLevels },
      ])
      .combine('view', [
        {},
        { baseMipLevel: 0 },
        { mipLevelCount: 1 },
        { baseMipLevel: 0, mipLevelCount: 1 },
        { baseMipLevel: 1, mipLevelCount: 1 },
        { baseMipLevel: kLevels - 2, mipLevelCount: 1 },
        { baseMipLevel: kLevels - 1, mipLevelCount: 1 },
        { baseMipLevel: 0, mipLevelCount: 2 },
        { baseMipLevel: 1, mipLevelCount: 2 },
        { baseMipLevel: kLevels - 2, mipLevelCount: 2 },
        // mipLevelCount == undefined means to use all remaining levels
        { mipLevelCount: undefined, baseMipLevel: 0 },
        { mipLevelCount: undefined, baseMipLevel: 1 },
        { mipLevelCount: undefined, baseMipLevel: kLevels - 1 },
        { mipLevelCount: undefined, baseMipLevel: kLevels },
        // mipLevelCount == 0 means zero mip levels, which is never valid
        { mipLevelCount: 0, baseMipLevel: 0 },
        { mipLevelCount: 0, baseMipLevel: 1 },
        { mipLevelCount: 0, baseMipLevel: kLevels - 1 },
        { mipLevelCount: 0, baseMipLevel: kLevels },
        // mip level range out of bounds
        { baseMipLevel: 0, mipLevelCount: kLevels + 1 },
        { baseMipLevel: 1, mipLevelCount: kLevels },
        { baseMipLevel: kLevels - 1, mipLevelCount: 2 },
        { baseMipLevel: kLevels, mipLevelCount: 1 },
      ])
  )
  .fn(t => {
    const { dimension, textureLayers, textureLevels, view } = t.params;

    const textureDescriptor: GPUTextureDescriptor = {
      format: 'rgba8unorm',
      dimension,
      size: [32, 32, textureLayers],
      mipLevelCount: textureLevels,
      usage: GPUTextureUsage.SAMPLED,
    };
    const reified = reifyTextureViewDescriptor(textureDescriptor, view);
    const success =
      reified.baseMipLevel < textureLevels &&
      reified.baseMipLevel + reified.mipLevelCount <= textureLevels;

    const texture = t.device.createTexture(textureDescriptor);
    t.expectValidationError(() => {
      texture.createView(view);
    }, !success);
  });

g.test('cube_faces_square')
  .desc(
    `Test that the X/Y dimensions of cube and cube array textures must be square.
  - {2d (control case), cube, cube-array}`
  )
  .params(u =>
    u //
      .combine('dimension', ['2d', 'cube', 'cube-array'] as const)
      .combine('size', [
        [4, 4, 6],
        [5, 5, 6],
        [4, 5, 6],
        [4, 8, 6],
        [8, 4, 6],
      ])
  )
  .fn(async t => {
    const { dimension, size } = t.params;

    const texture = t.device.createTexture({
      format: 'rgba8unorm',
      size,
      usage: GPUTextureUsage.SAMPLED,
    });

    const success = dimension === '2d' || size[0] === size[1];
    t.expectValidationError(() => {
      texture.createView({ dimension });
    }, !success);
  });

g.test('texture_state')
  .desc(`createView should fail if the texture is invalid (but succeed if it is destroyed)`)
  .paramsSubcasesOnly(u => u.combine('state', kResourceStates))
  .fn(async t => {
    const { state } = t.params;
    const texture = t.createTextureWithState(state);

    t.expectValidationError(() => {
      texture.createView();
    }, state === 'invalid');
  });
