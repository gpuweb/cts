import { assert } from '../../../common/framework/util/util.js';
import { kSizedTextureFormatInfo, SizedTextureFormat } from '../../capability_info.js';
import { align } from '../math.js';
import { standardizeExtent3D } from '../unions.js';

export type ImageCopyType = 'WriteTexture' | 'CopyB2T' | 'CopyT2B';
export const kImageCopyTypes: readonly ImageCopyType[] = [
  'WriteTexture',
  'CopyB2T',
  'CopyT2B',
] as const;

export function bytesInACompleteRow(copyWidth: number, format: SizedTextureFormat): number {
  const info = kSizedTextureFormatInfo[format];
  assert(copyWidth % info.blockWidth === 0);
  return (info.bytesPerBlock * copyWidth) / info.blockWidth;
}

/**
 * Validate a copy and compute the number of bytes it needs. If the copy is invalid, computes a
 * guess assuming `bytesPerRow` and `rowsPerImage` should be optimal.
 */
export function dataBytesForCopy(
  layout: GPUImageDataLayout,
  format: SizedTextureFormat,
  copyExtentValue: GPUExtent3D,
  { method }: { method: ImageCopyType }
): { minDataSize: number; valid: boolean } {
  const copyExtent = standardizeExtent3D(copyExtentValue);

  const info = kSizedTextureFormatInfo[format];
  assert(copyExtent.width % info.blockWidth === 0);
  const widthInBlocks = copyExtent.width / info.blockWidth;
  assert(copyExtent.height % info.blockHeight === 0);
  const heightInBlocks = copyExtent.height / info.blockHeight;
  const bytesInLastRow = widthInBlocks * info.bytesPerBlock;

  let valid = true;
  const offset = layout.offset ?? 0;
  if (method !== 'WriteTexture') {
    if (offset % info.bytesPerBlock !== 0) valid = false;
    if (layout.bytesPerRow && layout.bytesPerRow % 256 !== 0) valid = false;
  }
  if (layout.bytesPerRow !== undefined && bytesInLastRow > layout.bytesPerRow) valid = false;
  if (layout.rowsPerImage !== undefined && heightInBlocks > layout.rowsPerImage) valid = false;

  let requiredBytesInCopy = 0;
  {
    let { bytesPerRow, rowsPerImage } = layout;

    // If heightInBlocks > 1, layout.bytesPerRow must be specified.
    if (heightInBlocks > 1 && bytesPerRow === undefined) valid = false;
    // If copyExtent.depth > 1, layout.bytesPerRow and layout.rowsPerImage must be specified.
    if (copyExtent.depth > 1 && rowsPerImage === undefined) valid = false;
    // If specified, layout.bytesPerRow must be greater than or equal to bytesInLastRow.
    if (bytesPerRow !== undefined && bytesPerRow < bytesInLastRow) valid = false;
    // If specified, layout.rowsPerImage must be greater than or equal to heightInBlocks.
    if (rowsPerImage !== undefined && rowsPerImage < heightInBlocks) valid = false;

    bytesPerRow ??= align(info.bytesPerBlock * widthInBlocks, 256);
    rowsPerImage ??= heightInBlocks;

    if (copyExtent.depth > 1) {
      const bytesPerImage = bytesPerRow * rowsPerImage;
      const bytesBeforeLastImage = bytesPerImage * (copyExtent.depth - 1);
      requiredBytesInCopy += bytesBeforeLastImage;
    }
    if (copyExtent.depth > 0) {
      if (heightInBlocks > 1) requiredBytesInCopy += bytesPerRow * (heightInBlocks - 1);
      if (heightInBlocks > 0) requiredBytesInCopy += bytesInLastRow;
    }
  }

  return { minDataSize: offset + requiredBytesInCopy, valid };
}
