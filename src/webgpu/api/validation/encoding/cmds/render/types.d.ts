// This can be removed once https://github.com/gpuweb/gpuweb/pull/2315 is merged.
interface GPURenderCommandsMixin {
  multiDrawIndirect(
    indirectBuffer: GPUBuffer,
    indirectOffset: GPUSize64,
    maxDrawCount: GPUSize32,
    drawCountBuffer?: GPUBuffer,
    drawCountOffset?: GPUSize64
  ): undefined;
  multiDrawIndexedIndirect(
    indirectBuffer: GPUBuffer,
    indirectOffset: GPUSize64,
    maxDrawCount: GPUSize32,
    drawCountBuffer?: GPUBuffer,
    drawCountOffset?: GPUSize64
  ): undefined;
}
