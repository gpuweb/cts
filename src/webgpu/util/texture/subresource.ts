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

  constructor(subresources: {
    mipRange: BeginEndRange | BeginCountRange;
    sliceRange: BeginEndRange | BeginCountRange;
  }) {
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
      for (let slice = this.sliceRange.begin; slice < this.sliceRange.end; ++slice) {
        yield { level, slice };
      }
    }
  }

  *mipLevels(): Generator<{ level: number; slices: Generator<number> }> {
    for (let level = this.mipRange.begin; level < this.mipRange.end; ++level) {
      yield {
        level,
        slices: rangeAsIterator(this.sliceRange),
      };
    }
  }
}

export function mipSize(size: [number], level: number): [number];
export function mipSize(size: [number, number], level: number): [number, number];
export function mipSize(size: [number, number, number], level: number): [number, number, number];
export function mipSize(size: GPUExtent3DDict, level: number): GPUExtent3DDict;
export function mipSize(size: GPUExtent3D, level: number): GPUExtent3D {
  const rShiftMax1 = (s: number) => Math.max(s >> level, 1);
  if (size instanceof Array) {
    return size.map(rShiftMax1);
  } else {
    return {
      width: rShiftMax1(size.width),
      height: rShiftMax1(size.height),
      depth: rShiftMax1(size.depth),
    };
  }
}
