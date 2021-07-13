export const description = `
copyExternalImageToTexture Validation Tests in Queue.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { timeout } from '../../../../../common/util/timeout.js';
import {
  kTextureFormatInfo,
  kTextureFormats,
  kTextureUsages,
  kValidTextureFormatsForCopyE2T,
} from '../../../../capability_info.js';
import { ValidationTest } from '../../validation_test.js';

const kDefaultBytesPerPixel = 4; // using 'bgra8unorm' or 'rgba8unorm'
const kDefaultWidth = 32;
const kDefaultHeight = 32;
const kDefaultDepth = 1;
const kDefaultMipLevelCount = 6;

function computeMipMapSize(width: number, height: number, mipLevel: number) {
  return {
    mipWidth: Math.max(width >> mipLevel, 1),
    mipHeight: Math.max(height >> mipLevel, 1),
  };
}

interface WithMipLevel {
  mipLevel: number;
}

interface WithDstOriginMipLevel extends WithMipLevel {
  dstOrigin: Required<GPUOrigin3DDict>;
}

async function awaitTimeout(ms: number) {
  await new Promise(() => {
    timeout(() => {}, ms);
  });
}

async function awaitOrTimeout(promise: Promise<void>, opt_timeout_ms: number = 5000) {
  async function throwOnTimeout(ms: number) {
    await awaitTimeout(ms);
    throw 'timeout';
  }

  const timeout_ms = opt_timeout_ms;

  await Promise.race([promise, throwOnTimeout(timeout_ms)]);
}

// Helper function to generate copySize for src OOB test
function generateCopySizeForSrcOOB({ srcOrigin }: { srcOrigin: Required<GPUOrigin2DDict> }) {
  // OOB origin fails even with no-op copy.
  if (srcOrigin.x > kDefaultWidth || srcOrigin.y > kDefaultHeight) {
    return [{ width: 0, height: 0, depthOrArrayLayers: 0 }];
  }

  const justFitCopySize = {
    width: kDefaultWidth - srcOrigin.x,
    height: kDefaultHeight - srcOrigin.y,
    depthOrArrayLayers: 1,
  };

  return [
    justFitCopySize, // correct size, maybe no-op copy.
    { width: justFitCopySize.width + 1, height: justFitCopySize.height, depthOrArrayLayers: 1 }, // OOB in width
    { width: justFitCopySize.width, height: justFitCopySize.height + 1, depthOrArrayLayers: 1 }, // OOB in height
    { width: justFitCopySize.width, height: justFitCopySize.height, depthOrArrayLayers: 2 }, // OOB in depthOrArrayLayers
  ];
}

// Helper function to generate dst origin value based on mipLevel.
function generateDstOriginValue({ mipLevel }: WithMipLevel) {
  const origin = computeMipMapSize(kDefaultWidth, kDefaultHeight, mipLevel);

  return [
    { x: 0, y: 0, z: 0 },
    { x: origin.mipWidth - 1, y: 0, z: 0 },
    { x: 0, y: origin.mipHeight - 1, z: 0 },
    { x: origin.mipWidth, y: 0, z: 0 },
    { x: 0, y: origin.mipHeight, z: 0 },
    { x: 0, y: 0, z: kDefaultDepth },
    { x: origin.mipWidth + 1, y: 0, z: 0 },
    { x: 0, y: origin.mipHeight + 1, z: 0 },
    { x: 0, y: 0, z: kDefaultDepth + 1 },
  ];
}

// Helper function to generate copySize for dst OOB test
function generateCopySizeForDstOOB({ mipLevel, dstOrigin }: WithDstOriginMipLevel) {
  const dstMipMapSize = computeMipMapSize(kDefaultWidth, kDefaultHeight, mipLevel);

  // OOB origin fails even with no-op copy.
  if (
    dstOrigin.x > dstMipMapSize.mipWidth ||
    dstOrigin.y > dstMipMapSize.mipHeight ||
    dstOrigin.z > kDefaultDepth
  ) {
    return [{ width: 0, height: 0, depthOrArrayLayers: 0 }];
  }

  const justFitCopySize = {
    width: dstMipMapSize.mipWidth - dstOrigin.x,
    height: dstMipMapSize.mipHeight - dstOrigin.y,
    depthOrArrayLayers: kDefaultDepth - dstOrigin.z,
  };

  return [
    justFitCopySize,
    {
      width: justFitCopySize.width + 1,
      height: justFitCopySize.height,
      depthOrArrayLayers: justFitCopySize.depthOrArrayLayers,
    }, // OOB in width
    {
      width: justFitCopySize.width,
      height: justFitCopySize.height + 1,
      depthOrArrayLayers: justFitCopySize.depthOrArrayLayers,
    }, // OOB in height
    {
      width: justFitCopySize.width,
      height: justFitCopySize.height,
      depthOrArrayLayers: justFitCopySize.depthOrArrayLayers + 1,
    }, // OOB in depthOrArrayLayers
  ];
}

function isValidContextType(contextName: string) {
  switch (contextName) {
    case '2d':
    case 'experimental-webgl':
    case 'webgl':
    case 'webgl2':
      return true;
    default:
      return false;
  }
}

class CopyExternalImageToTextureTest extends ValidationTest {
  getImageData(width: number, height: number): ImageData {
    const pixelSize = kDefaultBytesPerPixel * width * height;
    const imagePixels = new Uint8ClampedArray(pixelSize);
    return new ImageData(imagePixels, width, height);
  }

  getOffscreenCanvas(width: number, height: number): OffscreenCanvas {
    if (typeof OffscreenCanvas === 'undefined') {
      this.skip('OffscreenCanvas is not supported');
    }
    return new OffscreenCanvas(width, height);
  }

  runTest(
    imageBitmapCopyView: GPUImageCopyExternalImage,
    textureCopyView: GPUImageCopyTextureTagged,
    copySize: GPUExtent3D,
    validationScopeSuccess: boolean,
    exceptionName?: string
  ): void {
    // CopyImageBitmapToTexture will generate two types of errors. One is synchronous exceptions;
    // the other is asynchronous validation error scope errors.
    if (exceptionName) {
      this.shouldThrow(exceptionName, () => {
        this.device.queue.copyExternalImageToTexture(
          imageBitmapCopyView,
          textureCopyView,
          copySize
        );
      });
    } else {
      this.expectValidationError(() => {
        this.device.queue.copyExternalImageToTexture(
          imageBitmapCopyView,
          textureCopyView,
          copySize
        );
      }, !validationScopeSuccess);
    }
  }
}

export const g = makeTestGroup(CopyExternalImageToTextureTest);

g.test('source_canvas,contexts')
  .desc(
    `
  Test HTMLCanvasElement as source image with different contexts.

  Call HTMLCanvasElment.getContext() with different context type.
  Only '2d', 'experimental-webgl', 'webgl', 'webgl2' is valid context
  type.
  
  Check whether 'OperationError' is generated when context type is invalid.
  `
  )
  .params(u =>
    u //
      .combine('contextType', [
        '2d',
        'bitmaprenderer',
        'experimental-webgl',
        'gpupresent',
        'webgl',
        'webgl2',
      ] as const)
      .beginSubcases()
      .combine('copySize', [
        { width: 0, height: 0, depthOrArrayLayers: 0 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      ])
  )
  .fn(async t => {
    const { contextType, copySize } = t.params;
    const canvas = document.createElement('canvas');

    const dstTexture = t.device.createTexture({
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      format: 'bgra8unorm',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    canvas.getContext(contextType);

    t.runTest(
      { source: canvas },
      { texture: dstTexture },
      copySize,
      true, // No validation errors.
      isValidContextType(contextType) ? '' : 'OperationError'
    );
  });

g.test('source_offscreenCanvas,contexts')
  .desc(
    `
  Test OffscreenCanvas as source image with different contexts.

  Call OffscreenCanvas.getContext() with different context type.
  Only '2d', 'webgl', 'webgl2' is valid context type.

  Check whether 'OperationError' is generated when context type is invalid.
  `
  )
  .params(u =>
    u //
      .combine('contextType', ['2d', 'bitmaprenderer', 'webgl', 'webgl2'] as const)
      .beginSubcases()
      .combine('copySize', [
        { width: 0, height: 0, depthOrArrayLayers: 0 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      ])
  )
  .fn(async t => {
    const { contextType, copySize } = t.params;
    const canvas = t.getOffscreenCanvas(1, 1);

    const dstTexture = t.device.createTexture({
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      format: 'bgra8unorm',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    canvas.getContext(contextType);

    t.runTest(
      { source: canvas },
      { texture: dstTexture },
      copySize,
      true, // No validation errors.
      isValidContextType(contextType) ? '' : 'OperationError'
    );
  });

g.test('source_image,crossOrigin')
  .desc(
    `
  Test contents of source image is [clean, cross-origin].

  Load crossOrigin image or same origin image and init the source
  images.
  
  Check whether 'SecurityError' is generated when source image is not origin clean.
  `
  )
  .params(u =>
    u //
      .combine('sourceImage', ['canvas', 'offscreenCanvas', 'imageBitmap'])
      .combine('isOriginClean', [true, false])
      .beginSubcases()
      .combine('copySize', [
        { width: 0, height: 0, depthOrArrayLayers: 0 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      ])
  )
  .fn(async t => {
    const { sourceImage, isOriginClean, copySize } = t.params;

    const crossOriginUrl = 'https://get.webgl.org/conformance-resources/opengl_logo.jpg';
    const originCleanUrl = '../out/resources/Di-3d.png';

    const img = document.createElement('img');
    img.src = isOriginClean ? originCleanUrl : crossOriginUrl;
    try {
      await awaitOrTimeout(img.decode());
    } catch (e) {
      t.skip('Cannot load image');
    }

    const canvas =
      sourceImage === 'offscreenCanvas'
        ? t.getOffscreenCanvas(1, 1)
        : document.createElement('canvas');

    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      t.skip('Cannot get 2d context');
    } else {
      ctx.drawImage(img, 0, 0);
    }

    let externalImage: HTMLCanvasElement | OffscreenCanvas | ImageBitmap = canvas;
    if (sourceImage === 'imageBitmap') {
      externalImage = await createImageBitmap(canvas);
    }

    const dstTexture = t.device.createTexture({
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      format: 'bgra8unorm',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    t.runTest(
      { source: externalImage },
      { texture: dstTexture },
      copySize,
      true, // No validation errors.
      isOriginClean ? '' : 'SecurityError'
    );
  });

g.test('source_imageBitmap,state')
  .desc(
    `
  Test ImageBitmap as source image in state [valid, closed].

  Call imageBitmap.close() to transfer the imageBitmap into
  'closed' state.
  
  Check whether 'InvalidStateError' is generated when ImageBitmap is
  closed.
  `
  )
  .params(u =>
    u //
      .combine('closed', [false, true])
      .beginSubcases()
      .combine('copySize', [
        { width: 0, height: 0, depthOrArrayLayers: 0 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      ])
  )
  .fn(async t => {
    const { closed, copySize } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));
    const dstTexture = t.device.createTexture({
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      format: 'bgra8unorm',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    if (closed) imageBitmap.close();

    t.runTest(
      { source: imageBitmap },
      { texture: dstTexture },
      copySize,
      true, // No validation errors.
      closed ? 'InvalidStateError' : ''
    );
  });

g.test('source_offscreenCanvas,state')
  .desc(
    `
  Test OffscreenCanvas as source image in state [valid, detached].

  Transfer OffsreenCanvas to worker will detach the OffscreenCanvas
  in main thread.
  
  Check whether 'InvalidStateError' is generated when OffscreenCanvas is
  detached.
  `
  )
  .params(u =>
    u //
      .combine('detached', [false, true])
      .beginSubcases()
      .combine('copySize', [
        { width: 0, height: 0, depthOrArrayLayers: 0 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      ])
  )
  .fn(async t => {
    const { detached, copySize } = t.params;
    const offscreenCanvas = t.getOffscreenCanvas(1, 1);
    const dstTexture = t.device.createTexture({
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      format: 'bgra8unorm',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    if (detached) {
      const workerCode =
        "self.onmessage = function(e) {e.data.canvas.getContext('2d'); poseMessage('get 2d context');};";
      const blob = new Blob([workerCode], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);
      worker.postMessage({ canvas: offscreenCanvas }, [offscreenCanvas]);
      worker.onmessage = function (e) {
        t.runTest(
          { source: offscreenCanvas },
          { texture: dstTexture },
          copySize,
          true, // No validation errors.
          'InvalidStateError'
        );
      };
    } else {
      offscreenCanvas.getContext('2d');
      t.runTest(
        { source: offscreenCanvas },
        { texture: dstTexture },
        copySize,
        true // No validation errors.
      );
    }
  });

g.test('destination_texture,state')
  .desc(
    `
  Test dst texture is [valid, invalid, destroyed].
  
  Check that an error is generated when texture is an error texture.
  Check that an error is generated when texture is in destroyed state.
  `
  )
  .params(u =>
    u //
      .combine('state', ['valid', 'invalid', 'destroyed'] as const)
      .beginSubcases()
      .combine('copySize', [
        { width: 0, height: 0, depthOrArrayLayers: 0 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      ])
  )
  .fn(async t => {
    const { state, copySize } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));
    const dstTexture = t.createTextureWithState(state);

    t.runTest({ source: imageBitmap }, { texture: dstTexture }, copySize, state === 'valid');
  });

g.test('destination_texture,dimension')
  .desc(
    `
  Test dst texture dimension is [1d, 2d, 3d].

  Check that an error is generated when texture is not '2d' dimension.
  `
  )
  .params(u =>
    u //
      .combine('dimension', ['1d', '2d', '3d'] as const)
      .beginSubcases()
      .combine('copySize', [
        { width: 0, height: 0, depthOrArrayLayers: 0 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      ])
  )
  .fn(async t => {
    const { dimension, copySize } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));
    const dstTexture = t.device.createTexture({
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      dimension,
    });

    t.runTest({ source: imageBitmap }, { texture: dstTexture }, copySize, dimension === '2d');
  });

g.test('destination_texture,usage')
  .desc(
    `
  Test dst texture usages

  Check that an error is generated when texture is created witout usage COPY_DST | RENDER_ATTACHMENT.
  `
  )
  .params(u =>
    u //
      .combine('usage', kTextureUsages)
      .beginSubcases()
      .combine('copySize', [
        { width: 0, height: 0, depthOrArrayLayers: 0 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      ])
  )
  .fn(async t => {
    const { usage, copySize } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));
    const dstTexture = t.device.createTexture({
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      format: 'rgba8unorm',
      usage,
    });

    t.runTest(
      { source: imageBitmap },
      { texture: dstTexture },
      copySize,
      !!(usage & GPUTextureUsage.COPY_DST && usage & GPUTextureUsage.RENDER_ATTACHMENT)
    );
  });

g.test('destination_texture,sample_count')
  .desc(
    `
  Test dst texture sample count.

  Check that an error is generated when sample count it not 1.
  `
  )
  .params(u =>
    u //
      .combine('sampleCount', [1, 4])
      .beginSubcases()
      .combine('copySize', [
        { width: 0, height: 0, depthOrArrayLayers: 0 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      ])
  )
  .fn(async t => {
    const { sampleCount, copySize } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));
    const dstTexture = t.device.createTexture({
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      sampleCount,
      format: 'bgra8unorm',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    t.runTest({ source: imageBitmap }, { texture: dstTexture }, copySize, sampleCount === 1);
  });

g.test('destination_texture,mipLevel')
  .desc(
    `
  Test dst mipLevel.

  Check that an error is generated when mipLevel is too large.
  `
  )
  .params(u =>
    u //
      .combine('mipLevel', [0, kDefaultMipLevelCount - 1, kDefaultMipLevelCount])
      .beginSubcases()
      .combine('copySize', [
        { width: 0, height: 0, depthOrArrayLayers: 0 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      ])
  )
  .fn(async t => {
    const { mipLevel, copySize } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));
    const dstTexture = t.device.createTexture({
      size: { width: kDefaultWidth, height: kDefaultHeight, depthOrArrayLayers: kDefaultDepth },
      mipLevelCount: kDefaultMipLevelCount,
      format: 'bgra8unorm',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    t.runTest(
      { source: imageBitmap },
      { texture: dstTexture, mipLevel },
      copySize,
      mipLevel < kDefaultMipLevelCount
    );
  });

g.test('destination_texture,format')
  .desc(
    `
  Test dst texture format.

  Check that an error is generated when texture format is not valid.
  `
  )
  .params(u =>
    u
      .combine('format', kTextureFormats)
      .beginSubcases()
      .combine('copySize', [
        { width: 0, height: 0, depthOrArrayLayers: 0 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      ])
  )
  .fn(async t => {
    const { format, copySize } = t.params;
    await t.selectDeviceOrSkipTestCase(kTextureFormatInfo[format].feature);

    const imageBitmap = await createImageBitmap(t.getImageData(1, 1));

    // createTexture with all possible texture format may have validation error when using
    // compressed texture format.
    t.device.pushErrorScope('validation');
    const dstTexture = t.device.createTexture({
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      format,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    t.device.popErrorScope();

    const success = (kValidTextureFormatsForCopyE2T as readonly string[]).includes(format);

    t.runTest({ source: imageBitmap }, { texture: dstTexture }, copySize, success);
  });

g.test('OOB,source')
  .desc(
    `
  Test source image origin and copy size

  Check that an error is generated when source.externalImage.origin + copySize is too large.
  `
  )
  .paramsSubcasesOnly(u =>
    u
      .combine('srcOrigin', [
        { x: 0, y: 0 }, // origin is on top-left
        { x: kDefaultWidth - 1, y: 0 }, // x near the border
        { x: 0, y: kDefaultHeight - 1 }, // y is near the border
        { x: kDefaultWidth, y: kDefaultHeight }, // origin is on bottom-right
        { x: kDefaultWidth + 1, y: 0 }, // x is too large
        { x: 0, y: kDefaultHeight + 1 }, // y is too large
      ])
      .expand('copySize', generateCopySizeForSrcOOB)
  )
  .fn(async t => {
    const { srcOrigin, copySize } = t.params;
    const imageBitmap = await createImageBitmap(t.getImageData(kDefaultWidth, kDefaultHeight));
    const dstTexture = t.device.createTexture({
      size: {
        width: kDefaultWidth + 1,
        height: kDefaultHeight + 1,
        depthOrArrayLayers: kDefaultDepth,
      },
      mipLevelCount: kDefaultMipLevelCount,
      format: 'bgra8unorm',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    let success = true;

    if (
      srcOrigin.x + copySize.width > kDefaultWidth ||
      srcOrigin.y + copySize.height > kDefaultHeight ||
      copySize.depthOrArrayLayers > 1
    ) {
      success = false;
    }

    t.runTest(
      { source: imageBitmap, origin: srcOrigin },
      { texture: dstTexture },
      copySize,
      true,
      success ? '' : 'OperationError'
    );
  });

g.test('OOB,destination')
  .desc(
    `
  Test dst texture copy origin and copy size

  Check that an error is generated when destination.texture.origin + copySize is too large.
  Check that 'OperationError' is generated when copySize.depth is larger than 1.
  `
  )
  .paramsSubcasesOnly(u =>
    u
      .combine('mipLevel', [0, 1, kDefaultMipLevelCount - 2])
      .expand('dstOrigin', generateDstOriginValue)
      .expand('copySize', generateCopySizeForDstOOB)
  )
  .fn(async t => {
    const { mipLevel, dstOrigin, copySize } = t.params;

    const imageBitmap = await createImageBitmap(
      t.getImageData(kDefaultWidth + 1, kDefaultHeight + 1)
    );
    const dstTexture = t.device.createTexture({
      size: {
        width: kDefaultWidth,
        height: kDefaultHeight,
        depthOrArrayLayers: kDefaultDepth,
      },
      format: 'bgra8unorm',
      mipLevelCount: kDefaultMipLevelCount,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    let success = true;
    let hasOperationError = false;
    const dstMipMapSize = computeMipMapSize(kDefaultWidth, kDefaultHeight, mipLevel);

    if (
      copySize.depthOrArrayLayers > 1 ||
      dstOrigin.x + copySize.width > dstMipMapSize.mipWidth ||
      dstOrigin.y + copySize.height > dstMipMapSize.mipHeight ||
      dstOrigin.z + copySize.depthOrArrayLayers > kDefaultDepth
    ) {
      success = false;
    }
    if (copySize.depthOrArrayLayers > 1) {
      hasOperationError = true;
    }

    t.runTest(
      { source: imageBitmap },
      {
        texture: dstTexture,
        mipLevel,
        origin: dstOrigin,
      },
      copySize,
      success,
      hasOperationError ? 'OperationError' : ''
    );
  });
