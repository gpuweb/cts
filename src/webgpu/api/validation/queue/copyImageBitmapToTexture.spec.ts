export const description = `
copyImageBitmapToTexture Validation Tests in Queue.

Test Coverage:
- For source.imagBitmap:
  - imageBitmap generated from ImageData:
    - Check that an error is generated when imageBitmap is closed. Otherwise, no error should be
      generated.

- For destination.texture:
  - For 2d destination textures:
    - Check that an error is generated when texture is in destroyed state. Otherwise, no error should
      be generated.
    - Check that an error is generated when texture is created without usage COPY_DST. Otherwise,
      no error should be generated.
    - Check that an error is generated when sample count is not 1. Otherwise, no error should be
      generated.
    - Check that an error is generated when mipLevel is too large. Otherwise, no error should be
      generated.
    - Check that an error is generated when texture format is not valid. Otherwise, no error should
      be generated.

- For copySize:
  - Check that an error is generated when copySize has 0 in width, height or depth. Otherwise,
    no error should be generated.
  - Check that an error is generated when destination.texture.origin + copySize is too large.
    Otherwise, no error should be generated.

TODO: more test to cover source.imageBitmap generated from different source.
TODO: 1d and 3d texture
`;

import { poptions, params } from '../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { unreachable } from '../../../../common/framework/util/util.js';
import { kAllTextureFormats, kTextureUsages } from '../../../capability_info.js';
import { ValidationTest } from '../validation_test.js';

const DEFAULT_BYTES_PER_PIXEL = 4;
const DEFAULT_WIDTH = 4;
const DEFAULT_HEIGHT = 4;
const DEFAULT_DEPTH = 4;
const DEFAULT_MIPLEVEL_COUNT = 1;

const kValidTextureFormatsForCopyIB2T = [
  'rgba8unorm',
  'rgba8unorm-srgb',
  'bgra8unorm',
  'bgra8unorm-srgb',
  'rgb10a2unorm',
  'rgba16float',
  'rgba32float',
  'rg8unorm',
  'rg16float',
];

interface WithDimension {
  dimension: GPUTextureDimension;
}

// Helper function to generate correct texture size.
function copySizeTestForDstTextureSize({ dimension }: WithDimension) {
  switch (dimension) {
    case '1d':
      return poptions('dstTextureSize', [
        { width: DEFAULT_WIDTH, height: 1, depth: 1 },
        { width: DEFAULT_WIDTH + 1, height: 1, depth: 1 },
      ]);
    case '2d':
      return poptions('dstTextureSize', [
        { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, depth: 1 },
        { width: DEFAULT_WIDTH + 1, height: DEFAULT_HEIGHT + 1, depth: 1 },
      ]);
    case '3d':
      return poptions('dstTextureSize', [
        { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, depth: DEFAULT_DEPTH },
        { width: DEFAULT_WIDTH + 1, height: DEFAULT_HEIGHT + 1, depth: DEFAULT_DEPTH + 1 },
      ]);
  }
}

// Generate source origin value[valid, invalid] which are GPUOrigin2D type.
function generateSrcOriginValue() {
  const value = [];
  // Values for each dimensions are valid or too large.
  for (let i = 0; i <= DEFAULT_WIDTH; i += DEFAULT_WIDTH) {
    for (let j = 0; j <= DEFAULT_HEIGHT; j += DEFAULT_HEIGHT) {
      value.push({ x: i, y: j });
    }
  }

  return value;
}

// Generate dst origin value[valid, invalid] which are GPUOrigin3D type
function generateDstOriginValue() {
  const value = [];
  // Values for each dimensions are valid or too large.
  for (let i = 0; i <= DEFAULT_WIDTH; i += DEFAULT_WIDTH) {
    for (let j = 0; j <= DEFAULT_HEIGHT; j += DEFAULT_HEIGHT) {
      for (let k = 0; k <= DEFAULT_DEPTH; k += DEFAULT_DEPTH) {
        value.push({ x: i, y: j, z: k });
      }
    }
  }

  return value;
}

// Generate copySizes[valid, invalid], which are GPUExtent3D type
function generateCopySizeValue() {
  const value = [];
  for (let i = 0; i <= DEFAULT_WIDTH; i += DEFAULT_WIDTH) {
    for (let j = 0; j <= DEFAULT_HEIGHT; j += DEFAULT_HEIGHT) {
      for (let k = 0; k <= DEFAULT_DEPTH; k += DEFAULT_DEPTH) {
        value.push({ width: i, height: j, depth: k });
      }
    }
  }
  return value;
}

class CopyImageBitmapToTextureTest extends ValidationTest {
  private getImageData(width: number, height: number): ImageData {
    const pixelSize = DEFAULT_BYTES_PER_PIXEL * width * height;
    const imagePixels = new Uint8ClampedArray(pixelSize);
    for (let i = 0; i < pixelSize; ++i) {
      imagePixels[i] = i;
    }
    return new ImageData(imagePixels, width, height);
  }

  async getImageBitmapCopyView(
    width: number,
    height: number,
    origin: GPUOrigin2D,
    closed: boolean
  ): Promise<GPUImageBitmapCopyView> {
    const imageBitmap = await createImageBitmap(this.getImageData(width, height));
    if (closed) {
      imageBitmap.close();
    }
    return { imageBitmap, origin };
  }

  // Get default source copy view with Default width, height and correct origin.
  async getDefaultImageBitmapCopyView(): Promise<GPUImageBitmapCopyView> {
    return this.getImageBitmapCopyView(DEFAULT_WIDTH, DEFAULT_HEIGHT, { x: 0, y: 0 }, false);
  }

  getTextureCopyView(
    size: GPUExtent3D,
    sampleCount: number,
    dimension: GPUTextureDimension,
    format: GPUTextureFormat,
    usage: GPUTextureUsageFlags,
    mipLevel: number,
    origin: GPUOrigin3D,
    destroyed: boolean
  ): GPUTextureCopyView {
    // In generated tests, there are some pairs will trigger validation errors here, eg. sampleCount
    // 4 and BC formats. Filter these validation and let copyImageBitmapToTexture to catch them.
    this.device.pushErrorScope('validation');
    const dstTexture = this.device.createTexture({
      size,
      sampleCount,
      dimension,
      mipLevelCount: DEFAULT_MIPLEVEL_COUNT,
      format,
      usage,
    });

    if (destroyed) {
      dstTexture.destroy();
    }
    this.device.popErrorScope();

    return { texture: dstTexture, mipLevel, origin };
  }

  // Generate dst texture copy view with default width, height.
  getTextureCopyViewWithDefaultSize(
    sampleCount: number,
    dimension: GPUTextureDimension,
    format: GPUTextureFormat,
    usage: GPUTextureUsageFlags,
    mipLevel: number,
    origin: GPUOrigin3D,
    destroyed: boolean
  ): GPUTextureCopyView {
    let size: GPUExtent3D = { width: 0, height: 0, depth: 0 };
    switch (dimension) {
      case '1d':
        size = { width: DEFAULT_WIDTH, height: 1, depth: 1 };
        break;
      case '2d':
        size = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, depth: 1 };
        break;
      case '3d':
        size = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, depth: DEFAULT_DEPTH };
        break;
      default:
        unreachable('unknown texture dimension');
    }

    return this.getTextureCopyView(
      size,
      sampleCount,
      dimension,
      format,
      usage,
      mipLevel,
      origin,
      destroyed
    );
  }

  // Generate dst texture copy view with default width, height and correct configs.
  getDefaultTextureCopyView(dimension: GPUTextureDimension): GPUTextureCopyView {
    return this.getTextureCopyViewWithDefaultSize(
      1,
      dimension,
      'bgra8unorm',
      GPUTextureUsage.COPY_DST,
      0,
      { x: 0, y: 0, z: 0 },
      false
    );
  }

  testRun(
    imageBitmapCopyView: GPUImageBitmapCopyView,
    textureCopyView: GPUTextureCopyView,
    copySize: GPUExtent3D,
    success: boolean,
    exceptionName?: string
  ): void {
    // CopyImageBitmapToTexture will generate two types of errors. One is exceptions generated out
    // of Dawn and the other is validation errors from Dawn.
    if (exceptionName && exceptionName.length !== 0) {
      this.shouldThrow(exceptionName, () => {
        this.device.defaultQueue.copyImageBitmapToTexture(
          imageBitmapCopyView,
          textureCopyView,
          copySize
        );
      });
    } else {
      this.expectValidationError(() => {
        this.device.defaultQueue.copyImageBitmapToTexture(
          imageBitmapCopyView,
          textureCopyView,
          copySize
        );
      }, !success);
    }
  }
}

export const g = makeTestGroup(CopyImageBitmapToTextureTest);

g.test('copyImageBitmapToTexture_source_imageBitmap_copy_view')
  .params(poptions('closed', [true, false]))
  .fn(async t => {
    const { closed } = t.params;
    const src = await t.getImageBitmapCopyView(
      DEFAULT_WIDTH,
      DEFAULT_HEIGHT,
      { x: 0, y: 0 },
      closed
    );
    const dst = t.getDefaultTextureCopyView('2d');
    const copySize = { width: 1, height: 1, depth: 1 };
    const exceptionName = closed ? 'InvalidStateError' : '';

    t.testRun(src, dst, copySize, !closed, exceptionName);
  });

g.test('copyImageBitmapToTexture_destination_texture_copy_view')
  .params(
    params()
      .combine(poptions('destroyed', [true, false]))
      .combine(poptions('dimension', ['2d'] as const))
      .combine(poptions('usage', kTextureUsages))
      .combine(poptions('sampleCount', [1, 4]))
      .combine(poptions('mipLevel', [0, 2]))
      .combine(poptions('format', kAllTextureFormats))
  )
  .fn(async t => {
    const { destroyed, dimension, usage, sampleCount, mipLevel, format } = t.params;
    const src = await t.getDefaultImageBitmapCopyView();
    const dst = t.getTextureCopyViewWithDefaultSize(
      sampleCount,
      dimension,
      format,
      usage,
      mipLevel,
      { x: 0, y: 0, z: 0 },
      destroyed
    );
    const copySize = { width: 1, height: 1, depth: 1 };

    let success = true;
    let exceptionName = '';

    if (destroyed) {
      success = false;
    }

    if (!(usage & GPUTextureUsage.COPY_DST)) {
      // Usage must have GPUTextureUsage.COPY_DST
      success = false;
    }

    if (sampleCount > 1) {
      // Dst texture cannot be multisampled due to imageBitmap.
      success = false;
    }

    if (mipLevel > 1) {
      // MipLevel value cannot exceed dst texture max mipLevel, which is 1 in tests.
      success = false;
    }

    if (!kValidTextureFormatsForCopyIB2T.includes(format)) {
      // Dst texture format needs to be supported in copyImageBitmapToTexture.
      success = false;
      exceptionName = 'TypeError';
    }

    t.testRun(src, dst, copySize, success, exceptionName);
  });

g.test('copyImageBitmapToTexture_copy_size')
  .params(
    params()
      .combine(poptions('dimension', ['2d'] as const))
      .expand(copySizeTestForDstTextureSize)
      .combine(
        poptions('srcImageBitmapSize', [
          { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }, // case: src size <= dst size
          { width: DEFAULT_WIDTH + 1, height: DEFAULT_HEIGHT + 1 }, // case: src size >= dst size
        ])
      )
      .combine(poptions('srcOriginValue', generateSrcOriginValue()))
      .combine(poptions('dstOriginValue', generateDstOriginValue()))
      .combine(poptions('copySize', generateCopySizeValue()))
  )
  .fn(async t => {
    const {
      dimension,
      dstTextureSize,
      srcImageBitmapSize,
      srcOriginValue,
      dstOriginValue,
      copySize,
    } = t.params;

    if (dimension !== '2d') {
      t.skip('Skip test case for now because no 1d, 3d texture supported');
    }

    const src = await t.getImageBitmapCopyView(
      srcImageBitmapSize.width,
      srcImageBitmapSize.height,
      srcOriginValue,
      false
    );

    const dst = t.getTextureCopyView(
      dstTextureSize,
      1,
      dimension,
      'rgba8unorm',
      GPUTextureUsage.COPY_DST,
      0,
      dstOriginValue,
      false
    );

    let success = true;
    let exceptionName = '';

    if (
      srcImageBitmapSize.width <= srcOriginValue.x ||
      srcImageBitmapSize.width - srcOriginValue.x < copySize.width ||
      srcImageBitmapSize.height <= srcOriginValue.y ||
      srcImageBitmapSize.height - srcOriginValue.y < copySize.height ||
      copySize.width === 0 ||
      copySize.height === 0 ||
      copySize.depth === 0
    ) {
      success = false;
      exceptionName = 'RangeError';
    }

    if (
      dstTextureSize.width <= dstOriginValue.x ||
      dstTextureSize.width - dstOriginValue.x < copySize.width ||
      dstTextureSize.height <= dstOriginValue.y ||
      dstTextureSize.height - dstOriginValue.y < copySize.height ||
      dstTextureSize.depth <= dstOriginValue.z ||
      dstTextureSize.depth - dstOriginValue.z < copySize.depth
    ) {
      success = false;
    }

    t.testRun(src, dst, copySize, success, exceptionName);
  });
