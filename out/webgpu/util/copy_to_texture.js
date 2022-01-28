/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/import { assert, memcpy } from '../../common/util/util.js';import { kTextureFormatInfo } from '../capability_info.js';import { GPUTest } from '../gpu_test.js';

import { checkElementsEqual, checkElementsBetween } from './check_contents.js';
import { align } from './math.js';
import { kBytesPerRowAlignment } from './texture/layout.js';
import { kTexelRepresentationInfo } from './texture/texel_data.js';

export function isFp16Format(format) {
  switch (format) {
    case 'r16float':
    case 'rg16float':
    case 'rgba16float':
      return true;
    default:
      return false;}

}

export class CopyToTextureUtils extends GPUTest {
  doFlipY(
  sourcePixels,
  width,
  height,
  bytesPerPixel)
  {
    const dstPixels = new Uint8ClampedArray(width * height * bytesPerPixel);
    for (let i = 0; i < height; ++i) {
      for (let j = 0; j < width; ++j) {
        const srcPixelPos = i * width + j;
        // WebGL readPixel returns pixels from bottom-left origin. Using CopyExternalImageToTexture
        // to copy from WebGL Canvas keeps top-left origin. So the expectation from webgl.readPixel should
        // be flipped.
        const dstPixelPos = (height - i - 1) * width + j;

        memcpy(
        { src: sourcePixels, start: srcPixelPos * bytesPerPixel, length: bytesPerPixel },
        { dst: dstPixels, start: dstPixelPos * bytesPerPixel });

      }
    }

    return dstPixels;
  }

  /**
     * If the destination format specifies a transfer function,
     * copyExternalImageToTexture (like B2T/T2T copies) should ignore it.
     */
  formatForExpectedPixels(format) {
    return format === 'rgba8unorm-srgb' ?
    'rgba8unorm' :
    format === 'bgra8unorm-srgb' ?
    'bgra8unorm' :
    format;
  }

  getSourceImageBitmapPixels(
  sourcePixels,
  width,
  height,
  isPremultiplied,
  isFlipY)
  {
    return this.getExpectedPixels(
    sourcePixels,
    width,
    height,
    'rgba8unorm',
    false,
    isPremultiplied,
    isFlipY);

  }

  getExpectedPixels(
  sourcePixels,
  width,
  height,
  format,
  srcPremultiplied,
  dstPremultiplied,
  isFlipY)
  {
    const bytesPerPixel = kTextureFormatInfo[format].bytesPerBlock;

    const orientedPixels = isFlipY ? this.doFlipY(sourcePixels, width, height, 4) : sourcePixels;
    const expectedPixels = new Uint8ClampedArray(bytesPerPixel * width * height);

    // Generate expectedPixels
    // Use getImageData and readPixels to get canvas contents.
    const rep = kTexelRepresentationInfo[format];
    const divide = 255.0;
    let rgba;
    for (let i = 0; i < height; ++i) {
      for (let j = 0; j < width; ++j) {
        const pixelPos = i * width + j;

        rgba = {
          R: orientedPixels[pixelPos * 4] / divide,
          G: orientedPixels[pixelPos * 4 + 1] / divide,
          B: orientedPixels[pixelPos * 4 + 2] / divide,
          A: orientedPixels[pixelPos * 4 + 3] / divide };


        if (!srcPremultiplied && dstPremultiplied) {
          rgba.R *= rgba.A;
          rgba.G *= rgba.A;
          rgba.B *= rgba.A;
        }

        if (srcPremultiplied && !dstPremultiplied) {
          assert(rgba.A !== 0.0);
          rgba.R /= rgba.A;
          rgba.G /= rgba.A;
          rgba.B /= rgba.A;
        }

        memcpy(
        { src: rep.pack(rep.encode(rgba)) },
        { dst: expectedPixels, start: pixelPos * bytesPerPixel });

      }
    }

    return expectedPixels;
  }

  // MAINTENANCE_TODO(crbug.com/dawn/868): Should be possible to consolidate this along with texture checking
  checkCopyExternalImageResult(
  src,
  expected,
  width,
  height,
  bytesPerPixel,
  isFp16)
  {
    const exp = new Uint8Array(expected.buffer, expected.byteOffset, expected.byteLength);
    const rowPitch = align(width * bytesPerPixel, kBytesPerRowAlignment);

    const readbackPromise = this.readGPUBufferRangeTyped(src, {
      type: Uint8Array,
      typedLength: rowPitch * height });


    this.eventualAsyncExpectation(async niceStack => {
      const readback = await readbackPromise;
      const check = this.checkBufferWithRowPitch(
      readback.data,
      exp,
      width,
      height,
      rowPitch,
      bytesPerPixel,
      isFp16);

      if (check !== undefined) {
        niceStack.message = check;
        this.rec.expectationFailed(niceStack);
      }
      readback.cleanup();
    });
  }

  // MAINTENANCE_TODO(crbug.com/dawn/868): Should be possible to consolidate this along with texture checking
  checkBufferWithRowPitch(
  actual,
  exp,
  width,
  height,
  rowPitch,
  bytesPerPixel,
  isFp16)
  {
    const bytesPerRow = width * bytesPerPixel;
    // When dst format is fp16 formats, the expectation and real result always has 1 bit difference in the ending
    // (e.g. CC vs CD) if there needs some alpha ops (if alpha channel is not 0.0 or 1.0). Suspect it is errors when
    // doing encoding. We check fp16 dst texture format with 1-bit ULP tolerance.
    if (isFp16) {
      for (let y = 0; y < height; ++y) {
        const expRow = exp.subarray(y * bytesPerRow, bytesPerRow);
        const checkResult = checkElementsBetween(actual.subarray(y * rowPitch, bytesPerRow), [
        i => expRow[i] > 0 ? expRow[i] - 1 : expRow[i],
        i => expRow[i] + 1]);

        if (checkResult !== undefined) return `on row ${y}: ${checkResult}`;
      }
    } else {
      for (let y = 0; y < height; ++y) {
        const checkResult = checkElementsEqual(
        actual.subarray(y * rowPitch, bytesPerRow),
        exp.subarray(y * bytesPerRow, bytesPerRow));

        if (checkResult !== undefined) return `on row ${y}: ${checkResult}`;
      }
    }
    return undefined;
  }

  doTestAndCheckResult(
  imageCopyExternalImage,
  dstTextureCopyView,
  copySize,
  bytesPerPixel,
  expectedData,
  isFp16)
  {
    this.device.queue.copyExternalImageToTexture(
    imageCopyExternalImage,
    dstTextureCopyView,
    copySize);


    const externalImage = imageCopyExternalImage.source;
    const dstTexture = dstTextureCopyView.texture;

    const bytesPerRow = align(externalImage.width * bytesPerPixel, kBytesPerRowAlignment);
    const testBuffer = this.device.createBuffer({
      size: bytesPerRow * externalImage.height,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });

    this.trackForCleanup(testBuffer);

    const encoder = this.device.createCommandEncoder();

    encoder.copyTextureToBuffer(
    { texture: dstTexture, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
    { buffer: testBuffer, bytesPerRow },
    { width: externalImage.width, height: externalImage.height, depthOrArrayLayers: 1 });

    this.device.queue.submit([encoder.finish()]);

    this.checkCopyExternalImageResult(
    testBuffer,
    expectedData,
    externalImage.width,
    externalImage.height,
    bytesPerPixel,
    isFp16);

  }}
//# sourceMappingURL=copy_to_texture.js.map