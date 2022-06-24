import { assert, unreachable } from '../../../common/util/util.js';
import { kTextureFormatInfo } from '../../capability_info.js';
import { align } from '../../util/math.js';

import { runRefTest } from './gpu_ref_test.js';
import {
  useAsImageSource2dDrawImage,
  useAsImageSourceToDataURL,
  useAsImageSourceToBlob,
  useAsImageSourceCreateImageBitmap,
  useAsImageSourceWebGLTexImage2D,
  useAsImageSourceWebGLTexSubImage2D,
} from './ref/canvas_use_as_image_source_utils.html.js';

const alphaValue = 0x66;

export function run(
  alphaMode: GPUCanvasAlphaMode,
  src: HTMLCanvasElement,
  dst_draw_image: HTMLCanvasElement,
  dst_data_url: HTMLCanvasElement,
  dst_blob: HTMLCanvasElement,
  dst_create_image_bitmap: HTMLCanvasElement,
  dst_tex_image_2d: HTMLCanvasElement,
  dst_tex_sub_image_2d: HTMLCanvasElement
) {
  runRefTest(async t => {
    const ctx = src.getContext('webgpu');
    assert(ctx !== null, 'Failed to get WebGPU context from canvas');

    const format = 'bgra8unorm';
    ctx.configure({
      device: t.device,
      format,
      usage: GPUTextureUsage.COPY_DST,
      alphaMode,
    });

    // Write to src canvas
    const rows = ctx.canvas.height;
    const bytesPerPixel = kTextureFormatInfo[format].bytesPerBlock;
    if (bytesPerPixel === undefined) {
      unreachable();
    }
    const bytesPerRow = align(bytesPerPixel * ctx.canvas.width, 256);
    const componentsPerPixel = 4;

    const buffer = t.device.createBuffer({
      mappedAtCreation: true,
      size: rows * bytesPerRow,
      usage: GPUBufferUsage.COPY_SRC,
    });

    const mapping = buffer.getMappedRange();
    const data = new Uint8Array(mapping);
    const red = new Uint8Array([0x00, 0x00, 0x66, alphaValue]);
    const green = new Uint8Array([0x00, 0x66, 0x00, alphaValue]);
    const blue = new Uint8Array([0x66, 0x00, 0x00, alphaValue]);
    const yellow = new Uint8Array([0x00, 0x66, 0x66, alphaValue]);

    for (let i = 0; i < ctx.canvas.width; ++i) {
      for (let j = 0; j < ctx.canvas.height; ++j) {
        let pixel: Uint8Array | Uint16Array;
        if (i < ctx.canvas.width / 2) {
          if (j < ctx.canvas.height / 2) {
            pixel = red;
          } else {
            pixel = blue;
          }
        } else {
          if (j < ctx.canvas.height / 2) {
            pixel = green;
          } else {
            pixel = yellow;
          }
        }
        data.set(pixel, (i + j * (bytesPerRow / bytesPerPixel)) * componentsPerPixel);
      }
    }
    buffer.unmap();

    const encoder = t.device.createCommandEncoder();
    encoder.copyBufferToTexture({ buffer, bytesPerRow }, { texture: ctx.getCurrentTexture() }, [
      ctx.canvas.width,
      ctx.canvas.height,
      1,
    ]);
    t.device.queue.submit([encoder.finish()]);

    // Read src canvas as image source and copy to dst canvas
    useAsImageSource2dDrawImage(src, dst_draw_image);
    useAsImageSourceToDataURL(src, dst_data_url);
    useAsImageSourceToBlob(src, dst_blob);
    useAsImageSourceCreateImageBitmap(src, dst_create_image_bitmap);
    useAsImageSourceWebGLTexImage2D(src, dst_tex_image_2d);
    useAsImageSourceWebGLTexSubImage2D(src, dst_tex_sub_image_2d);
  });
}
