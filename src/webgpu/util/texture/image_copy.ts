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
): { validMinDataSize: number | undefined; bestGuessMinDataSize: number } {
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

  let requiredBytesInCopy = 0;
  {
    let { bytesPerRow, rowsPerImage } = layout;

    // (a) If heightInBlocks > 1, layout.bytesPerRow must be specified.
    // (b) If copyExtent.depth > 1, layout.bytesPerRow and layout.rowsPerImage must be specified.
    // (c) If specified, layout.bytesPerRow must be greater than or equal to bytesInLastRow.
    // (d) If specified, layout.rowsPerImage must be greater than or equal to heightInBlocks.
    //
    // But for the sake of various tests that don't actually care about the exact value, guess.
    if (bytesPerRow !== undefined && bytesPerRow < bytesInLastRow) {
      valid = false; // (c)
      bytesPerRow = undefined; // Override bytesPerRow to be sufficiently large.
    }
    if (bytesPerRow === undefined) {
      if (heightInBlocks > 1 || copyExtent.depth > 1) valid = false; // (a) (b)
      bytesPerRow = align(info.bytesPerBlock * widthInBlocks, 256);
    }
    if (rowsPerImage !== undefined && rowsPerImage < heightInBlocks) {
      valid = false; // (d)
      rowsPerImage = undefined; // Override rowsPerImage to be sufficiently large.
    }
    if (rowsPerImage === undefined) {
      if (copyExtent.depth > 1) valid = false; // (b)
      rowsPerImage = heightInBlocks;
    }

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

  const bestGuessMinDataSize = offset + requiredBytesInCopy;
  return {
    validMinDataSize: valid ? bestGuessMinDataSize : undefined,
    bestGuessMinDataSize,
  };
}
