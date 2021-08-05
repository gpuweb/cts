import { assert } from '../../../common/util/util.js';

import { runRefTest } from './gpu_ref_test.js';

// <canvas> element from html page
declare const cvs_larger_than_back_buffer: HTMLCanvasElement;
declare const cvs_same_as_back_buffer: HTMLCanvasElement;
declare const cvs_smaller_than_back_buffer: HTMLCanvasElement;
declare const cvs_change_size_after_configure: HTMLCanvasElement;
declare const cvs_change_size_and_reconfigure: HTMLCanvasElement;
declare const cvs_back_buffer_css_different_size: HTMLCanvasElement;

export function run() {
  runRefTest(async t => {
    const red = new Uint8Array([0x00, 0x00, 0xff, 0xff]);
    const green = new Uint8Array([0x00, 0xff, 0x00, 0xff]);
    const blue = new Uint8Array([0xff, 0x00, 0x00, 0xff]);
    const yellow = new Uint8Array([0x00, 0xff, 0xff, 0xff]);
    const pixelBytes = 4;

    function setRowColors(data: Uint8Array, offset: number, colors: Array<Uint8Array>) {
      for (let i = 0; i < colors.length; ++i) {
        data.set(colors[i], offset + i * pixelBytes);
      }
    }

    function updateWebGPUBackBuffer(
      ctx: GPUPresentationContext,
      back_buffer_width: number,
      back_buffer_height: number,
      pixels: Array<Array<Uint8Array>>
    ) {
      ctx.configure({
        device: t.device,
        format: 'bgra8unorm',
        usage: GPUTextureUsage.COPY_DST,
        size: [back_buffer_width, back_buffer_height],
      });

      const rows = pixels.length;
      const bytesPerRow = 256;
      const buffer = t.device.createBuffer({
        mappedAtCreation: true,
        size: rows * bytesPerRow,
        usage: GPUBufferUsage.COPY_SRC,
      });
      const mapping = buffer.getMappedRange();
      const data = new Uint8Array(mapping);

      for (let i = 0; i < pixels.length; ++i) {
        setRowColors(data, bytesPerRow * i, pixels[i]);
      }

      buffer.unmap();
      const texture = ctx.getCurrentTexture();

      const encoder = t.device.createCommandEncoder();
      encoder.copyBufferToTexture({ buffer, bytesPerRow }, { texture }, [
        back_buffer_width,
        back_buffer_height,
        1,
      ]);
      t.device.queue.submit([encoder.finish()]);
    }

    // Test back buffer smaller than canvas size
    {
      const back_buffer_width = cvs_larger_than_back_buffer.width / 2;
      const back_buffer_height = cvs_larger_than_back_buffer.height / 2;
      const ctx = cvs_larger_than_back_buffer.getContext('gpupresent');
      assert(ctx !== null);

      updateWebGPUBackBuffer(ctx, back_buffer_width, back_buffer_height, [
        [red, red, green],
        [red, red, green],
        [blue, blue, yellow],
        [blue, blue, yellow],
      ]);
    }

    // Test back buffer is same as canvas size
    {
      const back_buffer_width = cvs_same_as_back_buffer.width;
      const back_buffer_height = cvs_same_as_back_buffer.height;
      const ctx = cvs_same_as_back_buffer.getContext('gpupresent');
      assert(ctx !== null);

      updateWebGPUBackBuffer(ctx, back_buffer_width, back_buffer_height, [
        [red, red, green],
        [red, red, green],
        [blue, blue, yellow],
        [blue, blue, yellow],
      ]);
    }

    // Test back buffer is larger than canvas size.
    {
      const back_buffer_width = cvs_smaller_than_back_buffer.width * 2;
      const back_buffer_height = cvs_smaller_than_back_buffer.height * 2;
      const ctx = cvs_smaller_than_back_buffer.getContext('gpupresent');
      assert(ctx !== null);

      updateWebGPUBackBuffer(ctx, back_buffer_width, back_buffer_height, [
        [red, red, red, red, green, green],
        [red, red, red, red, green, green],
        [red, red, red, red, green, green],
        [red, red, red, red, green, green],
        [blue, blue, blue, blue, yellow, yellow],
        [blue, blue, blue, blue, yellow, yellow],
        [blue, blue, blue, blue, yellow, yellow],
        [blue, blue, blue, blue, yellow, yellow],
      ]);
    }

    // Test js change canvas size after back buffer has been configured
    {
      const back_buffer_width = cvs_change_size_after_configure.width;
      const back_buffer_height = cvs_change_size_after_configure.height;
      const ctx = cvs_change_size_after_configure.getContext('gpupresent');
      assert(ctx !== null);

      updateWebGPUBackBuffer(ctx, back_buffer_width, back_buffer_height, [
        [red, red, green],
        [red, red, green],
        [blue, blue, yellow],
        [blue, blue, yellow],
      ]);

      cvs_change_size_after_configure.width = 6;
      cvs_change_size_after_configure.height = 8;
    }

    // Test js change canvas size after back buffer has been configured
    // and back buffer configure again.
    {
      let back_buffer_width: number = cvs_change_size_and_reconfigure.width;
      let back_buffer_height: number = cvs_change_size_and_reconfigure.height;
      const ctx = cvs_change_size_and_reconfigure.getContext('gpupresent');
      assert(ctx !== null);

      updateWebGPUBackBuffer(ctx, back_buffer_width, back_buffer_height, [
        [red, red, green],
        [red, red, green],
        [blue, blue, yellow],
        [blue, blue, yellow],
      ]);

      cvs_change_size_and_reconfigure.width = 6;
      cvs_change_size_and_reconfigure.height = 8;

      back_buffer_width = cvs_change_size_and_reconfigure.width;
      back_buffer_height = cvs_change_size_and_reconfigure.height;

      updateWebGPUBackBuffer(ctx, back_buffer_width, back_buffer_height, [
        [red, red, red, red, green, green],
        [red, red, red, red, green, green],
        [red, red, red, red, green, green],
        [red, red, red, red, green, green],
        [blue, blue, blue, blue, yellow, yellow],
        [blue, blue, blue, blue, yellow, yellow],
        [blue, blue, blue, blue, yellow, yellow],
        [blue, blue, blue, blue, yellow, yellow],
      ]);
    }

    // Test canvas size, back buffer size and CSS size are different
    {
      const back_buffer_width = cvs_back_buffer_css_different_size.width / 2;
      const back_buffer_height = cvs_back_buffer_css_different_size.height / 2;
      const ctx = cvs_back_buffer_css_different_size.getContext('gpupresent');
      assert(ctx !== null);

      updateWebGPUBackBuffer(ctx, back_buffer_width, back_buffer_height, [
        [red, red, green],
        [red, red, green],
        [blue, blue, yellow],
        [blue, blue, yellow],
      ]);
    }
  });
}
