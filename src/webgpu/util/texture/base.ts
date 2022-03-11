import { assert, unreachable } from '../../../common/util/util.js';
import { kTextureFormatInfo } from '../../capability_info.js';
import { align } from '../../util/math.js';
import { reifyExtent3D } from '../../util/unions.js';

/**
 * Compute the maximum mip level count allowed for a given texture size and texture dimension.
 */
export function maxMipLevelCount({
  size,
  dimension = '2d',
}: {
  readonly size: Readonly<GPUExtent3DDict> | readonly number[];
  readonly dimension?: GPUTextureDimension;
}): number {
  const sizeDict = reifyExtent3D(size);

  let maxMippedDimension = 0;
  switch (dimension) {
    case '1d':
      maxMippedDimension = 1; // No mipmaps allowed.
      break;
    case '2d':
      maxMippedDimension = Math.max(sizeDict.width, sizeDict.height);
      break;
    case '3d':
      maxMippedDimension = Math.max(sizeDict.width, sizeDict.height, sizeDict.depthOrArrayLayers);
      break;
  }

  return Math.floor(Math.log2(maxMippedDimension)) + 1;
}

/**
 * Compute the "physical size" of a mip level: the size of the level, rounded up to a
 * multiple of the texel block size.
 */
export function physicalMipSize(
  baseSize: GPUExtent3D,
  format: GPUTextureFormat,
  dimension: GPUTextureDimension,
  mipLevel: number
): Required<GPUExtent3DDict> {
  const info = kTextureFormatInfo[format];
  const virtualSize = virtualMipSize(dimension, baseSize, mipLevel);

  return {
    width: align(virtualSize[0], info.blockWidth),
    height: align(virtualSize[1], info.blockHeight),
    depthOrArrayLayers: virtualSize[2],
  };
}

/**
 * Compute the "virtual size" of a mip level of a texture (not accounting for texel block rounding).
 */
export function virtualMipSize(
  dimension: GPUTextureDimension,
  size: GPUExtent3D,
  mipLevel: number
): [number, number, number] {
  const sz = reifyExtent3D(size);

  const shiftMinOne = (n: number) => Math.max(1, n >> mipLevel);
  switch (dimension) {
    case '1d':
      assert(sz.width >> mipLevel > 0);
      assert(sz.depthOrArrayLayers === 1 && sz.height === 1);
      return [shiftMinOne(sz.width), 1, 1];
    case '2d':
      assert(Math.max(sz.width, sz.height) >> mipLevel > 0);
      return [shiftMinOne(sz.width), shiftMinOne(sz.height), sz.depthOrArrayLayers];
    case '3d':
      assert(Math.max(sz.width, sz.height, sz.depthOrArrayLayers) >> mipLevel > 0);
      return [shiftMinOne(sz.width), shiftMinOne(sz.height), shiftMinOne(sz.depthOrArrayLayers)];
    default:
      unreachable();
  }
}

/**
 * Get texture dimension from view dimension in order to create an compatible texture for a given
 * view dimension.
 */
export function getTextureDimensionFromView(viewDimension: GPUTextureViewDimension) {
  switch (viewDimension) {
    case '1d':
      return '1d';
    case '2d':
    case '2d-array':
    case 'cube':
    case 'cube-array':
      return '2d';
    case '3d':
      return '3d';
    default:
      unreachable();
  }
}

/** Returns the possible valid view dimensions for a given texture dimension. */
export function viewDimensionsForTextureDimension(textureDimension: GPUTextureDimension) {
  switch (textureDimension) {
    case '1d':
      return ['1d'] as const;
    case '2d':
      return ['2d', '2d-array', 'cube', 'cube-array'] as const;
    case '3d':
      return ['3d'] as const;
  }
}

/** Reifies the optional fields of `GPUTextureDescriptor`.
 * MAINTENANCE_TODO: viewFormats should not be omitted here, but it seems likely that the
 * @webgpu/types definition will have to change before we can include it again.
 */
export function reifyTextureDescriptor(
  desc: Readonly<GPUTextureDescriptor>
): Required<Omit<GPUTextureDescriptor, 'label' | 'viewFormats'>> {
  return { dimension: '2d' as const, mipLevelCount: 1, sampleCount: 1, ...desc };
}

/** Reifies the optional fields of `GPUTextureViewDescriptor` (given a `GPUTextureDescriptor`). */
export function reifyTextureViewDescriptor(
  textureDescriptor: Readonly<GPUTextureDescriptor>,
  view: Readonly<GPUTextureViewDescriptor>
): Required<Omit<GPUTextureViewDescriptor, 'label'>> {
  const texture = reifyTextureDescriptor(textureDescriptor);

  // IDL defaulting

  const baseMipLevel = view.baseMipLevel ?? 0;
  const baseArrayLayer = view.baseArrayLayer ?? 0;
  const aspect = view.aspect ?? 'all';

  // Spec defaulting

  const format = view.format ?? texture.format;
  const mipLevelCount = view.mipLevelCount ?? texture.mipLevelCount - baseMipLevel;
  const dimension = view.dimension ?? texture.dimension;

  let arrayLayerCount = view.arrayLayerCount;
  if (arrayLayerCount === undefined) {
    if (dimension === '2d-array' || dimension === 'cube-array') {
      arrayLayerCount = reifyExtent3D(texture.size).depthOrArrayLayers - baseArrayLayer;
    } else if (dimension === 'cube') {
      arrayLayerCount = 6;
    } else {
      arrayLayerCount = 1;
    }
  }

  return {
    format,
    dimension,
    aspect,
    baseMipLevel,
    mipLevelCount,
    baseArrayLayer,
    arrayLayerCount,
  };
}
