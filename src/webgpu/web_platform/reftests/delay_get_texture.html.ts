import { timeout } from '../../../common/util/timeout.js';
import { takeScreenshotDelayed } from '../../../common/util/wpt_reftest_wait.js';

function assert(condition: boolean, msg?: string | (() => string)): asserts condition {
  if (!condition) {
    throw new Error(msg && (typeof msg === 'string' ? msg : msg()));
  }
}

(async () => {
  assert(
    typeof navigator !== 'undefined' && navigator.gpu !== undefined,
    'No WebGPU implementation found'
  );

  const adapter = await navigator.gpu.requestAdapter();
  assert(adapter !== null);
  const device = await adapter.requestDevice();
  assert(device !== null);

  const canvas = document.getElementById('cvs0') as HTMLCanvasElement;
  const ctx = canvas.getContext('webgpu') as unknown as GPUCanvasContext;
  ctx.configure({
    device,
    format: navigator.gpu.getPreferredCanvasFormat(),
    alphaMode: 'premultiplied',
  });

  timeout(() => {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: ctx.getCurrentTexture().createView(),
          clearValue: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.end();
    device.queue.submit([encoder.finish()]);

    takeScreenshotDelayed(50);
  }, 100);
})();
