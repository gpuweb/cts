export const description = `
writeTexture validation tests.
`;

import { params, poptions, pbool } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import { kTextureFormats, kTextureFormatInfo } from '../../capability_info.js';

import { ValidationTest } from './validation_test.js';

enum TestMethod {
  WriteTexture = 'WriteTexture',
  CopyBufferToTexture = 'CopyBufferToTexture',
  CopyTextureToBuffer = 'CopyTextureToBuffer',
}

class CopyBetweenLinearDataAndTextureTest extends ValidationTest {
  bytesInACompleteRow(copyWidth: number, format: GPUTextureFormat): number {
    return kTextureFormatInfo[format].bytesPerBlock * copyWidth / kTextureFormatInfo[format].blockWidth;
  }

  requiredBytesInCopy(layout: GPUTextureDataLayout, format: GPUTextureFormat, copyExtent: GPUExtent3DDict): number {
    if (copyExtent.width == 0 || copyExtent.height == 0 || copyExtent.depth == 0) {
      return 0;
    } else {
      const texelBlockRowsPerImage = layout.rowsPerImage / kTextureFormatInfo[format].blockHeight;
      const bytesPerImage = layout.bytesPerRow * texelBlockRowsPerImage;
      const bytesInLastSlice =
        layout.bytesPerRow * (copyExtent.height / kTextureFormatInfo[format].blockHeight - 1) +
        (copyExtent.width / kTextureFormatInfo[format].blockWidth * kTextureFormatInfo[format].bytesPerBlock);
      return bytesPerImage * (copyExtent.depth - 1) + bytesInLastSlice;
    }
  }

  testRun(
    textureCopyView: GPUTextureCopyView,
    textureDataLayout: GPUTextureDataLayout,
    size: GPUExtent3D,
    { dataSize, method, success }: { dataSize: number, method: TestMethod, success: Boolean }
  ): void {
     switch (method) {
      case TestMethod.WriteTexture: {
        const data = new Uint8Array(dataSize);
        
        this.expectValidationError(() => {
          this.device.defaultQueue.writeTexture(
            textureCopyView, data, textureDataLayout, size
          );
        }, !success);

        break;
      }
      case TestMethod.CopyBufferToTexture: {
        const buffer = this.device.createBuffer({
          mappedAtCreation: false,
          size: dataSize,
          usage: GPUBufferUsage.COPY_SRC,
        });

        const encoder = this.device.createCommandEncoder();
        encoder.copyBufferToTexture(
          { buffer: buffer, offset: textureDataLayout.offset, bytesPerRow: textureDataLayout.bytesPerRow, rowsPerImage: textureDataLayout.rowsPerImage },
          textureCopyView,
          size
        );

        this.expectValidationError(() => {
          this.device.defaultQueue.submit([encoder.finish()]);
        }, !success);

        break;
      }
      case TestMethod.CopyTextureToBuffer: {
        const buffer = this.device.createBuffer({
          mappedAtCreation: false,
          size: dataSize,
          usage: GPUBufferUsage.COPY_DST,
        });

        const encoder = this.device.createCommandEncoder();
        encoder.copyTextureToBuffer(
          textureCopyView,
          { buffer: buffer, offset: textureDataLayout.offset, bytesPerRow: textureDataLayout.bytesPerRow, rowsPerImage: textureDataLayout.rowsPerImage },
          size
        );

        this.expectValidationError(() => {
          this.device.defaultQueue.submit([encoder.finish()]);
        }, !success);

        break;
      }
    }
  }
}

export const g = makeTestGroup(CopyBetweenLinearDataAndTextureTest);

/*** Texture-related validation: ***/

g.test('texture_must_be_valid')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('texture_state', ['valid', 'destroyed', 'error']))
  )
  .fn(async t => {
    const { method, texture_state } = t.params;

    // A valid texture.
    let texture = t.device.createTexture({
      size: { width: 4, height: 4, depth: 1 },
      mipLevelCount: 1,
      sampleCount: 1,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    if (texture_state === 'destroyed') {
      // Texture becomes destroyed.
      texture.destroy();
    }

    if (texture_state === 'error') {
      // An error texture.
      t.device.pushErrorScope('validation');
      texture = t.device.createTexture({
        size: { width: 0, height: 0, depth: 0 },
        mipLevelCount: 1,
        sampleCount: 1,
        format: 'rgba8unorm',
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
      });
      t.device.popErrorScope();
    }

    let success = texture_state === 'valid';

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 } },
      { bytesPerRow: 256, rowsPerImage: 16 },
      { width: 0, height: 0, depth: 0 },
      { dataSize: 1, method: method, success: success },
    );
  });

g.test('texture_usage_must_be_valid')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('usage', [GPUTextureUsage.COPY_SRC, GPUTextureUsage.COPY_DST]))
  )
  .fn(async t => {
    const { usage, method } = t.params;

    const texture = t.device.createTexture({
      size: { width: 4, height: 4, depth: 1 },
      mipLevelCount: 1,
      sampleCount: 1,
      format: 'rgba8unorm',
      usage: usage,
    });

    const success = (method == TestMethod.CopyTextureToBuffer 
                      ? usage == GPUTextureUsage.COPY_SRC
                      : usage == GPUTextureUsage.COPY_DST);

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 } },
      { bytesPerRow: 256, rowsPerImage: 16 },
      { width: 0, height: 0, depth: 0 },
      { dataSize: 1, method: method, success: success },
    );
  });

g.test('sample_count_must_be_1')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('sampleCount', [1, 4]))
  )
  .fn(async t => {
    const { sampleCount, method } = t.params;

    const texture = t.device.createTexture({
      size: { width: 4, height: 4, depth: 1 },
      mipLevelCount: 1,
      sampleCount: sampleCount,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.SAMPLED,
    });

    const success = sampleCount === 1;

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 } },
      { bytesPerRow: 256, rowsPerImage: 16 },
      { width: 0, height: 0, depth: 0 },
      { dataSize: 1, method: method, success: success },
    );
  });

g.test('mip_level_must_be_in_range')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('mipLevelCount', [3, 5]))
      .combine(poptions('mipLevel', [3, 4]))
  )
  .fn(async t => {
    const { mipLevelCount, mipLevel, method } = t.params;

    const texture = t.device.createTexture({
      size: { width: 32, height: 32, depth: 1 },
      mipLevelCount: mipLevelCount,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    const success = mipLevel < mipLevelCount;

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 }, mipLevel: mipLevel },
      { bytesPerRow: 256, rowsPerImage: 16 },
      { width: 0, height: 0, depth: 0 },
      { dataSize: 1, method: method, success: success },
    );
  });

g.test('1d_texture')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('size', [
        { width: 1, height: 0, depth: 0},
        { width: 0, height: 0, depth: 0},
        { width: 0, height: 0, depth: 1},
        { width: 0, height: 1, depth: 0},
        { width: 0, height: 0, depth: 2},
        { width: 0, height: 2, depth: 0},
      ]))
  )
  .fn(async t => {
    const { size, method } = t.params;

    const texture = t.device.createTexture({
      size: { width: 2, height: 1, depth: 1 },
      mipLevelCount: 1,
      dimension: '1d',
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    // For 1d textures we require copyHeight and copyDepth to be 1,
    // copyHeight or copyDepth being 0 should cause a validation error.
    const success = size.height == 1 && size.depth == 1;

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 } },
      { bytesPerRow: 256, rowsPerImage: 16 },
      size,
      { dataSize: 16, method: method, success: success },
    );
  });

const kTestValuesForDivisibilityBy4 = [1, 2, 3, 4, 6, 8, 12];

g.test('texel_block_alignments_on_origin')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('value', kTestValuesForDivisibilityBy4))
      .combine(poptions('coordinate_to_test', ['x', 'y', 'z'] as const))
      .combine(poptions('format', kTextureFormats))
      .unless(({ format }) => !kTextureFormatInfo[format].copyable)
  )
  .fn(async t => {
    const { value, coordinate_to_test, format, method } = t.params;

    const texture = t.device.createTexture({
      size: { width: 12, height: 12, depth: 12 },
      mipLevelCount: 1,
      format: format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    let origin = { x: 0, y: 0, z: 0 };
    let size = { width: 0, height: 0, depth: 0 };
    let success = true;

    origin[coordinate_to_test] = value;
    switch (coordinate_to_test) {
      case 'x': {
       success = origin.x % kTextureFormatInfo[format].blockWidth === 0;
       break;
      }
      case 'y': {
       success = origin.y % kTextureFormatInfo[format].blockHeight === 0;
       break;
      }
    }

    t.testRun(
      { texture: texture, origin: origin },
      { bytesPerRow: 1024, rowsPerImage: 16 },
      size,
      { dataSize: 1, method: method, success: success },
    );
  });

g.test('texel_block_alignments_on_size')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('value', kTestValuesForDivisibilityBy4))
      .combine(poptions('coordinate_to_test', ['width', 'height', 'depth'] as const))
      .combine(poptions('format', kTextureFormats))
      .unless(({ format }) => !kTextureFormatInfo[format].copyable)
  )
  .fn(async t => {
    const { value, coordinate_to_test, format, method } = t.params;

    const texture = t.device.createTexture({
      size: { width: 12, height: 12, depth: 12 },
      mipLevelCount: 1,
      format: format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    let origin = { x: 0, y: 0, z: 0 };
    let size = { width: 0, height: 0, depth: 0 };
    let success = true;

    size[coordinate_to_test] = value;
    switch (coordinate_to_test) {
      case 'width': {
        success = size.width % kTextureFormatInfo[format].blockWidth === 0;
        break;
      }
      case 'height': {
        success = size.height % kTextureFormatInfo[format].blockHeight === 0;
        break;
      }
    }

    t.testRun(
      { texture: texture, origin: origin },
      { bytesPerRow: 1024, rowsPerImage: 16 },
      size,
      { dataSize: 1, method: method, success: success },
    );
  });

// TODO: might need dimensions.
g.test('texture_range_conditions')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('origin_value', [7, 8]))
      .combine(poptions('copy_size_value', [7, 8]))
      .combine(poptions('texture_size_value', [14, 15]))
      .combine(poptions('mipLevel', [0, 2]))
      .combine(poptions('coordinate_to_test', [0, 1, 2] as const))
  )
  .fn(async t => {
    const { origin_value, copy_size_value, texture_size_value, mipLevel, coordinate_to_test, method } = t.params;

    let origin: GPUOrigin3D = [0, 0, 0];
    let copy_size: GPUExtent3D = [0, 0, 0];
    let texture_size = { width: 16 << mipLevel, height: 16 << mipLevel, depth: 16 };
    const success = origin_value + copy_size_value <= texture_size_value;

    origin[coordinate_to_test] = origin_value;
    copy_size[coordinate_to_test] = copy_size_value;
    switch (coordinate_to_test) {
      case 0: {
        texture_size.width = texture_size_value << mipLevel;
        break;
      }
      case 1: {
        texture_size.height = texture_size_value << mipLevel;
        break;
      }
      case 2: {
        texture_size.depth = texture_size_value;
        break;
      }
    }

    const texture = t.device.createTexture({
      size: texture_size,
      mipLevelCount: 3,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    t.testRun(
      { texture: texture, origin: origin, mipLevel: mipLevel },
      { bytesPerRow: 1024, rowsPerImage: 32 },
      copy_size,
      { dataSize: 1, method: method, success: success },
    );
  });

/*** Data-related validation: ***/

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

/*** WriteTexture-specific tests ***/

g.test('bound_on_bytes_per_row')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture]))
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
    const { blocksPerRow, additionalBytesPerRow, copyWidthInBlocks, copyHeightInBlocks, copyDepth, format, method } = t.params;

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
      { dataSize: 1024, method: method, success: success },
    );
  });

// Testing that the minimal data size condition is checked correctly.
// In the success case, we test the exact value.
// In the failing case, we test the exact value minus 1.
g.test('required_bytes_in_copy')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture]))
      .combine(poptions('offsetInBlocks', [0, 1]))
      .combine(poptions('bytesPerRowPadding', [0, 1]))
      .combine(poptions('rowsPerImagePaddingInBlocks', [0]))
      .combine(poptions('copyWidthInBlocks', [0]))
      .combine(poptions('copyHeightInBlocks', [0]))
      .combine(poptions('copyDepth', [0]))
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
      method
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
      size: { width: copyWidth, height: copyHeight, depth: copyDepth },
      mipLevelCount: 1,
      format: format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 } },
      { offset: offset, bytesPerRow: bytesPerRow, rowsPerImage: rowsPerImage },
      size,
      { dataSize: dataSize, method: method, success: success },
    );
  });
