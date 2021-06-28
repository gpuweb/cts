export const description = `
copyToTexture with HTMLCanvasElement and OffscreenCanvas sources.

TODO: consider whether external_texture and copyToTexture video tests should be in the same file
`;

import { makeTestGroup } from '../../../common/framework/test_group.js';
import { unreachable } from '../../../common/util/util.js';
import {
  RegularTextureFormat,
  kTextureFormatInfo,
  kValidTextureFormatsForCopyIB2T,
} from '../../capability_info.js';
import { CopyToTextureUtils } from '../../util/copyToTexture.js';
import { kTexelRepresentationInfo } from '../../util/texture/texel_data.js';

class F extends CopyToTextureUtils {
  createCanvas(
    canvasType: 'onscreen' | 'offscreen',
    width: number,
    height: number
  ): HTMLCanvasElement | OffscreenCanvas | null {
    let canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
    if (canvasType === 'onscreen') {
      if (typeof document !== 'undefined') {
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
      } else {
        this.skip('Cannot create HTMLCanvasElement');
      }
    } else if (canvasType === 'offscreen') {
      if (typeof OffscreenCanvas === 'undefined') {
        this.skip('OffscreenCanvas is not supported');
      }
      canvas = new OffscreenCanvas(width, height);
    } else {
      unreachable();
    }

    return canvas;
  }

  init2DCanvasContent({
    canvasType,
    width,
    height,
    isLosePrecisionDstFormat,
  }: {
    canvasType: 'onscreen' | 'offscreen';
    width: number;
    height: number;
    isLosePrecisionDstFormat: boolean;
  }): {
    canvas: HTMLCanvasElement | OffscreenCanvas;
    canvasContext: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  } {
    const canvas = this.createCanvas(canvasType, width, height);
    if (canvas === null) {
      this.skip('Cannot create canvas');
    }

    let canvasContext = null;
    canvasContext = canvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;

    if (canvasContext === null) {
      this.skip(canvasType + ' canvas context not available');
    }

    const rectWidth = Math.floor(width / 2);
    const rectHeight = Math.floor(height / 2);

    // The rgb10a2unorm dst texture will have tiny errors when we compare actual and expectation.
    // This is due to the convert from 8-bit to 10-bit combined with alpha value ops. So for
    // rgb10a2unorm dst textures, we'll set alphaValue to 1.0 to test.
    const alphaValue = isLosePrecisionDstFormat ? 1.0 : 0.6;
    const ctx = canvasContext as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    // Red
    ctx.fillStyle = 'rgba(255, 0, 0,' + alphaValue + ')';
    ctx.fillRect(0, 0, rectWidth, rectHeight);
    // Lime
    ctx.fillStyle = 'rgba(0, 255, 0,' + alphaValue + ')';
    ctx.fillRect(rectWidth, 0, width - rectWidth, rectHeight);
    // Blue
    ctx.fillStyle = 'rgba(0, 0, 255,' + alphaValue + ')';
    ctx.fillRect(0, rectHeight, rectWidth, height - rectHeight);
    // Black
    if (isLosePrecisionDstFormat) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.0)';
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0,' + alphaValue + ')';
    }
    ctx.fillRect(rectWidth, rectHeight, width - rectWidth, height - rectHeight);

    return { canvas, canvasContext };
  }

  initGLCanvasContent({
    canvasType,
    contextName,
    width,
    height,
    premultiplied,
    isLosePrecisionDstFormat,
  }: {
    canvasType: 'onscreen' | 'offscreen';
    contextName: 'webgl' | 'webgl2';
    width: number;
    height: number;
    premultiplied: boolean;
    isLosePrecisionDstFormat: boolean;
  }): {
    canvas: HTMLCanvasElement | OffscreenCanvas;
    canvasContext: WebGLRenderingContext | WebGL2RenderingContext;
  } {
    const canvas = this.createCanvas(canvasType, width, height);
    if (canvas === null) {
      this.skip('Cannot create canvas');
    }

    let canvasContext = null;
    canvasContext = canvas.getContext(contextName, { premultipliedAlpha: premultiplied }) as
      | WebGLRenderingContext
      | WebGL2RenderingContext
      | null;

    if (canvasContext === null) {
      this.skip(canvasType + ' canvas context not available');
    }

    const rectWidth = Math.floor(width / 2);
    const rectHeight = Math.floor(height / 2);

    const gl = canvasContext as WebGLRenderingContext | WebGL2RenderingContext;

    // The rgb10a2unorm dst texture will have tiny errors when we compare actual and expectation.
    // This is due to the convert from 8-bit to 10-bit combined with alpha value ops. So for
    // rgb10a2unorm dst textures, we'll set alphaValue to 0.0 to test.
    const alphaValue = isLosePrecisionDstFormat ? 1.0 : 0.6;

    // For webgl/webgl2 context canvas, if the context created with premultipliedAlpha attributes,
    // it means that the value in drawing buffer is premultiplied or not. So we should set
    // premultipliedAlpha value for premultipliedAlpha true gl context and unpremultipliedAlpha value
    // for the premulitpliedAlpha false gl context.
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, 0, rectWidth, rectHeight);
    premultiplied
      ? gl.clearColor(alphaValue, 0.0, 0.0, alphaValue)
      : gl.clearColor(1.0, 0.0, 0.0, alphaValue);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.scissor(rectWidth, 0, width - rectWidth, rectHeight);
    premultiplied
      ? gl.clearColor(0.0, alphaValue, 0.0, alphaValue)
      : gl.clearColor(0.0, 1.0, 0.0, alphaValue);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.scissor(0, rectHeight, rectWidth, height - rectHeight);
    premultiplied
      ? gl.clearColor(0.0, 0.0, alphaValue, alphaValue)
      : gl.clearColor(0.0, 0.0, 1.0, alphaValue);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.scissor(rectWidth, rectHeight, width - rectWidth, height - rectHeight);
    premultiplied
      ? gl.clearColor(alphaValue, alphaValue, alphaValue, alphaValue)
      : gl.clearColor(1.0, 1.0, 1.0, alphaValue);
    gl.clear(gl.COLOR_BUFFER_BIT);

    return { canvas, canvasContext };
  }

  getExpectedPixels({
    context,
    width,
    height,
    format,
    contextType,
    srcPremultiplied,
    dstPremultiplied,
  }: {
    context:
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | WebGLRenderingContext
      | WebGL2RenderingContext;
    width: number;
    height: number;
    format: RegularTextureFormat;
    contextType: '2d' | 'gl';
    srcPremultiplied: boolean;
    dstPremultiplied: boolean;
  }): Uint8ClampedArray {
    const bytesPerPixel = kTextureFormatInfo[format].bytesPerBlock;

    const expectedPixels = new Uint8ClampedArray(bytesPerPixel * width * height);
    let sourcePixels;
    if (contextType === '2d') {
      const ctx = context as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
      sourcePixels = ctx.getImageData(0, 0, width, height).data;
    } else if (contextType === 'gl') {
      sourcePixels = new Uint8ClampedArray(width * height * 4);
      const gl = context as WebGLRenderingContext | WebGL2RenderingContext;
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, sourcePixels);
    } else {
      unreachable();
    }

    // Generate expectedPixels
    // Use getImageData and readPixels to get canvas contents.
    const rep = kTexelRepresentationInfo[format];
    const divide = 255.0;
    let rgba: { R: number; G: number; B: number; A: number };
    for (let i = 0; i < height; ++i) {
      for (let j = 0; j < width; ++j) {
        const pixelPos = i * width + j;

        rgba = {
          R: sourcePixels[pixelPos * 4] / divide,
          G: sourcePixels[pixelPos * 4 + 1] / divide,
          B: sourcePixels[pixelPos * 4 + 2] / divide,
          A: sourcePixels[pixelPos * 4 + 3] / divide,
        };

        if (!srcPremultiplied) {
          if (dstPremultiplied) {
            rgba.R *= rgba.A;
            rgba.G *= rgba.A;
            rgba.B *= rgba.A;
          }
        }

        if (srcPremultiplied && !dstPremultiplied) {
          if (rgba.A !== 0) {
            rgba.R /= rgba.A;
            rgba.G /= rgba.A;
            rgba.B /= rgba.A;
          }
        }

        const pixelData = new Uint8Array(
          rep.pack(
            rep.encode({
              R: rgba.R,
              G: rgba.G,
              B: rgba.B,
              A: rgba.A,
            })
          )
        );
        expectedPixels.set(pixelData, pixelPos * bytesPerPixel);
      }
    }

    return expectedPixels;
  }
}

export const g = makeTestGroup(F);

g.test('copy_contents_from_2d_context_canvas')
  .desc(
    `
  Test HTMLCanvasElement and OffscreenCanvas with 2d context
  can be copied to WebGPU texture correctly.

  It creates HTMLCanvasElement/OffscreenCanvas with '2d'.
  Use fillRect(2d context) or stencil + clear (gl context) to rendering
  red rect for top-left, green rect for top-right, blue rect for bottom-left
  and black for bottom-right.
  Then call copyExternalImageToTexture() to do a full copy to the 0 mipLevel
  of dst texture, and read the contents out to compare with the canvas contents.

  The tests covers:
  - Valid canvas type
  - Valid 2d context type
  - TODO: color space tests need to be added

  And the expected results are all passed.
  `
  )
  .params(u =>
    u
      .combine('canvasType', ['onscreen', 'offscreen'] as const)
      .combine('dstColorFormat', kValidTextureFormatsForCopyIB2T)
      .combine('premultipliedAlpha', [true, false])
      .beginSubcases()
      .combine('width', [1, 2, 4, 15, 255, 256])
      .combine('height', [1, 2, 4, 15, 255, 256])
  )
  .fn(async t => {
    const { width, height, canvasType, dstColorFormat, premultipliedAlpha } = t.params;

    // The rgb10a2unorm dst texture will have tiny errors when we compare actual and expectation.
    // This is due to the convert from 8-bit to 10-bit combined with alpha value ops. So for
    // rgb10a2unorm dst textures, we'll set alphaValue to 0.0 to test.
    const { canvas, canvasContext } = t.init2DCanvasContent({
      canvasType,
      width,
      height,
      isLosePrecisionDstFormat: dstColorFormat === 'rgb10a2unorm',
    });

    const dst = t.device.createTexture({
      size: {
        width,
        height,
        depthOrArrayLayers: 1,
      },
      format: dstColorFormat,
      usage:
        GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // Construct expected value for different dst color format
    const dstBytesPerPixel = kTextureFormatInfo[dstColorFormat].bytesPerBlock;
    const format: RegularTextureFormat =
      dstColorFormat === 'rgba8unorm-srgb' || dstColorFormat === 'bgra8unorm-srgb'
        ? dstColorFormat === 'rgba8unorm-srgb'
          ? 'rgba8unorm'
          : 'bgra8unorm'
        : dstColorFormat;
    dstColorFormat;

    // For 2d canvas, get expected pixels with getImageData(), which returns origin
    // values(not applied premultipy alpha) always.
    const expectedPixels = t.getExpectedPixels({
      context: canvasContext,
      width,
      height,
      format,
      contextType: '2d',
      srcPremultiplied: false,
      dstPremultiplied: premultipliedAlpha,
    });

    t.doTestAndCheckResult(
      { source: canvas, origin: { x: 0, y: 0 } },
      {
        texture: dst,
        origin: { x: 0, y: 0 },
        colorSpace: 'srgb',
        premultipliedAlpha,
      },
      { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
      dstBytesPerPixel,
      expectedPixels
    );
  });

g.test('copy_contents_from_gl_context_canvas')
  .desc(
    `
  Test HTMLCanvasElement and OffscreenCanvas with webgl/webgl2 context
  can be copied to WebGPU texture correctly.

  It creates HTMLCanvasElement/OffscreenCanvas with webgl'/'webgl2'.
  Use fillRect(2d context) or stencil + clear (gl context) to rendering
  red rect for top-left, green rect for top-right, blue rect for bottom-left
  and black for bottom-right.
  Then call copyExternalImageToTexture() to do a full copy to the 0 mipLevel
  of dst texture, and read the contents out to compare with the canvas contents.

  The tests covers:
  - Valid canvas type
  - Valid webgl/webgl2 context type
  - TODO: color space tests need to be added

  And the expected results are all passed.
  `
  )
  .params(u =>
    u
      .combine('canvasType', ['onscreen', 'offscreen'] as const)
      .combine('contextName', ['webgl', 'webgl2'] as const)
      .combine('dstColorFormat', kValidTextureFormatsForCopyIB2T)
      .combine('webglCanvasPremultipliedAlpha', [true, false])
      .combine('premultipliedAlpha', [true, false])
      .beginSubcases()
      .combine('width', [1, 2, 4, 15, 255, 256])
      .combine('height', [1, 2, 4, 15, 255, 256])
  )
  .fn(async t => {
    const {
      width,
      height,
      canvasType,
      contextName,
      dstColorFormat,
      webglCanvasPremultipliedAlpha,
      premultipliedAlpha,
    } = t.params;

    const { canvas, canvasContext } = t.initGLCanvasContent({
      canvasType,
      contextName,
      width,
      height,
      premultiplied: webglCanvasPremultipliedAlpha,
      isLosePrecisionDstFormat: dstColorFormat === 'rgb10a2unorm',
    });

    const dst = t.device.createTexture({
      size: {
        width,
        height,
        depthOrArrayLayers: 1,
      },
      format: dstColorFormat,
      usage:
        GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // Construct expected value for different dst color format
    const dstBytesPerPixel = kTextureFormatInfo[dstColorFormat].bytesPerBlock;
    const format: RegularTextureFormat =
      dstColorFormat === 'rgba8unorm-srgb' || dstColorFormat === 'bgra8unorm-srgb'
        ? dstColorFormat === 'rgba8unorm-srgb'
          ? 'rgba8unorm'
          : 'bgra8unorm'
        : dstColorFormat;
    dstColorFormat;

    const expectedPixels = t.getExpectedPixels({
      context: canvasContext,
      width,
      height,
      format,
      contextType: 'gl',
      srcPremultiplied: webglCanvasPremultipliedAlpha,
      dstPremultiplied: premultipliedAlpha,
    });

    t.doTestAndCheckResult(
      { source: canvas, origin: { x: 0, y: 0 } },
      {
        texture: dst,
        origin: { x: 0, y: 0 },
        colorSpace: 'srgb',
        premultipliedAlpha,
      },
      { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
      dstBytesPerPixel,
      expectedPixels
    );
  });
