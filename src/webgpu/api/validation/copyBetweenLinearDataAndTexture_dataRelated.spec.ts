export const description = `
writeTexture validation tests.
`;

import { params, poptions } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import { kTextureFormats, kTextureFormatInfo } from '../../capability_info.js';

import { CopyBetweenLinearDataAndTextureTest, TestMethod, kTestValuesForDivisibilityBy4 } from './copyBetweenLinearDataAndTexture.js';

export const g = makeTestGroup(CopyBetweenLinearDataAndTextureTest);

g.test('texel_block_alignment_on_offset')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('halfBlocks', [0, 1, 2, 3, 4, 6]))
      .combine(poptions('format', kTextureFormats))
      .unless(({ format }) => !kTextureFormatInfo[format].copyable)
  )
  .fn(async t => {
    const { halfBlocks, format, method } = t.params;

    const offset = Math.floor(halfBlocks * kTextureFormatInfo[format].bytesPerBlock / 2);

    const texture = t.device.createTexture({
      size: { width: 12, height: 12, depth: 12 },
      mipLevelCount: 1,
      format: format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    let success = offset % kTextureFormatInfo[format].bytesPerBlock === 0;

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 } },
      { offset: offset, bytesPerRow: 1024, rowsPerImage: 16 },
      { width: 0, height: 0, depth: 0 },
      { dataSize: offset + 1, method: method, success: success },
    );
  });

g.test('texel_block_alignment_on_rows_per_image')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('rowsPerImage', kTestValuesForDivisibilityBy4))
      .combine(poptions('format', kTextureFormats))
      .unless(({ format }) => !kTextureFormatInfo[format].copyable)
  )
  .fn(async t => {
    const { rowsPerImage, format, method } = t.params;

    const texture = t.device.createTexture({
      size: { width: 12, height: 12, depth: 12 },
      mipLevelCount: 1,
      format: format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    let success = rowsPerImage % kTextureFormatInfo[format].blockHeight === 0;

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 } },
      { bytesPerRow: 1024, rowsPerImage: rowsPerImage },
      { width: 0, height: 0, depth: 0 },
      { dataSize: 1, method: method, success: success },
    );
  });

g.test('bound_on_rows_per_image')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
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
      mipLevelCount: 1,
      format: format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

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
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
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
      mipLevelCount: 1,
      format: format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    let success = offset <= dataSize;

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 } },
      { offset: offset, bytesPerRow: 512, rowsPerImage: 4 },
      { width: 0, height: 0, depth: 0 },
      { dataSize: dataSize, method: method, success: success },
    );
  });
