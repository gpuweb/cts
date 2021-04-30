import { assert } from '../../../common/framework/util/util.js';
import { kAllTextureFormatInfo } from '../../capability_info.js';
import { align } from '../../util/math.js';

export interface BeginCountRange {
  begin: number;
  count: number;
}

export interface BeginEndRange {
  begin: number;
  end: number;
}

function endOfRange(r: BeginEndRange | BeginCountRange): number {
  return 'count' in r ? r.begin + r.count : r.end;
}

function* rangeAsIterator(r: BeginEndRange | BeginCountRange): Generator<number> {
  for (let i = r.begin; i < endOfRange(r); ++i) {
    yield i;
  }
}

export class SubresourceRange {
  readonly mipRange: BeginEndRange;
  readonly sliceRange: BeginEndRange;

  constructor(
    subresources: {
      mipRange: BeginEndRange | BeginCountRange;
      sliceRange: BeginEndRange | BeginCountRange;
    },
    private depthOrArrayLayerCount: number,
    private dimension: GPUTextureDimension
  ) {
    this.mipRange = {
      begin: subresources.mipRange.begin,
      end: endOfRange(subresources.mipRange),
    };
    this.sliceRange = {
      begin: subresources.sliceRange.begin,
      end: endOfRange(subresources.sliceRange),
    };
  }

  *each(): Generator<{ level: number; slice: number }> {
    for (let level = this.mipRange.begin; level < this.mipRange.end; ++level) {
      const end =
        this.dimension === '3d'
          ? this.depthOrArrayLayerCount >> level
          : this.depthOrArrayLayerCount;
      for (let slice = this.sliceRange.begin; slice < Math.min(end, this.sliceRange.end); ++slice) {
        yield { level, slice };
      }
    }
  }

  *mipLevels(): Generator<{ level: number; slices: Generator<number> }> {
    for (let level = this.mipRange.begin; level < this.mipRange.end; ++level) {
      const end =
        this.dimension === '3d'
          ? this.depthOrArrayLayerCount >> level
          : this.depthOrArrayLayerCount;
      yield {
        level,
        slices: rangeAsIterator({
          begin: this.sliceRange.begin,
          end: Math.min(end, this.sliceRange.end),
        }),
      };
    }
  }
}

// TODO(jiawei.shao@intel.com): support 1D and 3D textures
export function physicalMipSize(
  size: Required<GPUExtent3DDict>,
  format: GPUTextureFormat,
  dimension: GPUTextureDimension,
  level: number
): Required<GPUExtent3DDict> {
  assert(dimension === '2d');
  assert(Math.max(size.width, size.height) >> level > 0);

  const virtualWidthAtLevel = Math.max(size.width >> level, 1);
  const virtualHeightAtLevel = Math.max(size.height >> level, 1);
  const physicalWidthAtLevel = align(virtualWidthAtLevel, kAllTextureFormatInfo[format].blockWidth);
  const physicalHeightAtLevel = align(
    virtualHeightAtLevel,
    kAllTextureFormatInfo[format].blockHeight
  );
  return {
    width: physicalWidthAtLevel,
    height: physicalHeightAtLevel,
    depthOrArrayLayers: size.depthOrArrayLayers,
  };
}
