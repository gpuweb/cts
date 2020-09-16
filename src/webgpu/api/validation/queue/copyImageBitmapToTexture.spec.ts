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
import { kAllTextureFormats, kTextureUsages } from '../../../capability_info.js';
import { ValidationTest } from '../validation_test.js';

const kDefaultBytesPerPixel = 4;
const kDefaultWidth = 32;
const kDefaultHeight = 32;
const kDefaultDepth = 1;
const kDefaultMipLevelCount = 6;

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

function getMipMapSize(width: number, height: number, mipLevel: number) {
  return {
    mipWidth: Math.max(width >> mipLevel, 1),
    mipHeight: Math.max(height >> mipLevel, 1),
  };
}

interface WithMipLevel {
  mipLevel: number;
}

interface WithMipLevelSizeAndOrigin extends WithMipLevel {
  srcImageSize: GPUExtent3DDict;
  dstTextureSize: GPUExtent3DDict;
  srcOriginValue: GPUOrigin2DDict;
  dstOriginValue: GPUOrigin3DDict;
}

function generateDstOriginValue({ mipLevel }: WithMipLevel) {
  const origin = getMipMapSize(kDefaultWidth, kDefaultHeight, mipLevel);

  return poptions('dstOriginValue', [
    { x: 0, y: 0, z: 0 },
    { x: origin.mipWidth, y: 0, z: 0 },
    { x: 0, y: origin.mipHeight, z: 0 },
    { x: 0, y: 0, z: kDefaultDepth },
  ]);
}

function generateCopySize({
  mipLevel,
  srcImageSize,
  dstTextureSize,
  srcOriginValue,
  dstOriginValue,
}: WithMipLevelSizeAndOrigin) {
  const dstMipMapSize = getMipMapSize(dstTextureSize.width, dstTextureSize.height, mipLevel);

  const justFitCopySize = {
    width:
      dstMipMapSize.mipWidth < srcImageSize.width ? dstMipMapSize.mipWidth : srcImageSize.width,
    height:
      dstMipMapSize.mipHeight < srcImageSize.height ? dstMipMapSize.mipHeight : srcImageSize.height,
    depth: kDefaultDepth,
  };

  const zeroSrcOrigin: GPUOrigin2DDict = { x: 0, y: 0 };
  const zeroDstOrigin: GPUOrigin3DDict = { x: 0, y: 0, z: 0 };

  if (srcOriginValue === zeroSrcOrigin && dstOriginValue === zeroDstOrigin) {
    return poptions('copySize', [
      {
        width: justFitCopySize.width + 1,
        height: justFitCopySize.height,
        depth: justFitCopySize.depth,
      },
      {
        width: justFitCopySize.width,
        height: justFitCopySize.height + 1,
        depth: justFitCopySize.depth,
      },
      {
        width: justFitCopySize.width,
        height: justFitCopySize.height,
        depth: justFitCopySize.depth + 1,
      },
    ]);
  }

  return poptions('copySize', [justFitCopySize]);
}

class CopyImageBitmapToTextureTest extends ValidationTest {
  getImageData(width: number, height: number): ImageData {
    const pixelSize = kDefaultBytesPerPixel * width * height;
    const imagePixels = new Uint8ClampedArray(pixelSize);
    for (let i = 0; i < pixelSize; ++i) {
      imagePixels[i] = i;
    }
    return new ImageData(imagePixels, width, height);
  }

  runTest(
    imageBitmapCopyView: GPUImageBitmapCopyView,
    textureCopyView: GPUTextureCopyView,
    copySize: GPUExtent3D,
    validationScopeSuccess: boolean,
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
      }, !validationScopeSuccess);
    }
  }
}

export const g = makeTestGroup(CopyImageBitmapToTextureTest);

g.test('copyImageBitmapToTexture_source_imageBitmap_copy_view')
  .params(poptions('closed', [true, false]))
  .fn(async t => {
    const { closed } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));
    const dstTexture = t.device.createTexture({
      size: { width: 1, height: 1, depth: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_DST,
    });

    if (closed) imageBitmap.close();

    t.runTest(
      { imageBitmap },
      { texture: dstTexture },
      { width: 1, height: 1, depth: 1 },
      !closed,
      closed ? 'InvalidStateError' : ''
    );
  });

g.test('copyImageBitmapToTexture_destination_texture_copy_view_texture_state')
  .params(poptions('destroyed', [true, false]))
  .fn(async t => {
    const { destroyed } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));
    const dstTexture = t.device.createTexture({
      size: { width: 1, height: 1, depth: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_DST,
    });

    if (destroyed) dstTexture.destroy();

    t.runTest(
      { imageBitmap },
      { texture: dstTexture },
      { width: 1, height: 1, depth: 1 },
      !destroyed
    );
  });

g.test('copyImageBitmapToTexture_error_destination_texture')
  .params(poptions('isErrDstTexture', [true, false]))
  .fn(async t => {
    const { isErrDstTexture } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));
    const correctTexture = t.device.createTexture({
      size: { width: 1, height: 1, depth: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_DST,
    });

    t.runTest(
      { imageBitmap },
      { texture: isErrDstTexture ? t.getErrorTexture() : correctTexture },
      { width: 1, height: 1, depth: 1 },
      !isErrDstTexture
    );
  });

g.test('copyImageBitmapToTexture_destination_texture_copy_view_texture_usage')
  .params(poptions('usage', kTextureUsages))
  .fn(async t => {
    const { usage } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));
    const dstTexture = t.device.createTexture({
      size: { width: 1, height: 1, depth: 1 },
      format: 'rgba8unorm',
      usage,
    });

    t.runTest(
      { imageBitmap },
      { texture: dstTexture },
      { width: 1, height: 1, depth: 1 },
      !!(usage & GPUTextureUsage.COPY_DST)
    );
  });

g.test('copyImageBitmapToTexture_destination_texture_copy_view_sample_count')
  .params(poptions('sampleCount', [1, 4]))
  .fn(async t => {
    const { sampleCount } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));
    const dstTexture = t.device.createTexture({
      size: { width: 1, height: 1, depth: 1 },
      sampleCount,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_DST,
    });

    t.runTest(
      { imageBitmap },
      { texture: dstTexture },
      { width: 1, height: 1, depth: 1 },
      sampleCount === 1
    );
  });

g.test('copyImageBitmapToTexture_destination_texture_copy_view_mipLevel')
  .params(poptions('mipLevel', [0, kDefaultMipLevelCount - 1, kDefaultMipLevelCount]))
  .fn(async t => {
    const { mipLevel } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));
    const dstTexture = t.device.createTexture({
      size: { width: kDefaultWidth, height: kDefaultHeight, depth: kDefaultDepth },
      mipLevelCount: kDefaultMipLevelCount,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_DST,
    });

    t.runTest(
      { imageBitmap },
      { texture: dstTexture, mipLevel },
      { width: 1, height: 1, depth: 1 },
      mipLevel < kDefaultMipLevelCount
    );
  });

g.test('copyImageBitmapToTexture_desitnation_texture_copy_view_format')
  .params(poptions('format', kAllTextureFormats))
  .fn(async t => {
    const { format } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));
    t.device.pushErrorScope('validation');
    const dstTexture = t.device.createTexture({
      size: { width: 1, height: 1, depth: 1 },
      format,
      usage: GPUTextureUsage.COPY_DST,
    });
    t.device.popErrorScope();

    const success = kValidTextureFormatsForCopyIB2T.includes(format);

    t.runTest(
      { imageBitmap },
      { texture: dstTexture },
      { width: 1, height: 1, depth: 1 },
      success,
      success ? '' : 'TypeError'
    );
  });

g.test('copyImageBitmapToTexture_copy_view_origin')
  .params(
    params()
      .combine(poptions('mipLevel', [0, 1, kDefaultMipLevelCount - 1]))
      .expand(generateDstOriginValue)
      .combine(
        poptions('srcOriginValue', [
          { x: 0, y: 0 },
          { x: kDefaultWidth, y: 0 },
          { x: 0, y: kDefaultHeight },
        ])
      )
  )
  .fn(async t => {
    const { mipLevel, dstOriginValue, srcOriginValue } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(kDefaultWidth, kDefaultHeight));
    const dstTexture = t.device.createTexture({
      size: { width: kDefaultWidth, height: kDefaultHeight, depth: kDefaultDepth },
      mipLevelCount: kDefaultMipLevelCount,
      format: 'bgra8unorm',
      usage: GPUTextureUsage.COPY_DST,
    });

    let success = true;
    let exceptionName: string | undefined;

    const dstMipMapSize = getMipMapSize(kDefaultWidth, kDefaultHeight, mipLevel);

    if (srcOriginValue.x >= kDefaultWidth || srcOriginValue.y >= kDefaultHeight) {
      success = false;
      exceptionName = 'RangeError';
    }

    if (
      dstOriginValue.x >= dstMipMapSize.mipWidth ||
      dstOriginValue.y >= dstMipMapSize.mipHeight ||
      dstOriginValue.z >= kDefaultDepth
    ) {
      success = false;
    }

    t.runTest(
      { imageBitmap, origin: srcOriginValue },
      { texture: dstTexture, origin: dstOriginValue, mipLevel },
      { width: 1, height: 1, depth: 1 },
      success,
      exceptionName
    );
  });

g.test('copyImageBitmapToTexture_copy_size_has_zero_element')
  .params(
    poptions('copySize', [
      { width: 0, height: 1, depth: 1 },
      { width: 1, height: 0, depth: 1 },
      { width: 1, height: 1, depth: 0 },
    ])
  )
  .fn(async t => {
    const { copySize } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));
    const dstTexture = t.device.createTexture({
      size: { width: 1, height: 1, depth: 1 },
      format: 'bgra8unorm',
      usage: GPUTextureUsage.COPY_DST,
    });

    t.runTest({ imageBitmap }, { texture: dstTexture }, copySize, false, 'RangeError');
  });

g.test('copyImageBitmapToTexture_copy_size_OOB')
  .params(
    params()
      .combine(poptions('mipLevel', [0, 1, kDefaultMipLevelCount - 2]))
      .combine(
        poptions('srcImageSize', [
          { width: kDefaultWidth, height: kDefaultHeight, depth: 1 },
          { width: 2 * kDefaultWidth, height: 2 * kDefaultHeight, depth: 1 },
        ])
      )
      .combine(
        poptions('dstTextureSize', [
          { width: kDefaultWidth, height: kDefaultHeight, depth: kDefaultDepth },
          { width: 2 * kDefaultWidth, height: 2 * kDefaultHeight, depth: kDefaultDepth },
        ])
      )
      .combine(
        poptions('srcOriginValue', [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ])
      )
      .combine(
        poptions('dstOriginValue', [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 1, z: 0 },
        ])
      )
      .expand(generateCopySize)
  )
  .fn(async t => {
    const {
      srcImageSize,
      dstTextureSize,
      mipLevel,
      srcOriginValue,
      dstOriginValue,
      copySize,
    } = t.params;

    const imageBitmap = await createImageBitmap(
      t.getImageData(srcImageSize.width, srcImageSize.height)
    );
    const dstTexture = t.device.createTexture({
      size: {
        width: dstTextureSize.width,
        height: dstTextureSize.height,
        depth: dstTextureSize.depth,
      },
      format: 'bgra8unorm',
      mipLevelCount: kDefaultMipLevelCount,
      usage: GPUTextureUsage.COPY_DST,
    });

    let success = true;
    let exceptionName: string | undefined;

    if (
      srcOriginValue.x + copySize.width > srcImageSize.width ||
      srcOriginValue.y + copySize.height > srcImageSize.height
    ) {
      success = false;
      exceptionName = 'RangeError';
    }

    const dstMipMapSize = getMipMapSize(dstTextureSize.width, dstTextureSize.height, mipLevel);

    if (
      dstOriginValue.x + copySize.width > dstMipMapSize.mipWidth ||
      dstOriginValue.y + copySize.height > dstMipMapSize.mipHeight ||
      dstOriginValue.z >= dstTextureSize.depth ||
      dstOriginValue.z + copySize.depth > dstTextureSize.depth
    ) {
      success = false;
    }

    t.runTest(
      { imageBitmap, origin: { x: srcOriginValue.x, y: srcOriginValue.y } },
      {
        texture: dstTexture,
        mipLevel,
        origin: { x: dstOriginValue.x, y: dstOriginValue.y, z: dstOriginValue.z },
      },
      { width: copySize.width, height: copySize.height, depth: copySize.depth },
      success,
      exceptionName
    );
  });
