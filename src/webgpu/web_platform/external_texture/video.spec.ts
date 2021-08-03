export const description = `
Tests for external textures from HTMLVideoElement (and other video-type sources?).

- videos with various encodings, color spaces, metadata

TODO: consider whether external_texture and copyToTexture video tests should be in the same file

Test Coverage:
  - Tests that we can import an HTMLVideoElement into a GPUExternalTexture, sample from it for all
  supported video formats {vp8, vp9, ogg, mp4}, and ensure the GPUExternalTexture is destroyed by
  a microtask. 
    TODO: Multiplanar scenarios
    TODO: Pull microtask destruction into its own test
  - Tests that we can import an HTMLVideoElement into a GPUExternalTexture and use it in a compute 
  shader
    TODO: Change this test to instead load texture data into a storage texture.
`;

import { getResourcePath } from '../../../common/framework/resources.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import { GPUTest } from '../../gpu_test.js';
import { startPlayingAndWaitForVideo } from '../../web_platform/util.js';

const kHeight = 16;
const kWidth = 16;
const kFormat = 'rgba8unorm';
const kVideoSources: string[] = [
  'red-green.webmvp8.webm',
  'red-green.bt601.vp9.webm',
  'red-green.mp4',
  'red-green.theora.ogv',
];

export const g = makeTestGroup(GPUTest);

g.test('importExternalTexture,sample')
  .desc(
    `
Test that importing different video formats into an external texture and sampling from them works correctly.
`
  )
  .params(u =>
    u //
      .combine('videoSource', kVideoSources)
  )
  .fn(async t => {
    const videoUrl = getResourcePath(t.params.videoSource);
    const video = document.createElement('video');
    video.src = videoUrl;

    await startPlayingAndWaitForVideo(video, () => {
      const colorAttachment = t.device.createTexture({
        format: kFormat,
        size: { width: kWidth, height: kHeight, depthOrArrayLayers: 1 },
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
      });

      const pipeline = t.device.createRenderPipeline({
        vertex: {
          module: t.device.createShaderModule({
            code: `
              [[stage(vertex)]] fn main([[builtin(vertex_index)]] VertexIndex : u32) -> [[builtin(position)]] vec4<f32> {
                  var pos = array<vec4<f32>, 6>(
                    vec4<f32>( 1.0,  1.0, 0.0, 1.0),
                    vec4<f32>( 1.0, -1.0, 0.0, 1.0),
                    vec4<f32>(-1.0, -1.0, 0.0, 1.0),
                    vec4<f32>( 1.0,  1.0, 0.0, 1.0),
                    vec4<f32>(-1.0, -1.0, 0.0, 1.0),
                    vec4<f32>(-1.0,  1.0, 0.0, 1.0)
                  );
                  return pos[VertexIndex];
              }
              `,
          }),
          entryPoint: 'main',
        },
        fragment: {
          module: t.device.createShaderModule({
            code: `
              [[group(0), binding(0)]] var s : sampler;
              [[group(0), binding(1)]] var t : texture_external;

              [[stage(fragment)]] fn main([[builtin(position)]] FragCoord : vec4<f32>)
                                       -> [[location(0)]] vec4<f32> {
                  return textureSampleLevel(t, s, FragCoord.xy / vec2<f32>(16.0, 16.0));
              }
              `,
          }),
          entryPoint: 'main',
          targets: [
            {
              format: kFormat,
            },
          ],
        },
        primitive: { topology: 'triangle-list' },
      });

      const linearSampler = t.device.createSampler();

      const externalTextureDescriptor = { source: video };
      const externalTexture = t.device.importExternalTexture(externalTextureDescriptor);

      const bindGroup = t.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: linearSampler,
          },
          {
            binding: 1,
            resource: externalTexture,
          },
        ],
      });
      const commandEncoder = t.device.createCommandEncoder();
      const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: colorAttachment.createView(),
            loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
            storeOp: 'store',
          },
        ],
      });
      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.draw(6);
      passEncoder.endPass();
      t.device.queue.submit([commandEncoder.finish()]);

      // Top left corner should be red. Sample a few pixels away from the edges to avoid compression
      // artifacts.
      t.expectSinglePixelIn2DTexture(
        colorAttachment,
        kFormat,
        { x: 2, y: 2 },
        {
          exp: new Uint8Array([0xff, 0x00, 0x00, 0xff]),
        }
      );

      // Bottom right corner should be green. Sample a few pixels away from the edges to avoid
      // compression artifacts.
      t.expectSinglePixelIn2DTexture(
        colorAttachment,
        kFormat,
        { x: kWidth - 3, y: kHeight - 3 },
        {
          exp: new Uint8Array([0x00, 0xff, 0x00, 0xff]),
        }
      );

      // This function submits the same render pass as above, but should result in an error because the
      // GPUExternalTexture will be destroyed via microtask upon requestAnimationFrame.
      const ensureDestroyed = function () {
        const commandEncoder2 = t.device.createCommandEncoder();
        const passEncoder2 = commandEncoder2.beginRenderPass({
          colorAttachments: [
            {
              view: colorAttachment.createView(),
              loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
              storeOp: 'store',
            },
          ],
        });
        passEncoder2.setPipeline(pipeline);
        passEncoder2.setBindGroup(0, bindGroup);
        passEncoder2.draw(6);
        passEncoder2.endPass();

        t.expectGPUError('validation', () => t.device.queue.submit([commandEncoder2.finish()]));
      };

      requestAnimationFrame(ensureDestroyed);
    });
  });

g.test('importExternalTexture,compute')
  .desc(
    `
Tests that we can import an HTMLVideoElement into a GPUExternalTexture and use it in a compute shader.
`
  )
  .fn(async t => {
    const videoUrl = getResourcePath('red-green.webmvp8.webm');
    const video = document.createElement('video');
    video.src = videoUrl;

    await startPlayingAndWaitForVideo(video, () => {
      const externalTextureDescriptor = { source: video };
      const externalTexture = t.device.importExternalTexture(externalTextureDescriptor);

      const result = t.device.createBuffer({
        size: 8,
        usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE,
      });

      const pipeline = t.device.createComputePipeline({
        compute: {
          module: t.device.createShaderModule({
            code: `
              [[block]] struct Data {
                  height : i32;
                  width : i32;
              };
    
              [[group(0), binding(0)]] var t : texture_external;
              [[group(0), binding(1)]] var<storage, read_write> dst : Data;
    
              [[stage(compute), workgroup_size(1)]] fn main() {
                var dims : vec2<i32> = textureDimensions(t);
                dst.width = dims.x;
                dst.height = dims.y;
                return;
              }
            `,
          }),
          entryPoint: 'main',
        },
      });

      const bg = t.device.createBindGroup({
        entries: [
          { binding: 0, resource: externalTexture },
          { binding: 1, resource: { buffer: result, offset: 0, size: 8 } },
        ],
        layout: pipeline.getBindGroupLayout(0),
      });

      const encoder = t.device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bg);
      pass.dispatch(1);
      pass.endPass();
      t.device.queue.submit([encoder.finish()]);

      // Check that video dimension are returned correctly as 128x80
      const resultData = new Uint32Array([128, 80]);
      t.expectGPUBufferValuesEqual(result, resultData);
    });
  });
