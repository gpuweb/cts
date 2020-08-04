export const description = `
writeTexture validation tests.
`;

import { params, poptions, pbool } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import { kTextureFormats, kTextureFormatInfo } from '../../capability_info.js';

import { CopyBetweenLinearDataAndTextureTest, TestMethod } from './copyBetweenLinearDataAndTexture.js';

export const g = makeTestGroup(CopyBetweenLinearDataAndTextureTest);

g.test('bound_on_bytes_per_row')
  .params(
    params()
      .combine([
        { blocksPerRow: 2, additionalBytesPerRow: 0, copyWidthInBlocks: 2 }, // always success
        { blocksPerRow: 2, additionalBytesPerRow: 3, copyWidthInBlocks: 3 }, // success if bytesPerBlock <= 3
        { blocksPerRow: 2, additionalBytesPerRow: 5, copyWidthInBlocks: 3 }, // success if bytesPerBlock <= 5
        { blocksPerRow: 1, additionalBytesPerRow: 0, copyWidthInBlocks: 0 }, // always failure
        { blocksPerRow: 2, additionalBytesPerRow: 1, copyWidthInBlocks: 2 }, // always failure
        { blocksPerRow: 0, additionalBytesPerRow: 1, copyWidthInBlocks: 1 }, // success if copyHeight and copyDepth = 1
        { blocksPerRow: 0, additionalBytesPerRow: 0, copyWidthInBlocks: 1 }, // success if copyHeight and copyDepth = 1
      ])
      .combine([
        { copyHeightInBlocks: 0, copyDepth: 1 }, // we don't have to check the bound
        { copyHeightInBlocks: 2, copyDepth: 1 }, // we have to check the bound
        { copyHeightInBlocks: 0, copyDepth: 2 }, // we have to check the bound
      ])
      .combine(poptions('format', kTextureFormats))
      .unless(({ format }) => !kTextureFormatInfo[format].copyable)
  )
  .fn(async t => {
    const { blocksPerRow, additionalBytesPerRow, copyWidthInBlocks, copyHeightInBlocks, copyDepth, format } = t.params;

    const copyWidth = copyWidthInBlocks * kTextureFormatInfo[format].blockWidth;
    const copyHeight = copyHeightInBlocks * kTextureFormatInfo[format].blockHeight;
    const bytesPerRow = blocksPerRow * kTextureFormatInfo[format].bytesPerBlock
                        + additionalBytesPerRow;

    const texture = t.device.createTexture({
      size: { width: 12, height: 12, depth: 12 },
      mipLevelCount: 1,
      format: format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    let success = true;
    if (copyHeight > 1 || copyDepth > 1) {
      success = bytesPerRow >= t.bytesInACompleteRow(copyWidth, format);
    }

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 } },
      { bytesPerRow: bytesPerRow, rowsPerImage: 4 },
      { width: copyWidth, height: copyHeight, depth: copyDepth },
      { dataSize: 1024, method: TestMethod.WriteTexture, success: success },
    );
  });

// Testing that the minimal data size condition is checked correctly.
// In the success case, we test the exact value.
// In the failing case, we test the exact value minus 1.
g.test('required_bytes_in_copy')
  .params(
    params()
      .combine(poptions('bytesPerRowPadding', [0, 1, 10]))
      .combine(poptions('rowsPerImagePaddingInBlocks', [0, 1, 12]))
      .combine([
        { copyWidthInBlocks: 3, copyHeightInBlocks: 4, copyDepth: 5, offsetInBlocks: 0 }, // standard copy
        { copyWidthInBlocks: 5, copyHeightInBlocks: 4, copyDepth: 3, offsetInBlocks: 0 }, // standard copy
        { copyWidthInBlocks: 0, copyHeightInBlocks: 4, copyDepth: 5, offsetInBlocks: 0 }, // empty copy because of width
        { copyWidthInBlocks: 3, copyHeightInBlocks: 4, copyDepth: 0, offsetInBlocks: 0 }, // empty copy because of depth
        { copyWidthInBlocks: 3, copyHeightInBlocks: 0, copyDepth: 5, offsetInBlocks: 0 }, // empty copy because of height
        { copyWidthInBlocks: 1, copyHeightInBlocks: 4, copyDepth: 5, offsetInBlocks: 0 }, // copyWidth = 1
        { copyWidthInBlocks: 3, copyHeightInBlocks: 1, copyDepth: 5, offsetInBlocks: 0 }, // copyHeight = 1
        { copyWidthInBlocks: 5, copyHeightInBlocks: 4, copyDepth: 1, offsetInBlocks: 0 }, // copyDepth = 1
        { copyWidthInBlocks: 4, copyHeightInBlocks: 5, copyDepth: 6, offsetInBlocks: 11 }, // offset > 0
        { copyWidthInBlocks: 4, copyHeightInBlocks: 0, copyDepth: 6, offsetInBlocks: 11 }, // offset > 0, empty copy
      ])
      .combine(poptions('format', kTextureFormats))
      .unless(({ format }) => !kTextureFormatInfo[format].copyable)
      .combine(pbool('success'))
  )
  .fn(async t => {
    const {
      offsetInBlocks,
      bytesPerRowPadding,
      rowsPerImagePaddingInBlocks,
      copyWidthInBlocks,
      copyHeightInBlocks,
      copyDepth,
      format,
      success,
    } = t.params;

    const copyWidth = copyWidthInBlocks * kTextureFormatInfo[format].blockWidth;
    const copyHeight = copyHeightInBlocks * kTextureFormatInfo[format].blockHeight;
    const offset = offsetInBlocks * kTextureFormatInfo[format].bytesPerBlock;
    const rowsPerImage = copyHeight + rowsPerImagePaddingInBlocks * kTextureFormatInfo[format].blockHeight;
    const bytesPerRow = t.bytesInACompleteRow(copyWidth, format) + bytesPerRowPadding;
    const size = { width: copyWidth, height: copyHeight, depth: copyDepth };

    const minDataSize = offset + t.requiredBytesInCopy({ offset: offset, bytesPerRow: bytesPerRow, rowsPerImage: rowsPerImage }, format, size);

    // We can't run a failing test with minDataSize = 0.
    if (minDataSize == 0 && !success) {
      return;
    }

    let dataSize = success ? minDataSize : minDataSize - 1;

    const texture = t.device.createTexture({
      size: { width: Math.max(copyWidth, 1), height: Math.max(copyHeight, 1), depth: Math.max(copyDepth, 1) },
      mipLevelCount: 1,
      format: format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 } },
      { offset: offset, bytesPerRow: bytesPerRow, rowsPerImage: rowsPerImage },
      size,
      { dataSize: dataSize, method: TestMethod.WriteTexture, success: success },
    );
  });
