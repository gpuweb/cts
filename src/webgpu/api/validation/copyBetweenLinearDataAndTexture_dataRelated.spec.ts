export const description = `
writeTexture + copyBufferToTexture + copyTextureToBuffer validation tests on data
`;

import { params, poptions } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import { kTextureFormats, kTextureFormatInfo } from '../../capability_info.js';

import { CopyBetweenLinearDataAndTextureTest, kAllTestMethods, valuesToTestDivisibilityBy } from './copyBetweenLinearDataAndTexture.js';

export const g = makeTestGroup(CopyBetweenLinearDataAndTextureTest);

g.test('texel_block_alignment_on_offset')
  .params(
    params()
      .combine(poptions('method', kAllTestMethods))
      .combine(poptions('format', kTextureFormats))
      .unless(({ format }) => !kTextureFormatInfo[format].copyable)
      .expand(function* (p) { 
         yield* poptions('offset', valuesToTestDivisibilityBy(kTextureFormatInfo[p.format].bytesPerBlock));
       })
  )
  .fn(async t => {
    const { format, offset, method } = t.params;
    const size = { width: 0, height: 0, depth: 0 };

    const texture = t.createAlignedTexture(format, size);

    let success = offset % kTextureFormatInfo[format].bytesPerBlock === 0;

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 } },
      { offset: offset, bytesPerRow: 0, rowsPerImage: 0 },
      size,
      { dataSize: offset, method: method, success: success },
    );
  });

g.test('texel_block_alignment_on_rows_per_image')
  .params(
    params()
      .combine(poptions('method', kAllTestMethods))
      .combine(poptions('format', kTextureFormats))
      .unless(({ format }) => !kTextureFormatInfo[format].copyable)
      .expand(function* (p) { 
         yield* poptions('rowsPerImage', valuesToTestDivisibilityBy(kTextureFormatInfo[p.format].blockHeight));
       })
  )
  .fn(async t => {
    const { rowsPerImage, format, method } = t.params;
    const size = { width: 0, height: 0, depth: 0 };

    const texture = t.createAlignedTexture(format, size);

    let success = rowsPerImage % kTextureFormatInfo[format].blockHeight === 0;

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 } },
      { bytesPerRow: 0, rowsPerImage: rowsPerImage },
      size,
      { dataSize: 1, method: method, success: success },
    );
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
    const rowsPerImage = rowsPerImageInBlocks * kTextureFormatInfo[format].blockHeight;
    const copyHeight = copyHeightInBlocks * kTextureFormatInfo[format].blockHeight;

    const texture = t.device.createTexture({
      size: { width: 4, height: 4, depth: 3 },
      format: format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    // The WebGPU spec:
    // If layout.rowsPerImage is not 0, it must be greater than or equal to copyExtent.height.
    // If copyExtent.depth is greater than 1: layout.rowsPerImage must be greater than or equal to copyExtent.height.

    let success = true;
    if (rowsPerImage != 0 && rowsPerImage < copyHeight) {
      success = false;
    }
    if (copyDepth > 1 && rowsPerImage < copyHeight) {
      success = false;
    }

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 } },
      { bytesPerRow: 1024, rowsPerImage: rowsPerImage },
      { width: 0, height: copyHeight, depth: copyDepth },
      { dataSize: 1, method: method, success: success },
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
    const offset = offsetInBlocks * kTextureFormatInfo[format].bytesPerBlock;
    const dataSize = dataSizeInBlocks * kTextureFormatInfo[format].bytesPerBlock;

    const texture = t.device.createTexture({
      size: { width: 4, height: 4, depth: 1 },
      format: format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    let success = offset <= dataSize;

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 } },
      { offset: offset, bytesPerRow: 0, rowsPerImage: 0 },
      { width: 0, height: 0, depth: 0 },
      { dataSize: dataSize, method: method, success: success },
    );
  });
