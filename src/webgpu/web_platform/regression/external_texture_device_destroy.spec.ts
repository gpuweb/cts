export const description = `
Test GPUExternalTexture with device.destroy.

There is a bug in some implementations where creating an external texture
and then destroying a device causes crashes.
`;

import { Fixture, SubcaseBatchState } from '../../../common/framework/fixture.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import { getGPU } from '../../../common/util/navigator_gpu.js';
import { assert, resolveOnTimeout } from '../../../common/util/util.js';
import { getVideoElement, startPlayingAndWaitForVideo } from '../util.js';

export const g = makeTestGroup(Fixture);

async function getDevice(t: Fixture<SubcaseBatchState>) {
  const gpu = getGPU(t.rec);

  const adapter = await gpu.requestAdapter();
  assert(!!adapter);

  return t.requestDeviceTracked(adapter);
}

g.test('destroy_after_external_texture')
  .desc(
    `Regression test for bug in Chromium where destroying a device after creating an extenal texture caused a crash.`
  )
  .params(u => u.combine('source', ['video', 'videoframe']))
  .fn(async t => {
    const device1 = await getDevice(t);
    const device2 = await getDevice(t);

    // 1. Get a playing <video> with a decoded frame
    const video = getVideoElement(t, 'four-colors-vp9-bt601.webm');
    await startPlayingAndWaitForVideo(video, async () => {
      // 2. Import the external texture and reference it in a submitted pass
      //    so Dawn sets mLastSharedTextureMemoryUsageSerial != 0 (usedDuringAccess = true).
      const source = t.params.source === 'video' ? video : new VideoFrame(video);
      const externalTexture = device1.importExternalTexture({ source });
      const bgl = device1.createBindGroupLayout({
        entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, externalTexture: {} }],
      });
      const bg = device1.createBindGroup({
        layout: bgl,
        entries: [{ binding: 0, resource: externalTexture }],
      });
      const colorTarget = t.trackForCleanup(
        device1.createTexture({
          size: [1, 1],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        })
      );
      const encoder = device1.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: colorTarget, loadOp: 'clear', storeOp: 'store' }],
      });
      pass.setBindGroup(0, bg);
      pass.end();
      device1.queue.submit([encoder.finish()]);

      await Promise.race([
        // If the bug exists then the code below will kill the GPU process causing
        // device2, unrelated to device1, to also be lost.
        device2.lost.then(e => {
          throw new Error(e.message);
        }),
        (async () => {
          // 3. Destroy the device:
          //    - ExternalTextureCache::Destroy() defers mailbox dissociation to OnSubmittedWorkDone
          //    - GetHandle().Destroy() destroys the wgpu::Device on the GPU process first
          device1.destroy();

          // 4. Wait a turn for OnSubmittedWorkDone to drop WebGPUMailboxTexture (queuing
          //    DissociateMailbox), then flush the WebGPU command buffer.
          await resolveOnTimeout(0);

          // Flushes DissociateMailbox -> GPU process CHECK crash!
          device1.queue.submit([]);

          // Give it time to lose the contexts.
          await resolveOnTimeout(1000);
        })(),
      ]);

      if (source instanceof VideoFrame) {
        source.close();
      }
    });

    device2.destroy();
  });
