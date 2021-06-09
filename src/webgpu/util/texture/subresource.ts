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
  readonly layerRange: BeginEndRange;

  constructor(subresources: {
    mipRange: BeginEndRange | BeginCountRange;
    layerRange: BeginEndRange | BeginCountRange;
  }) {
    this.mipRange = {
      begin: subresources.mipRange.begin,
      end: endOfRange(subresources.mipRange),
    };
    this.layerRange = {
      begin: subresources.layerRange.begin,
      end: endOfRange(subresources.layerRange),
    };
  }

  *each(): Generator<{ level: number; layer: number }> {
    for (let level = this.mipRange.begin; level < this.mipRange.end; ++level) {
      for (let layer = this.layerRange.begin; layer < this.layerRange.end; ++layer) {
        yield { level, layer };
      }
    }
  }

  *mipLevels(): Generator<{ level: number; layers: Generator<number> }> {
    for (let level = this.mipRange.begin; level < this.mipRange.end; ++level) {
      yield {
        level,
        layers: rangeAsIterator(this.layerRange),
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
