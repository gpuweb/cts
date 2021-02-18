export function maxMipLevelCount(
  size: GPUExtent3DDict,
  dimension: GPUTextureDimension | undefined
): number {
  let maxMippedDimension = size.width;
  if (dimension !== '1d') maxMippedDimension = Math.max(maxMippedDimension, size.height);
  if (dimension === '3d') maxMippedDimension = Math.max(maxMippedDimension, size.depth);
  return Math.log2(maxMippedDimension) + 1;
}
