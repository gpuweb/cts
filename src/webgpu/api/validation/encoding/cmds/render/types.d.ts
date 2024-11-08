// MAINTENANCE_TODO: Remove once https://github.com/gpuweb/gpuweb/pull/2315 is merged.
interface GPURenderPassEncoder {
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
