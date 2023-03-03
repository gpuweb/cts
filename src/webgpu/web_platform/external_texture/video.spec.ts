export const description = `
Tests for external textures from HTMLVideoElement (and other video-type sources?).

- videos with various encodings/formats (webm vp8, webm vp9, ogg theora, mp4), color spaces
  (bt.601, bt.709, bt.2020)
- TODO: enhance with more cases with crop, rotation, etc.

TODO: consider whether external_texture and copyToTexture video tests should be in the same file
`;

import { makeTestGroup } from '../../../common/framework/test_group.js';
import { GPUTest, TextureTestMixin } from '../../gpu_test.js';
import {
  startPlayingAndWaitForVideo,
  getVideoFrameFromVideoElement,
  getVideoElement,
} from '../../web_platform/util.js';

const kHeight = 16;
const kWidth = 16;
const kFormat = 'rgba8unorm';

// The process to calculate these expected pixel values can be found:
// https://github.com/gpuweb/cts/pull/2242#issuecomment-1430382811
const kBt601Red = new Uint8Array([248, 36, 0, 255]);
const kBt601Green = new Uint8Array([64, 252, 0, 255]);
const kBt601Blue = new Uint8Array([26, 35, 255, 255]);
const kBt601Yellow = new Uint8Array([254, 253, 0, 255]);

const kVideoExpectations = [
  {
    videoName: 'four-colors-vp8-bt601.webm',
    _redExpectation: kBt601Red,
    _greenExpectation: kBt601Green,
    _blueExpectation: kBt601Blue,
    _yellowExpectation: kBt601Yellow,
  },
  {
    videoName: 'four-colors-theora-bt601.ogv',
    _redExpectation: kBt601Red,
    _greenExpectation: kBt601Green,
    _blueExpectation: kBt601Blue,
    _yellowExpectation: kBt601Yellow,
  },
  {
    videoName: 'four-colors-h264-bt601.mp4',
    _redExpectation: kBt601Red,
    _greenExpectation: kBt601Green,
    _blueExpectation: kBt601Blue,
    _yellowExpectation: kBt601Yellow,
  },
  {
    videoName: 'four-colors-vp9-bt601.webm',
    _redExpectation: kBt601Red,
    _greenExpectation: kBt601Green,
    _blueExpectation: kBt601Blue,
    _yellowExpectation: kBt601Yellow,
  },
  {
    videoName: 'four-colors-vp9-bt709.webm',
    _redExpectation: new Uint8Array([255, 0, 0, 255]),
    _greenExpectation: new Uint8Array([0, 255, 0, 255]),
    _blueExpectation: new Uint8Array([0, 0, 255, 255]),
    _yellowExpectation: new Uint8Array([255, 255, 0, 255]),
  },
] as const;

const kVideoRotationExpectations = [
  {
    videoName: 'four-colors-h264-bt601-rotate-90.mp4',
    _topLeftExpectation: kBt601Red,
    _topRightExpectation: kBt601Green,
    _bottomLeftExpectation: kBt601Yellow,
    _bottomRightExpectation: kBt601Blue,
  },
  {
    videoName: 'four-colors-h264-bt601-rotate-180.mp4',
    _topLeftExpectation: kBt601Green,
    _topRightExpectation: kBt601Blue,
    _bottomLeftExpectation: kBt601Red,
    _bottomRightExpectation: kBt601Yellow,
  },
  {
    videoName: 'four-colors-h264-bt601-rotate-270.mp4',
    _topLeftExpectation: kBt601Blue,
    _topRightExpectation: kBt601Yellow,
    _bottomLeftExpectation: kBt601Green,
    _bottomRightExpectation: kBt601Red,
  },
] as const;

export const g = makeTestGroup(TextureTestMixin(GPUTest));

function createExternalTextureSamplingTestPipeline(t: GPUTest): GPURenderPipeline {
  const pipeline = t.device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: t.device.createShaderModule({
        code: `
        @vertex fn main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
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
        @group(0) @binding(0) var s : sampler;
        @group(0) @binding(1) var t : texture_external;

        @fragment fn main(@builtin(position) FragCoord : vec4<f32>)
                                 -> @location(0) vec4<f32> {
            return textureSampleBaseClampToEdge(t, s, FragCoord.xy / vec2<f32>(16.0, 16.0));
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

  return pipeline;
}

function createExternalTextureSamplingTestBindGroup(
  t: GPUTest,
  source: HTMLVideoElement | VideoFrame,
  pipeline: GPURenderPipeline
): GPUBindGroup {
  const linearSampler = t.device.createSampler();

  const externalTexture = t.device.importExternalTexture({
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    source: source as any,
  });

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

  return bindGroup;
}

g.test('importExternalTexture,sample')
  .desc(
    `
Tests that we can import an HTMLVideoElement/VideoFrame into a GPUExternalTexture, sample from it
for several combinations of video format and color space.
`
  )
  .params(u =>
    u //
      .combine('sourceType', ['VideoElement', 'VideoFrame'] as const)
      .combineWithParams(kVideoExpectations)
  )
  .fn(async t => {
    const sourceType = t.params.sourceType;
    if (sourceType === 'VideoFrame' && typeof VideoFrame === 'undefined') {
      t.skip('WebCodec is not supported');
    }

    const videoElement = getVideoElement(t, t.params.videoName);

    await startPlayingAndWaitForVideo(videoElement, async () => {
      const source =
        sourceType === 'VideoFrame'
          ? await getVideoFrameFromVideoElement(t, videoElement)
          : videoElement;

      const colorAttachment = t.device.createTexture({
        format: kFormat,
        size: { width: kWidth, height: kHeight, depthOrArrayLayers: 1 },
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
      });

      const pipeline = createExternalTextureSamplingTestPipeline(t);
      const bindGroup = createExternalTextureSamplingTestBindGroup(t, source, pipeline);

      const commandEncoder = t.device.createCommandEncoder();
      const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: colorAttachment.createView(),
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.draw(6);
      passEncoder.end();
      t.device.queue.submit([commandEncoder.finish()]);

      // For validation, we sample a few pixels away from the edges to avoid compression
      // artifacts.
      t.expectSinglePixelComparisonsAreOkInTexture({ texture: colorAttachment }, [
        // Top-left should be yellow.
        { coord: { x: kWidth * 0.25, y: kHeight * 0.25 }, exp: t.params._yellowExpectation },
        // Top-right should be red.
        { coord: { x: kWidth * 0.75, y: kHeight * 0.25 }, exp: t.params._redExpectation },
        // Bottom-left should be blue.
        { coord: { x: kWidth * 0.25, y: kHeight * 0.75 }, exp: t.params._blueExpectation },
        // Bottom-right should be green.
        { coord: { x: kWidth * 0.75, y: kHeight * 0.75 }, exp: t.params._greenExpectation },
      ]);

      if (sourceType === 'VideoFrame') (source as VideoFrame).close();
    });
  });

g.test('importExternalTexture,sampleWithRotationMetadata')
  .desc(
    `
Tests that when importing an HTMLVideoElement/VideoFrame into a GPUExternalTexture, sampling from
it will honor rotation metadata.
`
  )
  .params(u =>
    u //
      .combine('sourceType', ['VideoElement', 'VideoFrame'] as const)
      .combineWithParams(kVideoRotationExpectations)
  )
  .fn(async t => {
    const sourceType = t.params.sourceType;
    const videoElement = getVideoElement(t, t.params.videoName);

    await startPlayingAndWaitForVideo(videoElement, async () => {
      const source =
        sourceType === 'VideoFrame'
          ? await getVideoFrameFromVideoElement(t, videoElement)
          : videoElement;

      const colorAttachment = t.device.createTexture({
        format: kFormat,
        size: { width: kWidth, height: kHeight, depthOrArrayLayers: 1 },
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
      });

      const pipeline = createExternalTextureSamplingTestPipeline(t);
      const bindGroup = createExternalTextureSamplingTestBindGroup(t, source, pipeline);

      const commandEncoder = t.device.createCommandEncoder();
      const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: colorAttachment.createView(),
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.draw(6);
      passEncoder.end();
      t.device.queue.submit([commandEncoder.finish()]);

      // For validation, we sample a few pixels away from the edges to avoid compression
      // artifacts.
      t.expectSinglePixelComparisonsAreOkInTexture({ texture: colorAttachment }, [
        { coord: { x: kWidth * 0.25, y: kHeight * 0.25 }, exp: t.params._topLeftExpectation },
        { coord: { x: kWidth * 0.75, y: kHeight * 0.25 }, exp: t.params._topRightExpectation },
        { coord: { x: kWidth * 0.25, y: kHeight * 0.75 }, exp: t.params._bottomLeftExpectation },
        { coord: { x: kWidth * 0.75, y: kHeight * 0.75 }, exp: t.params._bottomRightExpectation },
      ]);

      if (sourceType === 'VideoFrame') (source as VideoFrame).close();
    });
  });

g.test('importExternalTexture,compute')
  .desc(
    `
Tests that we can import an HTMLVideoElement/VideoFrame into a GPUExternalTexture and use it in a
compute shader, for several combinations of video format and color space.
`
  )
  .params(u =>
    u //
      .combine('sourceType', ['VideoElement', 'VideoFrame'] as const)
      .combineWithParams(kVideoExpectations)
  )
  .fn(async t => {
    const sourceType = t.params.sourceType;
    if (sourceType === 'VideoFrame' && typeof VideoFrame === 'undefined') {
      t.skip('WebCodec is not supported');
    }

    const videoElement = getVideoElement(t, t.params.videoName);

    await startPlayingAndWaitForVideo(videoElement, async () => {
      const source =
        sourceType === 'VideoFrame'
          ? await getVideoFrameFromVideoElement(t, videoElement)
          : videoElement;
      const externalTexture = t.device.importExternalTexture({
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        source: source as any,
      });

      const outputTexture = t.device.createTexture({
        format: 'rgba8unorm',
        size: [2, 2, 1],
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
      });

      const pipeline = t.device.createComputePipeline({
        layout: 'auto',
        compute: {
          // Shader loads 4 pixels near each corner, and then store them in a storage texture.
          module: t.device.createShaderModule({
            code: `
              @group(0) @binding(0) var t : texture_external;
              @group(0) @binding(1) var outImage : texture_storage_2d<rgba8unorm, write>;

              @compute @workgroup_size(1) fn main() {
                var yellow : vec4<f32> = textureLoad(t, vec2<i32>(80, 60));
                textureStore(outImage, vec2<i32>(0, 0), yellow);
                var red : vec4<f32> = textureLoad(t, vec2<i32>(240, 60));
                textureStore(outImage, vec2<i32>(0, 1), red);
                var blue : vec4<f32> = textureLoad(t, vec2<i32>(80, 180));
                textureStore(outImage, vec2<i32>(1, 0), blue);
                var green : vec4<f32> = textureLoad(t, vec2<i32>(240, 180));
                textureStore(outImage, vec2<i32>(1, 1), green);
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
          { binding: 1, resource: outputTexture.createView() },
        ],
        layout: pipeline.getBindGroupLayout(0),
      });

      const encoder = t.device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bg);
      pass.dispatchWorkgroups(1);
      pass.end();
      t.device.queue.submit([encoder.finish()]);

      t.expectSinglePixelComparisonsAreOkInTexture({ texture: outputTexture }, [
        // Top-left should be yellow.
        { coord: { x: 0, y: 0 }, exp: t.params._yellowExpectation },
        // Top-right should be red.
        { coord: { x: 0, y: 1 }, exp: t.params._redExpectation },
        // Bottom-left should be blue.
        { coord: { x: 1, y: 0 }, exp: t.params._blueExpectation },
        // Bottom-right should be green.
        { coord: { x: 1, y: 1 }, exp: t.params._greenExpectation },
      ]);

      if (sourceType === 'VideoFrame') (source as VideoFrame).close();
    });
  });
