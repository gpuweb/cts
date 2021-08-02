import { assert } from '../../../common/util/util.js';

import { runRefTest } from './gpu_ref_test.js';

// <canvas> element from html page
declare const cvs_larger_than_back_buffer: HTMLCanvasElement;
declare const cvs_same_as_back_buffer: HTMLCanvasElement;
declare const cvs_smaller_than_back_buffer: HTMLCanvasElement;

export function run() {
  runRefTest(async t => {
    const red = new Uint8Array([0x00, 0x00, 0xff, 0xff]);
    const green = new Uint8Array([0x00, 0xff, 0x00, 0xff]);
    const blue = new Uint8Array([0xff, 0x00, 0x00, 0xff]);
    const yellow = new Uint8Array([0x00, 0xff, 0xff, 0xff]);

    {
      const ctx = cvs_larger_than_back_buffer.getContext('gpupresent');
      assert(ctx !== null);
      const width = cvs_larger_than_back_buffer.width / 2;
      const height = cvs_larger_than_back_buffer.height / 2;
      ctx.configure({
        device: t.device,
        format: 'bgra8unorm',
        usage: GPUTextureUsage.COPY_DST,
        size: [width, height, 1], // half of the canvas width and height.
      });

      const rows = height;
      const bytesPerRow = 256;
      const buffer = t.device.createBuffer({
        mappedAtCreation: true,
        size: rows * bytesPerRow,
        usage: GPUBufferUsage.COPY_SRC,
      });
      const mapping = buffer.getMappedRange();
      const data = new Uint8Array(mapping);
      // 1st row
      data.set(red, 0);
      data.set(red, 4);
      data.set(green, 8);

      // 2nd row
      data.set(red, 256 + 0);
      data.set(red, 256 + 4);
      data.set(green, 256 + 8);

      // 3rd row
      data.set(blue, 256 * 2 + 0);
      data.set(blue, 256 * 2 + 4);
      data.set(yellow, 256 * 2 + 8);

      // 4th row
      data.set(blue, 256 * 3 + 0);
      data.set(blue, 256 * 3 + 4);
      data.set(yellow, 256 * 3 + 8);
      buffer.unmap();

      const texture = ctx.getCurrentTexture();

      const encoder = t.device.createCommandEncoder();
      encoder.copyBufferToTexture({ buffer, bytesPerRow }, { texture }, [width, height, 1]);
      t.device.queue.submit([encoder.finish()]);
      await t.device.queue.onSubmittedWorkDone();
    }

    {
      const ctx = cvs_same_as_back_buffer.getContext('gpupresent');
      assert(ctx !== null);
      ctx.configure({
        device: t.device,
        format: 'bgra8unorm',
        usage: GPUTextureUsage.COPY_DST,
      });

      const rows = cvs_same_as_back_buffer.height;
      const bytesPerRow = 256;
      const buffer = t.device.createBuffer({
        mappedAtCreation: true,
        size: rows * bytesPerRow,
        usage: GPUBufferUsage.COPY_SRC,
      });
      const mapping = buffer.getMappedRange();
      const data = new Uint8Array(mapping);
      // 1st row
      data.set(red, 0); // red
      data.set(red, 4); // red
      data.set(green, 8); // green

      // 2nd row
      data.set(red, 256 + 0); // red
      data.set(red, 256 + 4); // red
      data.set(green, 256 + 8); // blue

      // 3rd row
      data.set(blue, 256 * 2 + 0); // blue
      data.set(blue, 256 * 2 + 4); // blue
      data.set(yellow, 256 * 2 + 8); // red

      // 4th row
      data.set(blue, 256 * 3 + 0); // blue
      data.set(blue, 256 * 3 + 4); // blue
      data.set(yellow, 256 * 3 + 8); // yellow
      buffer.unmap();

      const texture = ctx.getCurrentTexture();

      const encoder = t.device.createCommandEncoder();
      encoder.copyBufferToTexture({ buffer, bytesPerRow }, { texture }, [3, 4, 1]);
      t.device.queue.submit([encoder.finish()]);
      await t.device.queue.onSubmittedWorkDone();
    }

    {
      const ctx = cvs_smaller_than_back_buffer.getContext('gpupresent');
      assert(ctx !== null);
      const width = cvs_smaller_than_back_buffer.width * 2;
      const height = cvs_smaller_than_back_buffer.height * 2;
      ctx.configure({
        device: t.device,
        format: 'bgra8unorm',
        usage: GPUTextureUsage.COPY_DST,
        size: [width, height, 1], // double size of the canvas width and height.
      });

      const rows = height;
      const bytesPerRow = 256;
      const buffer = t.device.createBuffer({
        mappedAtCreation: true,
        size: rows * bytesPerRow,
        usage: GPUBufferUsage.COPY_SRC,
      });
      const mapping = buffer.getMappedRange();
      const data = new Uint8Array(mapping);
      // 1st row
      data.set(red, 0); // red
      data.set(red, 4); // red
      data.set(red, 8); // red
      data.set(red, 12); // red
      data.set(green, 16); // green
      data.set(green, 20); // green

      // 2nd row
      data.set(red, 256 + 0); // red
      data.set(red, 256 + 4); // red
      data.set(red, 256 + 8); // red
      data.set(red, 256 + 12); // red
      data.set(green, 256 + 16); // green
      data.set(green, 256 + 20); // green

      // 3rd row
      data.set(red, 256 * 2 + 0); // red
      data.set(red, 256 * 2 + 4); // red
      data.set(red, 256 * 2 + 8); // red
      data.set(red, 256 * 2 + 12); // red
      data.set(green, 256 * 2 + 16); // blue
      data.set(green, 256 * 2 + 20); // blue

      // 4th row
      data.set(red, 256 * 3 + 0); // red
      data.set(red, 256 * 3 + 4); // red
      data.set(red, 256 * 3 + 8); // red
      data.set(red, 256 * 3 + 12); // red
      data.set(green, 256 * 3 + 16); // blue
      data.set(green, 256 * 3 + 20); // blue

      // 5th row
      data.set(blue, 256 * 4 + 0); // blue
      data.set(blue, 256 * 4 + 4); // blue
      data.set(blue, 256 * 4 + 8); // blue
      data.set(blue, 256 * 4 + 12); // blue
      data.set(yellow, 256 * 4 + 16); // red
      data.set(yellow, 256 * 4 + 20); // red

      // 6th row
      data.set(blue, 256 * 5 + 0); // blue
      data.set(blue, 256 * 5 + 4); // blue
      data.set(blue, 256 * 5 + 8); // blue
      data.set(blue, 256 * 5 + 12); // blue
      data.set(yellow, 256 * 5 + 16); // red
      data.set(yellow, 256 * 5 + 20); // red

      // 7th row
      data.set(blue, 256 * 6 + 0); // blue
      data.set(blue, 256 * 6 + 4); // blue
      data.set(blue, 256 * 6 + 8); // blue
      data.set(blue, 256 * 6 + 12); // blue
      data.set(yellow, 256 * 6 + 16); // yellow
      data.set(yellow, 256 * 6 + 20); // yellow

      // 8th row
      data.set(blue, 256 * 7 + 0); // blue
      data.set(blue, 256 * 7 + 4); // blue
      data.set(blue, 256 * 7 + 8); // blue
      data.set(blue, 256 * 7 + 12); // blue
      data.set(yellow, 256 * 7 + 16); // yellow
      data.set(yellow, 256 * 7 + 20); // yellow
      buffer.unmap();

      const texture = ctx.getCurrentTexture();

      const encoder = t.device.createCommandEncoder();
      encoder.copyBufferToTexture({ buffer, bytesPerRow }, { texture }, [6, 8, 1]);
      t.device.queue.submit([encoder.finish()]);
      await t.device.queue.onSubmittedWorkDone();
    }
  });
}
