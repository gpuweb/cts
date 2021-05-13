export const description = `
copyToTexture with HTMLCanvasElement and OffscreenCanvas sources.

- x= {HTMLCanvasElement, OffscreenCanvas}
- x= {2d, webgl, webgl2, gpupresent, bitmaprenderer} context, {various context creation attributes}

TODO: consider whether external_texture and copyToTexture video tests should be in the same file
TODO: plan
`;

import { makeTestGroup } from '../../../common/framework/test_group.js';
import { unreachable } from '../../../common/util/util.js';
import {
  RegularTextureFormat,
  kTextureFormatInfo,
  kValidTextureFormatsForCopyIB2T,
} from '../../capability_info.js';
import { GPUTest } from '../../gpu_test.js';
import { kTexelRepresentationInfo } from '../../util/texture/texel_data.js';

function calculateRowPitch(width: number, bytesPerPixel: number): number {
  const bytesPerRow = width * bytesPerPixel;
  // Rounds up to a multiple of 256 according to WebGPU requirements.
  return (((bytesPerRow - 1) >> 8) + 1) << 8;
}

class F extends GPUTest {
  checkCopyExternalImageResult(
    src: GPUBuffer,
    expected: ArrayBufferView,
    width: number,
    height: number,
    bytesPerPixel: number
  ): void {
    const exp = new Uint8Array(expected.buffer, expected.byteOffset, expected.byteLength);
    const rowPitch = calculateRowPitch(width, bytesPerPixel);
    const dst = this.createCopyForMapRead(src, 0, rowPitch * height);

    this.eventualAsyncExpectation(async niceStack => {
      await dst.mapAsync(GPUMapMode.READ);
      const actual = new Uint8Array(dst.getMappedRange());
      const check = this.checkBufferWithRowPitch(
        actual,
        exp,
        width,
        height,
        rowPitch,
        bytesPerPixel
      );
      if (check !== undefined) {
        niceStack.message = check;
        this.rec.expectationFailed(niceStack);
      }
      dst.destroy();
    });
  }

  checkBufferWithRowPitch(
    actual: Uint8Array,
    exp: Uint8Array,
    width: number,
    height: number,
    rowPitch: number,
    bytesPerPixel: number
  ): string | undefined {
    const failedByteIndices: string[] = [];
    const failedByteExpectedValues: string[] = [];
    const failedByteActualValues: string[] = [];
    iLoop: for (let i = 0; i < height; ++i) {
      const bytesPerRow = width * bytesPerPixel;
      for (let j = 0; j < bytesPerRow; ++j) {
        const indexExp = j + i * bytesPerRow;
        const indexActual = j + rowPitch * i;
        if (actual[indexActual] !== exp[indexExp]) {
          if (failedByteIndices.length >= 4) {
            failedByteIndices.push('...');
            failedByteExpectedValues.push('...');
            failedByteActualValues.push('...');
            break iLoop;
          }
          failedByteIndices.push(`(${i},${j})`);
          failedByteExpectedValues.push(exp[indexExp].toString());
          failedByteActualValues.push(actual[indexActual].toString());
        }
      }
    }
    if (failedByteIndices.length > 0) {
      return `at [${failedByteIndices.join(', ')}], \
expected [${failedByteExpectedValues.join(', ')}], \
got [${failedByteActualValues.join(', ')}]`;
    }
    return undefined;
  }

  doTestAndCheckResult(
    imageCopyExternalImage: GPUImageCopyExternalImage,
    dstTextureCopyView: GPUImageCopyTexture,
    copySize: GPUExtent3DDict,
    bytesPerPixel: number,
    expectedData: Uint8ClampedArray
  ): void {
    this.device.queue.copyExternalImageToTexture(
      imageCopyExternalImage,
      dstTextureCopyView,
      copySize
    );

    const externalImage = imageCopyExternalImage.source;
    const dstTexture = dstTextureCopyView.texture;

    const bytesPerRow = calculateRowPitch(externalImage.width, bytesPerPixel);
    const testBuffer = this.device.createBuffer({
      size: bytesPerRow * externalImage.height,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    const encoder = this.device.createCommandEncoder();

    encoder.copyTextureToBuffer(
      { texture: dstTexture, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
      { buffer: testBuffer, bytesPerRow },
      { width: externalImage.width, height: externalImage.height, depthOrArrayLayers: 1 }
    );
    this.device.queue.submit([encoder.finish()]);

    this.checkCopyExternalImageResult(
      testBuffer,
      expectedData,
      externalImage.width,
      externalImage.height,
      bytesPerPixel
    );
  }

  initCanvasContent({
    canvasType,
    contextName,
    width,
    height
  }: {
    canvasType: 'onscreen' | 'offscreen';
    contextName: '2d' | 'webgl' | 'webgl2';
    width: number;
    height: number;
  }) : {canvas: HTMLCanvasElement | OffscreenCanvas, 
         canvasContext : WebGLRenderingContext
         | WebGL2RenderingContext
         | CanvasRenderingContext2D
         | OffscreenCanvasRenderingContext2D} {
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
            | OffscreenCanvasRenderingContext2D;
    if (canvasContext === null) {
      this.skip(canvasType + ' canvas context not available');
    }
      
    const contextType: '2d' | 'gl' = contextName === '2d' ? '2d' : 'gl';

    const rectWidth = Math.floor(width / 2);
    const rectHeight = Math.floor(height / 2);
    if (contextType === '2d') {
      const ctx = canvasContext as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
      ctx.fillStyle = 'red'; // #ff0000
      ctx.fillRect(0, 0, rectWidth, rectHeight);
      ctx.fillStyle = 'lime'; // #00ff00
      ctx.fillRect(rectWidth, 0, width - rectWidth, rectHeight);
      ctx.fillStyle = 'blue'; // #0000ff
      ctx.fillRect(0, rectHeight, rectWidth, height - rectHeight);
      ctx.fillStyle = 'black'; // #000000
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

    return {canvas: canvas, canvasContext: canvasContext};
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
    let originPixels;
    if (contextType === '2d') {
      const ctx = context as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
      originPixels = ctx.getImageData(0, 0, width, height).data;
    } else if (contextType === 'gl') {
      originPixels = new Uint8ClampedArray(width * height * 4);
      const gl = context as WebGLRenderingContext | WebGL2RenderingContext;
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, originPixels);
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
              R: originPixels[pixelPos * 4] / divide,
              G: originPixels[pixelPos * 4 + 1] / divide,
              B: originPixels[pixelPos * 4 + 2] / divide,
              A: originPixels[pixelPos * 4 + 3] / divide,
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

g.test('copy_from_2d_HTMLCanvasElement')
  .desc(
    `
  Test 2d context HTMLCanvasElment and OffscreenCanvas
  can be copied to WebGPU texture correctly.
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

    const {canvas, canvasContext} = t.initCanvasContent({
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
    const dstBytesPerPixel = kTextureFormatInfo[dstColorFormat].bytesPerBlock!;
    const expectedPixels = t.getExpectedPixels({
      context: canvasContext,
      width,
      height,
      format: dstColorFormat,
      contextType: contextName == '2d' ? '2d' : 'gl',
    });

    t.doTestAndCheckResult(
      { source: canvas, origin: { x: 0, y: 0 } },
      { texture: dst },
      { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
      dstBytesPerPixel,
      expectedPixels
    );
  });
