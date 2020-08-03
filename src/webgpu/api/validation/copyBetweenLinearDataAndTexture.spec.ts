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

  testRun(options: {
    texture: GPUTexture;
    origin: GPUOrigin3D;
    size: GPUExtent3D;
    mipLevel?: number;
    offset?: number;
    bytesPerRow: number;
    rowsPerImage: number;
    dataSize: number;
    method: TestMethod;
  }): void {
    const {
      texture,
      origin,
      size,
      mipLevel = 0,
      offset = 0,
      bytesPerRow,
      rowsPerImage,
      dataSize,
      method,
    } = options;

    switch (method) {
      case TestMethod.WriteTexture: {
        const data = new Uint8Array(dataSize);

        this.device.defaultQueue.writeTexture(
          { texture: texture, mipLevel: mipLevel, origin: origin },
          data,
          { offset: offset, bytesPerRow: bytesPerRow, rowsPerImage: rowsPerImage },
          size
        );

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
          { buffer: buffer, offset: offset, bytesPerRow: bytesPerRow, rowsPerImage: rowsPerImage },
          { texture: texture, mipLevel: mipLevel, origin: origin },
          size
        );
        this.device.defaultQueue.submit([encoder.finish()]);

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
          { texture: texture, mipLevel: mipLevel, origin: origin },
          { buffer: buffer, offset: offset, bytesPerRow: bytesPerRow, rowsPerImage: rowsPerImage },
          size
        );
        this.device.defaultQueue.submit([encoder.finish()]);

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
      .combine(pbool('success'))
  )
  .fn(async t => {
    const { method, success } = t.params;

    const texture = t.device.createTexture({
      size: { width: 4, height: 4, depth: 1 },
      mipLevelCount: 1,
      sampleCount: 1,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    if (!success) {
      // The texture becomes invalid.
      texture.destroy();
    }

    t.expectValidationError(() => {
      t.testRun({
        texture: texture,
        origin: { x: 0, y: 0, z: 0 },
        size: { width: 0, height: 0, depth: 0 },
        bytesPerRow: 256,
        rowsPerImage: 16,
        dataSize: 1,
        method: method,
      });
    }, !success);
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

    t.expectValidationError(() => {
      t.testRun({
        texture: texture,
        origin: { x: 0, y: 0, z: 0 },
        size: { width: 0, height: 0, depth: 0 },
        bytesPerRow: 256,
        rowsPerImage: 16,
        dataSize: 1,
        method: method,
      });
    }, !success);
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

    const _success = sampleCount === 1;

    t.expectValidationError(() => {
      t.testRun({
        texture: texture,
        origin: { x: 0, y: 0, z: 0 },
        size: { width: 0, height: 0, depth: 0 },
        bytesPerRow: 256,
        rowsPerImage: 16,
        dataSize: 1,
        method: method,
      });
    }, !_success);
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

    const _success = mipLevel < mipLevelCount;

    t.expectValidationError(() => {
      t.testRun({
        texture: texture,
        origin: { x: 0, y: 0, z: 0 },
        size: { width: 0, height: 0, depth: 0 },
        mipLevel: mipLevel,
        bytesPerRow: 256,
        rowsPerImage: 16,
        dataSize: 1,
        method: method,
      });
    }, !_success);
  });

g.test('1d_texture')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('copyWidth', [0, 1]))
      .combine(poptions('copyHeight', [0, 1]))
      .combine(poptions('copyDepth', [0, 1]))
  )
  .fn(async t => {
    const { copyWidth, copyHeight, copyDepth, method } = t.params;

    const texture = t.device.createTexture({
      size: { width: 2, height: 1, depth: 1 },
      mipLevelCount: 1,
      dimension: '1d',
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    // For 1d textures we require copyHeight and copyDepth to be 1,
    // copyHeight or copyDepth being 0 should cause a validation error.
    const _success = copyHeight == 1 && copyDepth == 1;

    t.expectValidationError(() => {
      t.testRun({
        texture: texture,
        origin: { x: 0, y: 0, z: 0 },
        size: { width: copyWidth, height: copyHeight, depth: copyDepth },
        mipLevel: 0,
        bytesPerRow: 256,
        rowsPerImage: 16,
        dataSize: 16,
        method: method,
      });
    }, !_success);
  });

enum Coord {
  x = 'x',
  y = 'y',
  z = 'z',
}

const kCoords = [Coord.x, Coord.y, Coord.z];

const kTestValuesForDivisibilityBy4 = [1, 2, 3, 4, 6, 8, 12];

g.test('texel_block_alignemnts_on_origin')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('value', kTestValuesForDivisibilityBy4))
      .combine(poptions('coordinate_to_test', kCoords))
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

    switch (coordinate_to_test) {
      case Coord.x: {
       origin.x = value;
       success = origin.x % kTextureFormatInfo[format].blockWidth === 0;
       break;
      }
      case Coord.y: {
       origin.y = value;
       success = origin.y % kTextureFormatInfo[format].blockHeight === 0;
       break;
      }
      case Coord.z: {
       origin.z = value;
       break;
      }
    }

    t.expectValidationError(() => {
      t.testRun({
        texture: texture,
        origin: origin,
        size: size,
        bytesPerRow: 1024,
        rowsPerImage: 16,
        dataSize: 1,
        method: method,
      });
    }, !success);
  });

g.test('texel_block_alignemnts_on_size')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('value', kTestValuesForDivisibilityBy4))
      .combine(poptions('coordinate_to_test', kCoords))
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

    switch (coordinate_to_test) {
      case Coord.x: {
        size.width = value;
        success = size.width % kTextureFormatInfo[format].blockWidth === 0;
        break;
      }
      case Coord.y: {
        size.height = value;
        success = size.height % kTextureFormatInfo[format].blockHeight === 0;
        break;
      }
      case Coord.z: {
        size.depth= value;
        break;
      }
    }

    t.expectValidationError(() => {
      t.testRun({
        texture: texture,
        origin: origin,
        size: size,
        bytesPerRow: 1024,
        rowsPerImage: 16,
        dataSize: 1,
        method: method,
      });
    }, !success);
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
      .combine(poptions('coordinate_to_test', kCoords))
  )
  .fn(async t => {
    const { origin_value, copy_size_value, texture_size_value, mipLevel, coordinate_to_test, method } = t.params;

    let origin = { x: 0, y: 0, z: 0 };
    let copy_size = { width: 0, height: 0, depth: 0 };
    let texture_size = { width: 16 << mipLevel, height: 16 << mipLevel, depth: 16 };
    const success = origin_value + copy_size_value <= texture_size_value;

    switch (coordinate_to_test) {
      case Coord.x: {
        origin.x = origin_value;
        copy_size.width = copy_size_value;
        texture_size.width = texture_size_value << mipLevel;
        break;
      }
      case Coord.y: {
        origin.y = origin_value;
        copy_size.height = copy_size_value;
        texture_size.height = texture_size_value << mipLevel;
        break;
      }
      case Coord.z: {
        origin.z = origin_value;
        copy_size.depth = copy_size_value;
        texture_size.depth = texture_size_value;
        break;
      }
    }

    console.log(origin.z, copy_size.depth, texture_size.depth);

    const texture = t.device.createTexture({
      size: texture_size,
      mipLevelCount: 3,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    t.expectValidationError(() => {
      t.testRun({
        texture: texture,
        origin: origin,
        size: copy_size,
        mipLevel: mipLevel,
        bytesPerRow: 1024,
        rowsPerImage: 32,
        dataSize: 1,
        method: method,
      });
    }, !success);
  });

/*** Data-related validation: ***/

g.test('texel_block_alignment_on_offset')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine([
        { mul: 0, div: 1 }, // test 0
        { mul: 1, div: 2 }, // test bytesPerBlock / 2
        { mul: 1, div: 1 }, // test bytesPerBlock
        { mul: 2, div: 1 }, // test 2 * bytesPerBlock
        { mul: 3, div: 2 }, // test 3 * bytesPerBlock / 2
        { mul: 3, div: 1 }, // test 3 * bytesPerBlock
      ])
      .combine(poptions('format', kTextureFormats))
      .unless(({ format }) => !kTextureFormatInfo[format].copyable)
  )
  .fn(async t => {
    const { mul, div, format, method } = t.params;

    const offset = Math.floor(kTextureFormatInfo[format].bytesPerBlock * mul / div);

    const texture = t.device.createTexture({
      size: { width: 12, height: 12, depth: 12 },
      mipLevelCount: 1,
      format: format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    let success = offset % kTextureFormatInfo[format].bytesPerBlock === 0;

    t.expectValidationError(() => {
      t.testRun({
        texture: texture,
        origin: { x: 0, y: 0, z: 0 },
        size: { width: 0, height: 0, depth: 0 },
        offset: offset,
        bytesPerRow: 1024,
        rowsPerImage: 16,
        dataSize: offset + 1,
        method: method,
      });
    }, !success);
  });

g.test('texel_block_alignemnt_on_rows_per_image')
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

    t.expectValidationError(() => {
      t.testRun({
        texture: texture,
        origin: { x: 0, y: 0, z: 0 },
        size: { width: 0, height: 0, depth: 0 },
        offset: 0,
        bytesPerRow: 1024,
        rowsPerImage: rowsPerImage,
        dataSize: 1,
        method: method,
      });
    }, !success);
  });

g.test('bound_on_rows_per_image')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('rowsPerImageInBlock', [0, 1, 2]))
      .combine(poptions('copyHeightInBlock', [0, 1, 2]))
      .combine(poptions('copyDepth', [1, 3]))
  )
  .fn(async t => {
    const { rowsPerImageInBlock, copyHeightInBlock, copyDepth, method } = t.params;

    const format = 'rgba8unorm';
    const rowsPerImage = rowsPerImageInBlock * kTextureFormatInfo[format].blockHeight;
    const copyHeight = copyHeightInBlock * kTextureFormatInfo[format].blockHeight;

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

    t.expectValidationError(() => {
      t.testRun({
        texture: texture,
        origin: { x: 0, y: 0, z: 0 },
        size: { width: 0, height: copyHeight, depth: copyDepth },
        offset: 0,
        bytesPerRow: 1024,
        rowsPerImage: rowsPerImage,
        dataSize: 1,
        method: method,
      });
    }, !success);
  });

g.test('bound_on_offset')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('offsetInBlock', [0, 1, 2]))
      .combine(poptions('dataSizeInBlock', [0, 1, 2]))
  )
  .fn(async t => {
    const { offsetInBlock, dataSizeInBlock, method } = t.params;

    const format = 'rgba8unorm';
    const offset = offsetInBlock * kTextureFormatInfo[format].bytesPerBlock;
    const dataSize = dataSizeInBlock * kTextureFormatInfo[format].bytesPerBlock;

    const texture = t.device.createTexture({
      size: { width: 4, height: 4, depth: 1 },
      mipLevelCount: 1,
      format: format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    let success = offset <= dataSize;

    t.expectValidationError(() => {
      t.testRun({
        texture: texture,
        origin: { x: 0, y: 0, z: 0 },
        size: { width: 0, height: 0, depth: 0 },
        offset: offset,
        bytesPerRow: 512,
        rowsPerImage: 4,
        dataSize: dataSize,
        method: method,
      });
    }, !success);
  });

/*** WriteTexture-specific tests ***/

g.test('bound_on_bytes_per_row')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture]))
      .combine([
        { blocksPerRow: 2, additionalBytesPerRow: 0, copyWidthInBlock: 2 }, // always success
        { blocksPerRow: 2, additionalBytesPerRow: 3, copyWidthInBlock: 3 }, // success if bytesPerBlock <= 3
        { blocksPerRow: 2, additionalBytesPerRow: 5, copyWidthInBlock: 3 }, // success if bytesPerBlock <= 5
        { blocksPerRow: 1, additionalBytesPerRow: 0, copyWidthInBlock: 0 }, // always failure
        { blocksPerRow: 2, additionalBytesPerRow: 1, copyWidthInBlock: 2 }, // always failure
        { blocksPerRow: 0, additionalBytesPerRow: 1, copyWidthInBlock: 1 }, // success if copyHeight and copyDepth = 1
        { blocksPerRow: 0, additionalBytesPerRow: 0, copyWidthInBlock: 1 }, // success if copyHeight and copyDepth = 1
      ])
      .combine([
        { copyHeightInBlock: 1, copyDepth: 1 },
        { copyHeightInBlock: 2, copyDepth: 1 },
        { copyHeightInBlock: 0, copyDepth: 2 },
      ])
      .combine(poptions('format', kTextureFormats))
      .unless(({ format }) => !kTextureFormatInfo[format].copyable)
  )
  .fn(async t => {
    const { blocksPerRow, additionalBytesPerRow, copyWidthInBlock, copyHeightInBlock, copyDepth, format, method } = t.params;

    const copyWidth = copyWidthInBlock * kTextureFormatInfo[format].blockWidth;
    const copyHeight = copyHeightInBlock * kTextureFormatInfo[format].blockHeight;
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

    t.expectValidationError(() => {
      t.testRun({
        texture: texture,
        origin: { x: 0, y: 0, z: 0 },
        size: { width: copyWidth, height: copyHeight, depth: copyDepth },
        offset: 0,
        bytesPerRow: bytesPerRow,
        rowsPerImage: 4,
        dataSize: 1024,
        method: method,
      });
    }, !success);
  });

// Testing that the minimal data size condition is checked correctly.
// In the success case, we test the exact value.
// In the failing case, we test the exact value minus 1.
g.test('required_bytes_in_copy')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture]))
      .combine(poptions('offsetInBlock', [0, 1]))
      .combine(poptions('bytesPerRowPadding', [0, 1]))
      .combine(poptions('rowsPerImagePaddingInBlock', [0]))
      .combine(poptions('copyWidthInBlock', [0]))
      .combine(poptions('copyHeightInBlock', [0]))
      .combine(poptions('copyDepth', [0]))
      .combine(poptions('format', kTextureFormats))
      .unless(({ format }) => !kTextureFormatInfo[format].copyable)
      .combine(pbool('success'))
  )
  .fn(async t => {
    const {
      offsetInBlock,
      bytesPerRowPadding,
      rowsPerImagePaddingInBlock,
      copyWidthInBlock,
      copyHeightInBlock,
      copyDepth,
      format,
      success,
      method
    } = t.params;

    const copyWidth = copyWidthInBlock * kTextureFormatInfo[format].blockWidth;
    const copyHeight = copyHeightInBlock * kTextureFormatInfo[format].blockHeight;
    const offset = offsetInBlock * kTextureFormatInfo[format].bytesPerBlock;
    const rowsPerImage = copyHeight + rowsPerImagePaddingInBlock * kTextureFormatInfo[format].blockHeight;
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

    t.expectValidationError(() => {
      t.testRun({
        texture: texture,
        origin: { x: 0, y: 0, z: 0 },
        size: size,
        offset: offset,
        bytesPerRow: bytesPerRow,
        rowsPerImage: rowsPerImage,
        dataSize: dataSize,
        method: method,
      });
    }, !success);
  });
