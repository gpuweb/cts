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
  initCanvasContent({
    canvasType,
    contextName,
    width,
    height,
  }: {
    canvasType: 'onscreen' | 'offscreen';
    contextName: '2d' | 'webgl' | 'webgl2';
    width: number;
    height: number;
  }): {
    canvas: HTMLCanvasElement | OffscreenCanvas;
    canvasContext:
      | WebGLRenderingContext
      | WebGL2RenderingContext
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D;
  } {
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

    if (canvas === null) {
      this.skip('Cannot create canvas');
    }

    const canvasContext = canvas.getContext(contextName) as
      | WebGLRenderingContext
      | WebGL2RenderingContext
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (canvasContext === null) {
      this.skip(canvasType + ' canvas context not available');
    }

    const contextType: '2d' | 'gl' = contextName === '2d' ? '2d' : 'gl';

    const rectWidth = Math.floor(width / 2);
    const rectHeight = Math.floor(height / 2);
    if (contextType === '2d') {
      const ctx = canvasContext as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
      ctx.fillStyle = '#ff0000'; // red
      ctx.fillRect(0, 0, rectWidth, rectHeight);
      ctx.fillStyle = '#00ff00'; // lime
      ctx.fillRect(rectWidth, 0, width - rectWidth, rectHeight);
      ctx.fillStyle = '#0000ff'; // blue
      ctx.fillRect(0, rectHeight, rectWidth, height - rectHeight);
      ctx.fillStyle = '#000000'; // black
      ctx.fillRect(rectWidth, rectHeight, width - rectWidth, height - rectHeight);
    } else if (contextType === 'gl') {
      const gl = canvasContext as WebGLRenderingContext | WebGL2RenderingContext;
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(0, 0, rectWidth, rectHeight);
      gl.clearColor(1.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.scissor(rectWidth, 0, width - rectWidth, rectHeight);
      gl.clearColor(0.0, 1.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.scissor(0, rectHeight, rectWidth, height - rectHeight);
      gl.clearColor(0.0, 0.0, 1.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.scissor(rectWidth, rectHeight, width - rectWidth, height - rectHeight);
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    return { canvas, canvasContext };
  }

  getExpectedPixels({
    context,
    width,
    height,
    format,
    contextType,
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
    const rep = kTexelRepresentationInfo[format];
    const divide = 255.0;
    for (let i = 0; i < height; ++i) {
      for (let j = 0; j < width; ++j) {
        const pixelPos = i * width + j;
        const pixelData = new Uint8Array(
          rep.pack(
            rep.encode({
              R: sourcePixels[pixelPos * 4] / divide,
              G: sourcePixels[pixelPos * 4 + 1] / divide,
              B: sourcePixels[pixelPos * 4 + 2] / divide,
              A: sourcePixels[pixelPos * 4 + 3] / divide,
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

g.test('copy_contents_from_canvas')
  .desc(
    `
  Test HTMLCanvasElement and OffscreenCanvas with 2d/webgl/webgl2 context
  can be copied to WebGPU texture correctly.

  It creates HTMLCanvasElement/OffscreenCanvas with '2d'/'webgl'/'webgl2'.
  Use fillRect(2d context) or stencil + clear (gl context) to rendering
  red rect for top-left, green rect for top-right, blue rect for bottom-left
  and black for bottom-right.
  Then call copyExternalImageToTexture() to do a full copy to the 0 mipLevel
  of dst texture, and read the contents out to compare with the canvas contents.

  The tests covers:
  - Valid canvas type
  - Valid context type
  - TODO: premultiplied alpha tests need to be added.
  - TODO: color space tests need to be added

  And the expected results are all passed.
  `
  )
  .params(u =>
    u
      .combine('canvasType', ['onscreen', 'offscreen'] as const)
      .combine('contextName', ['2d', 'webgl', 'webgl2'] as const)
      .combine('dstColorFormat', kValidTextureFormatsForCopyIB2T)
      .beginSubcases()
      .combine('width', [1, 2, 4, 15, 255, 256])
      .combine('height', [1, 2, 4, 15, 255, 256])
  )
  .fn(async t => {
    const { width, height, canvasType, contextName, dstColorFormat } = t.params;

    const { canvas, canvasContext } = t.initCanvasContent({
      canvasType,
      contextName,
      width,
      height,
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
    const expectedPixels = t.getExpectedPixels({
      context: canvasContext,
      width,
      height,
      format: dstColorFormat,
      contextType: contextName === '2d' ? '2d' : 'gl',
    });

    t.doTestAndCheckResult(
      { source: canvas, origin: { x: 0, y: 0 } },
      { texture: dst },
      { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
      dstBytesPerPixel,
      expectedPixels
    );
  });
