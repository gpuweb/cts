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
      unconfigureBeforeLost,
      reconfigureAfterLost,
      drawAfterLost,
    }: {
      unconfigureBeforeLost: boolean;
      reconfigureAfterLost: boolean;
      drawAfterLost: boolean;
    }
  ) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const ctx = canvas.getContext('webgpu') as unknown as GPUCanvasContext;
    if (!deviceLost || reconfigureAfterLost) {
      ctx.configure({ device, format: presentationFormat, alphaMode });
    }

    if (!deviceLost || drawAfterLost) {
      let threw;
      try {
        const colorAttachment = ctx.getCurrentTexture();
        threw = false;
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
      } catch (ex) {
        threw = true;
      }

      // If this assert fails, takeScreenshotDelayed will never be called, and the test will time out .
      assert(
        threw === (deviceLost && unconfigureBeforeLost && !reconfigureAfterLost),
        'getCurrentTexture() should throw iff the canvas is unconfigured'
      );
    }

    if (!deviceLost && unconfigureBeforeLost) {
      ctx.unconfigure();
    }
  }

  function drawAll() {
    /* prettier-ignore */
    {
      draw('cvs00', 'opaque',        { unconfigureBeforeLost: false, reconfigureAfterLost: false, drawAfterLost: false });
      draw('cvs01', 'opaque',        { unconfigureBeforeLost: false, reconfigureAfterLost: false, drawAfterLost:  true });
      draw('cvs02', 'premultiplied', { unconfigureBeforeLost: false, reconfigureAfterLost: false, drawAfterLost: false });
      draw('cvs03', 'premultiplied', { unconfigureBeforeLost: false, reconfigureAfterLost: false, drawAfterLost:  true });

      draw('cvs10', 'opaque',        { unconfigureBeforeLost: false, reconfigureAfterLost:  true, drawAfterLost: false });
      draw('cvs11', 'opaque',        { unconfigureBeforeLost: false, reconfigureAfterLost:  true, drawAfterLost:  true });
      draw('cvs12', 'premultiplied', { unconfigureBeforeLost: false, reconfigureAfterLost:  true, drawAfterLost: false });
      draw('cvs13', 'premultiplied', { unconfigureBeforeLost: false, reconfigureAfterLost:  true, drawAfterLost:  true });

      draw('cvs20', 'opaque',        { unconfigureBeforeLost:  true, reconfigureAfterLost: false, drawAfterLost: false });
      draw('cvs21', 'opaque',        { unconfigureBeforeLost:  true, reconfigureAfterLost: false, drawAfterLost:  true });
      draw('cvs22', 'premultiplied', { unconfigureBeforeLost:  true, reconfigureAfterLost: false, drawAfterLost: false });
      draw('cvs23', 'premultiplied', { unconfigureBeforeLost:  true, reconfigureAfterLost: false, drawAfterLost:  true });

      draw('cvs30', 'opaque',        { unconfigureBeforeLost:  true, reconfigureAfterLost:  true, drawAfterLost: false });
      draw('cvs31', 'opaque',        { unconfigureBeforeLost:  true, reconfigureAfterLost:  true, drawAfterLost:  true });
      draw('cvs32', 'premultiplied', { unconfigureBeforeLost:  true, reconfigureAfterLost:  true, drawAfterLost: false });
      draw('cvs33', 'premultiplied', { unconfigureBeforeLost:  true, reconfigureAfterLost:  true, drawAfterLost:  true });
    }

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
