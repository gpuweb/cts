import { timeout } from '../../../common/util/timeout.js';
import { assert } from '../../../common/util/util.js';
import { takeScreenshotDelayed } from '../../../common/util/wpt_reftest_wait.js';

void (async () => {
  assert(
    typeof navigator !== 'undefined' && navigator.gpu !== undefined,
    'No WebGPU implementation found'
  );

  const adapter = await navigator.gpu.requestAdapter();
  assert(adapter !== null);
  const device = await adapter.requestDevice();
  assert(device !== null);
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  let deviceLost = false;

  function draw(
    canvasId: string,
    alphaMode: GPUCanvasAlphaMode,
    {
      reconfigureAfterLost,
      drawAfterLost,
    }: { reconfigureAfterLost: boolean; drawAfterLost: boolean }
  ) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const ctx = canvas.getContext('webgpu') as unknown as GPUCanvasContext;
    if (!deviceLost || reconfigureAfterLost) {
      ctx.configure({ device, format: presentationFormat, alphaMode });
    }

    if (!deviceLost || drawAfterLost) {
      const colorAttachment = ctx.getCurrentTexture();
      const colorAttachmentView = colorAttachment.createView();

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: colorAttachmentView,
            clearValue: { r: 0.4, g: 1.0, b: 0.0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      pass.end();
      device.queue.submit([encoder.finish()]);
    }
  }

  function drawAll() {
    draw('cvs00', 'opaque', { reconfigureAfterLost: false, drawAfterLost: false });
    draw('cvs01', 'opaque', { reconfigureAfterLost: false, drawAfterLost: true });
    draw('cvs02', 'premultiplied', { reconfigureAfterLost: false, drawAfterLost: false });
    draw('cvs03', 'premultiplied', { reconfigureAfterLost: false, drawAfterLost: true });

    draw('cvs10', 'opaque', { reconfigureAfterLost: true, drawAfterLost: false });
    draw('cvs11', 'opaque', { reconfigureAfterLost: true, drawAfterLost: true });
    draw('cvs12', 'premultiplied', { reconfigureAfterLost: true, drawAfterLost: false });
    draw('cvs13', 'premultiplied', { reconfigureAfterLost: true, drawAfterLost: true });

    if (!deviceLost) {
      device.destroy();
      deviceLost = true;
      timeout(drawAll, 100);
    } else {
      takeScreenshotDelayed(50);
    }
  }

  drawAll();
})();
