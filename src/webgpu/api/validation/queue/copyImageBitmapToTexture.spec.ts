export const description = `
copyImageBitmapToTexture Validation Tests in Queue.

Test Plan:
- For source.imageBitmap:
  - imageBitmap generated from ImageData:
    - Check that an error is generated when imageBitmap is closed.

- For destination.texture:
  - For 2d destination textures:
    - Check that an error is generated when texture is in destroyed state.
    - Check that an error is generated when texture is an error texture.
    - Check that an error is generated when texture is created without usage COPY_DST.
    - Check that an error is generated when sample count is not 1.
    - Check that an error is generated when mipLevel is too large.
    - Check that an error is generated when texture format is not valid.

- For copySize:
  - Noop copy shouldn't throw any exception or return any validation error.
  - Check that an error is generated when destination.texture.origin + copySize is too large.

TODO: 1d, 3d texture and 2d array textures.
`;

import { poptions, params } from '../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { kAllTextureFormats, kTextureUsages } from '../../../capability_info.js';
import { ValidationTest } from '../validation_test.js';

const kDefaultBytesPerPixel = 4; // using 'bgra8unorm' or 'rgba8unorm'
const kDefaultWidth = 32;
const kDefaultHeight = 32;
const kDefaultDepth = 1;
const kDefaultMipLevelCount = 6;

// From spec
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

function computeMipMapSize(width: number, height: number, mipLevel: number) {
  return {
    mipWidth: Math.max(width >> mipLevel, 1),
    mipHeight: Math.max(height >> mipLevel, 1),
  };
}

interface WithMipLevel {
  mipLevel: number;
}

interface WithSrcOrigin {
  srcOriginValue: GPUOrigin2DDict;
}

interface WithDstOriginMipLevel extends WithMipLevel {
  dstOriginValue: GPUOrigin3DDict;
}

// Helper function to generate copySize for src OOB test
function generateCopySizeForSrcOOB({ srcOriginValue }: WithSrcOrigin) {
  const origin = {
    x: srcOriginValue.x ? srcOriginValue.x : 0,
    y: srcOriginValue.y ? srcOriginValue.y : 0,
  };

  // OOB origin fails even with noop copy.
  if (origin.x > kDefaultWidth || origin.y > kDefaultHeight) {
    return poptions('copySize', [{ width: 0, height: 0, depth: 0 }]);
  }

  const justFitCopySize = {
    width: kDefaultWidth - origin.x,
    height: kDefaultHeight - origin.y,
    depth: 1,
  };

  return poptions('copySize', [
    justFitCopySize, // correct size, maybe noop copy.
    { width: justFitCopySize.width + 1, height: justFitCopySize.height, depth: 1 }, // OOB in width
    { width: justFitCopySize.width, height: justFitCopySize.height + 1, depth: 1 }, // OOB in height
  ]);
}

// Helper function to generate dst origin value based on mipLevel.
function generateDstOriginValue({ mipLevel }: WithMipLevel) {
  const origin = computeMipMapSize(kDefaultWidth, kDefaultHeight, mipLevel);

  return poptions('dstOriginValue', [
    { x: 0, y: 0, z: 0 },
    { x: origin.mipWidth - 1, y: 0, z: 0 },
    { x: 0, y: origin.mipHeight - 1, z: 0 },
    { x: origin.mipWidth, y: 0, z: 0 },
    { x: 0, y: origin.mipHeight, z: 0 },
    { x: 0, y: 0, z: kDefaultDepth },
    { x: origin.mipWidth + 1, y: 0, z: 0 },
    { x: 0, y: origin.mipHeight + 1, z: 0 },
    { x: 0, y: 0, z: kDefaultDepth + 1 },
  ]);
}

// Helper function to generate copySize for dst OOB test
function generateCopySizeForDstOOB({ mipLevel, dstOriginValue }: WithDstOriginMipLevel) {
  const dstMipMapSize = computeMipMapSize(kDefaultWidth, kDefaultHeight, mipLevel);
  const origin = {
    x: dstOriginValue.x ? dstOriginValue.x : 0,
    y: dstOriginValue.y ? dstOriginValue.y : 0,
    z: dstOriginValue.z ? dstOriginValue.z : 0,
  };

  // OOB origin fails even with noop copy.
  if (
    origin.x > dstMipMapSize.mipWidth ||
    origin.y > dstMipMapSize.mipHeight ||
    origin.z > kDefaultDepth
  ) {
    return poptions('copySize', [{ width: 0, height: 0, depth: 0 }]);
  }

  const justFitCopySize = {
    width: dstMipMapSize.mipWidth - origin.x,
    height: dstMipMapSize.mipHeight - origin.y,
    depth: kDefaultDepth - origin.z,
  };

  return poptions('copySize', [
    justFitCopySize,
    {
      width: justFitCopySize.width + 1,
      height: justFitCopySize.height,
      depth: justFitCopySize.depth,
    }, // OOB in width
    {
      width: justFitCopySize.width,
      height: justFitCopySize.height + 1,
      depth: justFitCopySize.depth,
    }, // OOB in height
    {
      width: justFitCopySize.width,
      height: justFitCopySize.height,
      depth: justFitCopySize.depth + 1,
    }, // OOB in depth
  ]);
}

class CopyImageBitmapToTextureTest extends ValidationTest {
  getImageData(width: number, height: number): ImageData {
    const pixelSize = kDefaultBytesPerPixel * width * height;
    const imagePixels = new Uint8ClampedArray(pixelSize);
    return new ImageData(imagePixels, width, height);
  }

  runTest(
    imageBitmapCopyView: GPUImageBitmapCopyView,
    textureCopyView: GPUTextureCopyView,
    copySize: GPUExtent3D,
    validationScopeSuccess: boolean,
    exceptionName?: string
  ): void {
    // CopyImageBitmapToTexture will generate two types of errors. One is synchronous exceptions;
    // the other is asynchronous validation error scope errors.
    if (exceptionName) {
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

g.test('source_imageBitmap_state')
  .params(poptions('closed', [true, false]))
  .fn(async t => {
    const { closed } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));
    const dstTexture = t.device.createTexture({
      size: { width: 1, height: 1, depth: 1 },
      format: 'bgra8unorm',
      usage: GPUTextureUsage.COPY_DST,
    });

    if (closed) imageBitmap.close();

    t.runTest(
      { imageBitmap },
      { texture: dstTexture },
      { width: 0, height: 0, depth: 0 },
      !closed,
      closed ? 'InvalidStateError' : ''
    );
  });

g.test('destination_texture_state')
  .params(poptions('destroyed', [true, false]))
  .fn(async t => {
    const { destroyed } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));
    const dstTexture = t.device.createTexture({
      size: { width: 1, height: 1, depth: 1 },
      format: 'bgra8unorm',
      usage: GPUTextureUsage.COPY_DST,
    });

    if (destroyed) dstTexture.destroy();

    t.runTest(
      { imageBitmap },
      { texture: dstTexture },
      { width: 0, height: 0, depth: 0 },
      !destroyed
    );
  });

g.test('error_destination_texture')
  .params(poptions('isErrDstTexture', [true, false]))
  .fn(async t => {
    const { isErrDstTexture } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));
    const correctTexture = t.device.createTexture({
      size: { width: 1, height: 1, depth: 1 },
      format: 'bgra8unorm',
      usage: GPUTextureUsage.COPY_DST,
    });

    t.runTest(
      { imageBitmap },
      { texture: isErrDstTexture ? t.getErrorTexture() : correctTexture },
      { width: 0, height: 0, depth: 0 },
      !isErrDstTexture
    );
  });

g.test('destination_texture_usage')
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
      { width: 0, height: 0, depth: 0 },
      !!(usage & GPUTextureUsage.COPY_DST)
    );
  });

g.test('destination_texture_sample_count')
  .params(poptions('sampleCount', [1, 4]))
  .fn(async t => {
    const { sampleCount } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));
    const dstTexture = t.device.createTexture({
      size: { width: 1, height: 1, depth: 1 },
      sampleCount,
      format: 'bgra8unorm',
      usage: GPUTextureUsage.COPY_DST,
    });

    t.runTest(
      { imageBitmap },
      { texture: dstTexture },
      { width: 0, height: 0, depth: 0 },
      sampleCount === 1
    );
  });

g.test('destination_texture_mipLevel')
  .params(poptions('mipLevel', [0, kDefaultMipLevelCount - 1, kDefaultMipLevelCount]))
  .fn(async t => {
    const { mipLevel } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));
    const dstTexture = t.device.createTexture({
      size: { width: kDefaultWidth, height: kDefaultHeight, depth: kDefaultDepth },
      mipLevelCount: kDefaultMipLevelCount,
      format: 'bgra8unorm',
      usage: GPUTextureUsage.COPY_DST,
    });

    t.runTest(
      { imageBitmap },
      { texture: dstTexture, mipLevel },
      { width: 0, height: 0, depth: 0 },
      mipLevel < kDefaultMipLevelCount
    );
  });

g.test('desitnation_texture_format')
  .params(poptions('format', kAllTextureFormats))
  .fn(async t => {
    const { format } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));

    // createTexture with all possible texture format may have validation error when using
    // compressed texture format.
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
      { width: 0, height: 0, depth: 0 },
      success,
      success ? '' : 'TypeError'
    );
  });

g.test('src_OOB')
  .params(
    params()
      .combine(
        poptions('srcOriginValue', [
          { x: 0, y: 0 }, // origin is on top-left
          { x: kDefaultWidth - 1, y: 0 }, // x near the border
          { x: 0, y: kDefaultHeight - 1 }, // y is near the border
          { x: kDefaultWidth, y: kDefaultHeight }, // origin is on bottom-right
          { x: kDefaultWidth + 1, y: 0 }, // x is too large
          { x: 0, y: kDefaultHeight + 1 }, // y is too large
        ])
      )
      .expand(generateCopySizeForSrcOOB)
  )
  .fn(async t => {
    const { srcOriginValue, copySize } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(kDefaultWidth, kDefaultHeight));
    const dstTexture = t.device.createTexture({
      size: { width: 2 * kDefaultWidth, height: 2 * kDefaultHeight, depth: kDefaultDepth },
      mipLevelCount: kDefaultMipLevelCount,
      format: 'bgra8unorm',
      usage: GPUTextureUsage.COPY_DST,
    });

    let success = true;
    let exceptionName: string | undefined;

    if (
      srcOriginValue.x + copySize.width > kDefaultWidth ||
      srcOriginValue.y + copySize.height > kDefaultHeight
    ) {
      success = false;
      exceptionName = 'RangeError';
    }

    t.runTest(
      { imageBitmap, origin: srcOriginValue },
      { texture: dstTexture },
      copySize,
      success,
      exceptionName
    );
  });

g.test('dst_OOB')
  .params(
    params()
      .combine(poptions('mipLevel', [0, 1, kDefaultMipLevelCount - 2]))
      .expand(generateDstOriginValue)
      .expand(generateCopySizeForDstOOB)
  )
  .fn(async t => {
    const { mipLevel, dstOriginValue, copySize } = t.params;

    const imageBitmap = await createImageBitmap(
      t.getImageData(kDefaultWidth + 1, kDefaultHeight + 1)
    );
    const dstTexture = t.device.createTexture({
      size: {
        width: kDefaultWidth,
        height: kDefaultHeight,
        depth: kDefaultDepth,
      },
      format: 'bgra8unorm',
      mipLevelCount: kDefaultMipLevelCount,
      usage: GPUTextureUsage.COPY_DST,
    });

    let success = true;

    const dstMipMapSize = computeMipMapSize(kDefaultWidth, kDefaultHeight, mipLevel);

    if (
      dstOriginValue.x + copySize.width > dstMipMapSize.mipWidth ||
      dstOriginValue.y + copySize.height > dstMipMapSize.mipHeight ||
      dstOriginValue.z + copySize.depth > kDefaultDepth
    ) {
      success = false;
    }

    t.runTest(
      { imageBitmap },
      {
        texture: dstTexture,
        mipLevel,
        origin: dstOriginValue,
      },
      copySize,
      success
    );
  });
