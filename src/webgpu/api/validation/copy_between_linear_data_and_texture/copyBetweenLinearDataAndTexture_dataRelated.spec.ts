export const description = '';

import { params, poptions, pbool } from '../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { kTextureFormats, kTextureFormatInfo } from '../../../capability_info.js';

import {
  CopyBetweenLinearDataAndTextureTest,
  kAllTestMethods,
  valuesToTestDivisibilityBy,
  Align,
} from './copyBetweenLinearDataAndTexture.js';

export const g = makeTestGroup(CopyBetweenLinearDataAndTextureTest);

g.test('texel_block_alignment_on_offset')
  .params(
    params()
      .combine(poptions('method', kAllTestMethods))
      .combine(poptions('format', kTextureFormats))
      .unless(({ format }) => !kTextureFormatInfo[format].copyable)
      .expand(function* (p) {
        yield* poptions(
          'offset',
          valuesToTestDivisibilityBy(kTextureFormatInfo[p.format].bytesPerBlock!)
        );
      })
  )
  .fn(async t => {
    const { format, offset, method } = t.params;
    const size = { width: 0, height: 0, depth: 0 };

    const texture = t.createAlignedTexture(format, size);

    const success = offset % kTextureFormatInfo[format].bytesPerBlock! === 0;

    t.testRun({ texture }, { offset, bytesPerRow: 0 }, size, { dataSize: offset, method, success });
  });

g.test('texel_block_alignment_on_rows_per_image')
  .params(
    params()
      .combine(poptions('method', kAllTestMethods))
      .combine(poptions('format', kTextureFormats))
      .unless(({ format }) => !kTextureFormatInfo[format].copyable)
      .expand(function* (p) {
        yield* poptions(
          'rowsPerImage',
          valuesToTestDivisibilityBy(kTextureFormatInfo[p.format].blockHeight!)
        );
      })
  )
  .fn(async t => {
    const { rowsPerImage, format, method } = t.params;
    const size = { width: 0, height: 0, depth: 0 };

    const texture = t.createAlignedTexture(format, size);

    const success = rowsPerImage % kTextureFormatInfo[format].blockHeight! === 0;

    t.testRun({ texture }, { bytesPerRow: 0, rowsPerImage }, size, {
      dataSize: 1,
      method,
      success,
    });
  });

g.test('bound_on_rows_per_image')
  .params(
    params()
      .combine(poptions('method', kAllTestMethods))
      .combine(poptions('rowsPerImageInBlocks', [0, 1, 2]))
      .combine(poptions('copyHeightInBlocks', [0, 1, 2]))
      .combine(poptions('copyDepth', [1, 3]))
  )
  .fn(async t => {
    const { rowsPerImageInBlocks, copyHeightInBlocks, copyDepth, method } = t.params;

    const format = 'rgba8unorm';
    const rowsPerImage = rowsPerImageInBlocks * kTextureFormatInfo[format].blockHeight!;
    const copyHeight = copyHeightInBlocks * kTextureFormatInfo[format].blockHeight!;

    const texture = t.device.createTexture({
      size: { width: 4, height: 4, depth: 3 },
      format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    // The WebGPU spec:
    // If layout.rowsPerImage is not 0, it must be greater than or equal to copyExtent.height.
    // If copyExtent.depth is greater than 1: layout.rowsPerImage must be greater than or equal to copyExtent.height.

    let success = true;
    if (rowsPerImage !== 0 && rowsPerImage < copyHeight) {
      success = false;
    }
    if (copyDepth > 1 && rowsPerImage < copyHeight) {
      success = false;
    }

    t.testRun(
      { texture },
      { bytesPerRow: 1024, rowsPerImage },
      { width: 0, height: copyHeight, depth: copyDepth },
      { dataSize: 1, method, success }
    );
  });

g.test('bound_on_offset')
  .params(
    params()
      .combine(poptions('method', kAllTestMethods))
      .combine(poptions('offsetInBlocks', [0, 1, 2]))
      .combine(poptions('dataSizeInBlocks', [0, 1, 2]))
  )
  .fn(async t => {
    const { offsetInBlocks, dataSizeInBlocks, method } = t.params;

    const format = 'rgba8unorm';
    const offset = offsetInBlocks * kTextureFormatInfo[format].bytesPerBlock!;
    const dataSize = dataSizeInBlocks * kTextureFormatInfo[format].bytesPerBlock!;

    const texture = t.device.createTexture({
      size: { width: 4, height: 4, depth: 1 },
      format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    const success = offset <= dataSize;

    t.testRun(
      { texture },
      { offset, bytesPerRow: 0 },
      { width: 0, height: 0, depth: 0 },
      { dataSize, method, success }
    );
  });

g.test('bound_on_bytes_per_row')
  .params(
    params()
      .combine(poptions('method', kAllTestMethods))
      .combine([
        { blocksPerRow: 2, additionalBytesPerRow: 0, copyWidthInBlocks: 2 }, // success
        { blocksPerRow: 2, additionalBytesPerRow: 5, copyWidthInBlocks: 3 }, // success if bytesPerBlock <= 5
        { blocksPerRow: 1, additionalBytesPerRow: 0, copyWidthInBlocks: 2 }, // failure
        { blocksPerRow: 0, additionalBytesPerRow: 0, copyWidthInBlocks: 1 }, // failure
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
    const {
      blocksPerRow,
      additionalBytesPerRow,
      copyWidthInBlocks,
      copyHeightInBlocks,
      copyDepth,
      format,
      method,
    } = t.params;

    // In the CopyB2T and CopyT2B cases we need to have bytesPerRow 256-aligned,
    // to make this happen we multiply copyWidth and bytesPerRow by 256, so that
    // the appropriate inequalities still hold.
    const bytesPerRowAlignment = method === 'WriteTexture' ? 1 : 256;

    const copyWidth =
      copyWidthInBlocks * kTextureFormatInfo[format].blockWidth! * bytesPerRowAlignment;
    const copyHeight = copyHeightInBlocks * kTextureFormatInfo[format].blockHeight!;
    const bytesPerRow =
      (blocksPerRow *
        kTextureFormatInfo[format].blockWidth! *
        kTextureFormatInfo[format].bytesPerBlock! +
        additionalBytesPerRow) *
      bytesPerRowAlignment;
    const size = { width: copyWidth, height: copyHeight, depth: copyDepth };

    const texture = t.createAlignedTexture(format, size);

    let success = true;
    if (copyHeight > 1 || copyDepth > 1) {
      success = bytesPerRow >= t.bytesInACompleteRow(copyWidth, format);
    }

    t.testRun({ texture }, { bytesPerRow, rowsPerImage: copyHeight }, size, {
      dataSize: 1024,
      method,
      success,
    });
  });

// Testing that the minimal data size condition is checked correctly.
// In the success case, we test the exact value.
// In the failing case, we test the exact value minus 1.
g.test('required_bytes_in_copy')
  .params(
    params()
      .combine(poptions('method', kAllTestMethods))
      .combine([
        { bytesPerRowPadding: 0, rowsPerImagePaddingInBlocks: 0 }, // no padding
        { bytesPerRowPadding: 0, rowsPerImagePaddingInBlocks: 6 }, // rowsPerImage padding
        { bytesPerRowPadding: 6, rowsPerImagePaddingInBlocks: 0 }, // bytesPerRow padding
        { bytesPerRowPadding: 15, rowsPerImagePaddingInBlocks: 17 }, // both paddings
      ])
      .combine([
        { copyWidthInBlocks: 3, copyHeightInBlocks: 4, copyDepth: 5, offsetInBlocks: 0 }, // standard copy
        { copyWidthInBlocks: 5, copyHeightInBlocks: 4, copyDepth: 3, offsetInBlocks: 11 }, // standard copy, offset > 0
        { copyWidthInBlocks: 256, copyHeightInBlocks: 3, copyDepth: 2, offsetInBlocks: 0 }, // copyWidth is 256-aligned
        { copyWidthInBlocks: 0, copyHeightInBlocks: 4, copyDepth: 5, offsetInBlocks: 0 }, // empty copy because of width
        { copyWidthInBlocks: 3, copyHeightInBlocks: 0, copyDepth: 5, offsetInBlocks: 0 }, // empty copy because of height
        { copyWidthInBlocks: 3, copyHeightInBlocks: 4, copyDepth: 0, offsetInBlocks: 13 }, // empty copy because of depth, offset > 0
        { copyWidthInBlocks: 1, copyHeightInBlocks: 4, copyDepth: 5, offsetInBlocks: 0 }, // copyWidth = 1
        { copyWidthInBlocks: 3, copyHeightInBlocks: 1, copyDepth: 5, offsetInBlocks: 15 }, // copyHeight = 1, offset > 0
        { copyWidthInBlocks: 5, copyHeightInBlocks: 4, copyDepth: 1, offsetInBlocks: 0 }, // copyDepth = 1
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
      method,
    } = t.params;

    // In the CopyB2T and CopyT2B cases we need to have bytesPerRow 256-aligned,
    // to make this happen we align the bytesInACompleteRow value and multiply
    // bytesPerRowPadding by 256.
    const bytesPerRowAlignment = method === 'WriteTexture' ? 1 : 256;

    const copyWidth = copyWidthInBlocks * kTextureFormatInfo[format].blockWidth!;
    const copyHeight = copyHeightInBlocks * kTextureFormatInfo[format].blockHeight!;
    const offset = offsetInBlocks * kTextureFormatInfo[format].bytesPerBlock!;
    const rowsPerImage =
      copyHeight + rowsPerImagePaddingInBlocks * kTextureFormatInfo[format].blockHeight!;
    const bytesPerRow =
      Align(t.bytesInACompleteRow(copyWidth, format), bytesPerRowAlignment) +
      bytesPerRowPadding * bytesPerRowAlignment;
    const size = { width: copyWidth, height: copyHeight, depth: copyDepth };

    const minDataSize =
      offset + t.requiredBytesInCopy({ offset, bytesPerRow, rowsPerImage }, format, size);

    // We can't run a failing test with minDataSize = 0.
    if (minDataSize === 0 && !success) {
      return;
    }

    const dataSize = success ? minDataSize : minDataSize - 1;

    const texture = t.createAlignedTexture(format, size);

    t.testRun({ texture }, { offset, bytesPerRow, rowsPerImage }, size, {
      dataSize,
      method,
      success,
    });
  });
