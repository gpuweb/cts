/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Tests that the final sample mask is the logical AND of all the relevant masks.
`;import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { assert } from '../../../../common/util/util.js';
import { GPUTest } from '../../../gpu_test.js';
import { makeTextureWithContents } from '../../../util/texture.js';
import { TexelView } from '../../../util/texture/texel_view.js';

const kColors = [
// Red
{ R: 0xff, G: 0, B: 0, A: 0xff },
// Green
{ R: 0, G: 0xff, B: 0, A: 0xff },
// Blue
{ R: 0, G: 0, B: 0xff, A: 0xff },
// Yellow
{ R: 0xff, G: 0xff, B: 0, A: 0xff }];


const kEmptySample = { R: 0, G: 0, B: 0, A: 0 };

// Format of the render target and resolve target
const format = 'rgba8unorm';

class F extends GPUTest {
  async GetResolvedTargetTexture(
  sampleCount,
  rasterizationMask,
  sampleMask,
  fragmentShaderOutputMask)
  {
    // Create a 2x2 color texture to sample from
    // texel 0 - Red
    // texel 1 - Green
    // texel 2 - Blue
    // texel 3 - Yellow
    const kSampleTextureSize = 2;
    const sampleTexture = makeTextureWithContents(
    this.device,
    TexelView.fromTexelsAsBytes(format, (coord) => {
      const id = coord.x + coord.y * kSampleTextureSize;
      return new Uint8Array([kColors[id].R, kColors[id].G, kColors[id].B, kColors[id].A]);
    }),
    {
      size: [kSampleTextureSize, kSampleTextureSize, 1],
      usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT
    });


    const sampler = this.device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest'
    });

    const fragmentMaskUniformBuffer = this.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    this.trackForCleanup(fragmentMaskUniformBuffer);
    this.device.queue.writeBuffer(
    fragmentMaskUniformBuffer,
    0,
    new Uint32Array([fragmentShaderOutputMask]));


    const pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: this.device.createShaderModule({
          code: `
          struct VertexOutput {
            @builtin(position) Position : vec4<f32>,
            @location(0) @interpolate(perspective, sample) fragUV : vec2<f32>,
          }
          
          @vertex
          fn main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
            var pos = array<vec2<f32>, 30>(
                // full screen quad
                vec2<f32>( 1.0,  1.0),
                vec2<f32>( 1.0, -1.0),
                vec2<f32>(-1.0, -1.0),
                vec2<f32>( 1.0,  1.0),
                vec2<f32>(-1.0, -1.0),
                vec2<f32>(-1.0,  1.0),

                // Sub quads are representing rasterization mask and
                // are slightly scaled to avoid covering the pixel center

                // top-left quad
                vec2<f32>( -0.01, 1.0),
                vec2<f32>( -0.01, 0.01),
                vec2<f32>(-1.0, 0.01),
                vec2<f32>( -0.01, 1.0),
                vec2<f32>(-1.0, 0.01),
                vec2<f32>(-1.0, 1.0),

                // top-right quad
                vec2<f32>(1.0, 1.0),
                vec2<f32>(1.0, 0.01),
                vec2<f32>(0.01, 0.01),
                vec2<f32>(1.0, 1.0),
                vec2<f32>(0.01, 0.01),
                vec2<f32>(0.01, 1.0),

                // bottom-left quad
                vec2<f32>( -0.01,  -0.01),
                vec2<f32>( -0.01, -1.0),
                vec2<f32>(-1.0, -1.0),
                vec2<f32>( -0.01,  -0.01),
                vec2<f32>(-1.0, -1.0),
                vec2<f32>(-1.0,  -0.01),

                // bottom-right quad
                vec2<f32>(1.0,  -0.01),
                vec2<f32>(1.0, -1.0),
                vec2<f32>(0.01, -1.0),
                vec2<f32>(1.0,  -0.01),
                vec2<f32>(0.01, -1.0),
                vec2<f32>(0.01,  -0.01)
              );
          
            var uv = array<vec2<f32>, 30>(
                // full screen quad
                vec2<f32>(1.0, 0.0),
                vec2<f32>(1.0, 1.0),
                vec2<f32>(0.0, 1.0),
                vec2<f32>(1.0, 0.0),
                vec2<f32>(0.0, 1.0),
                vec2<f32>(0.0, 0.0),

                // top-left quad (texel 0)
                vec2<f32>(0.5, 0.0),
                vec2<f32>(0.5, 0.5),
                vec2<f32>(0.0, 0.5),
                vec2<f32>(0.5, 0.0),
                vec2<f32>(0.0, 0.5),
                vec2<f32>(0.0, 0.0),

                // top-right quad (texel 1)
                vec2<f32>(1.0, 0.0),
                vec2<f32>(1.0, 0.5),
                vec2<f32>(0.5, 0.5),
                vec2<f32>(1.0, 0.0),
                vec2<f32>(0.5, 0.5),
                vec2<f32>(0.5, 0.0),

                // bottom-left quad (texel 2)
                vec2<f32>(0.5, 0.5),
                vec2<f32>(0.5, 1.0),
                vec2<f32>(0.0, 1.0),
                vec2<f32>(0.5, 0.5),
                vec2<f32>(0.0, 1.0),
                vec2<f32>(0.0, 0.5),

                // bottom-right quad (texel 3)
                vec2<f32>(1.0, 0.5),
                vec2<f32>(1.0, 1.0),
                vec2<f32>(0.5, 1.0),
                vec2<f32>(1.0, 0.5),
                vec2<f32>(0.5, 1.0),
                vec2<f32>(0.5, 0.5)
              );
          
            var output : VertexOutput;
            output.Position = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
            output.fragUV = uv[VertexIndex];
            return output;
          }`
        }),
        entryPoint: 'main'
      },
      fragment: {
        module: this.device.createShaderModule({
          code: `
          @group(0) @binding(0) var mySampler: sampler;
          @group(0) @binding(1) var myTexture: texture_2d<f32>;
          @group(0) @binding(2) var<uniform> fragMask: u32;

          struct FragmentOutput {
            @builtin(sample_mask) mask : u32,
            @location(0) color : vec4<f32>,
          }
          
          @fragment
          fn main(@location(0) @interpolate(perspective, sample) fragUV: vec2<f32>) -> FragmentOutput {
            return FragmentOutput(fragMask, textureSample(myTexture, mySampler, fragUV));
          }`
        }),
        entryPoint: 'main',
        targets: [{ format }]
      },
      primitive: { topology: 'triangle-list' },
      multisample: {
        count: sampleCount,
        mask: sampleMask,
        alphaToCoverageEnabled: false
      }
    });

    const uniformBindGroup = this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
      {
        binding: 0,
        resource: sampler
      },
      {
        binding: 1,
        resource: sampleTexture.createView()
      },
      {
        binding: 2,
        resource: {
          buffer: fragmentMaskUniformBuffer
        }
      }]

    });

    const kRenderTargetSize = 1;
    const renderTargetTexture = this.device.createTexture({
      format,
      size: {
        width: kRenderTargetSize,
        height: kRenderTargetSize,
        depthOrArrayLayers: 1
      },
      sampleCount,
      mipLevelCount: 1,
      usage:
      GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT
    });
    const resolveTargetTexture =
    sampleCount === 1 ?
    null :
    this.device.createTexture({
      format,
      size: {
        width: kRenderTargetSize,
        height: kRenderTargetSize,
        depthOrArrayLayers: 1
      },
      sampleCount: 1,
      mipLevelCount: 1,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT
    });

    const renderPassDescriptor = {
      colorAttachments: [
      {
        view: renderTargetTexture.createView(),
        resolveTarget: resolveTargetTexture?.createView(),

        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
        loadOp: 'clear',
        storeOp: 'store'
      }]

    };
    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);

    if (rasterizationMask === 15) {
      // draw full screen quad
      passEncoder.draw(6);
    } else {
      if ((rasterizationMask & 1) !== 0) {
        // draw top-left quad
        passEncoder.draw(6, 1, 6);
      }
      if ((rasterizationMask & 2) !== 0) {
        // draw top-right quad
        passEncoder.draw(6, 1, 12);
      }
      if ((rasterizationMask & 4) !== 0) {
        // draw bottom-left quad
        passEncoder.draw(6, 1, 18);
      }
      if ((rasterizationMask & 8) !== 0) {
        // draw bottom-right quad
        passEncoder.draw(6, 1, 24);
      }
    }
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    const result = sampleCount === 1 ? renderTargetTexture : resolveTargetTexture;
    assert(result !== null);
    return result;
  }

  CheckSingleSampledResult(
  texture,
  rasterizationMask,
  sampleMask,
  fragmentShaderOutputMask)
  {
    let expected = kEmptySample;

    if (
    // rasterization needs to cover the center of the pixel
    (rasterizationMask & 15) >= 15 &&
    // There is only one sample
    (fragmentShaderOutputMask & sampleMask & 1) !== 0)
    {
      // When full screen quad is drawn, Texel 3 is sampled at the pixel center
      expected = kColors[3];
    }

    this.expectSingleColor(texture, format, {
      size: [1, 1, 1],
      exp: {
        R: expected.R / 0xff,
        G: expected.G / 0xff,
        B: expected.B / 0xff,
        A: expected.A / 0xff
      }
    });
  }

  CheckMultiSampledResult(
  texture,
  sampleCount,
  rasterizationMask,
  sampleMask,
  fragmentShaderOutputMask)
  {
    const expected = {
      R: 0,
      G: 0,
      B: 0,
      A: 0
    };

    assert(sampleCount === 4);
    for (let i = 0; i < 4; i++) {
      const m = rasterizationMask & sampleMask & fragmentShaderOutputMask & 1 << i;
      // WebGPU only support up to 4 samples, so samples after the first 4 should be ignored.
      const s = (m & 0xf) === 0 ? kEmptySample : kColors[i];
      expected.R += s.R;
      expected.G += s.G;
      expected.B += s.B;
      expected.A += s.A;
    }

    this.expectSinglePixelBetweenTwoValuesIn2DTexture(
    texture,
    format,
    { x: 0, y: 0 },
    {
      exp: [
      new Uint8Array([
      Math.floor(expected.R / sampleCount),
      Math.floor(expected.G / sampleCount),
      Math.floor(expected.B / sampleCount),
      Math.floor(expected.A / sampleCount)]),

      new Uint8Array([
      Math.ceil(expected.R / sampleCount),
      Math.ceil(expected.G / sampleCount),
      Math.ceil(expected.B / sampleCount),
      Math.ceil(expected.A / sampleCount)])]


    });

  }
}

export const g = makeTestGroup(F);

g.test('final_output').
desc(
`
Tests that the final sample mask is the logical AND of all the relevant masks -- meaning that the samples
not included in the final mask are discarded on any attachments including
- color outputs
TODO:
- depth tests
- stencil operations

The test draws 0/1/1+ textured quads of which each sample in the standard 4-sample pattern results in a different color:
- Sample 0, Texel 0, top-left: Red
- Sample 1, Texel 1, top-left: Green
- Sample 2, Texel 2, top-left: Blue
- Sample 3, Texel 3, top-left: Yellow

The test checks which sample is passed by looking at the final color of the 1x1 resolve target texture, to see if that matches
what is expected given by the rasterization mask, sample mask, and fragment shader output mask.

- for sampleCount = { 1, 4 } and various combinations of:
    - rasterization mask = { 0, 0b0001, 0b0010, 0b0111, 0b1011, 0b1101, 0b1110, 0b1000, 0b1111 }
    - sample mask = { 0, 0b0001, 0b0010, 0b0111, 0b1011, 0b1101, 0b1110, 0b1111, 0b11110 }
    - fragment shader output @builtin(sample_mask) = { 0, 0b0001, 0b0010, 0b0111, 0b1011, 0b1101, 0b1110, 0b1111, 0b11110 }
- [choosing 0b11110 because the 5th bit should be ignored]
`).

params((u) =>
u.
combine('sampleCount', [1, 4]).
combine('rasterizationMask', [
0,
0b0001,
0b0010,
0b0111,
0b1011,
0b1101,
0b1110,
0b1000,
0b1111]).

beginSubcases().
combine('sampleMask', [
0,
0b0001,
0b0010,
0b0111,
0b1011,
0b1101,
0b1110,
0b1111,
0b11110]).

combine('fragmentShaderOutputMask', [
0,
0b0001,
0b0010,
0b0111,
0b1011,
0b1101,
0b1110,
0b1111,
0b11110])).


fn(async (t) => {
  const { sampleCount, rasterizationMask, sampleMask, fragmentShaderOutputMask } = t.params;

  const texture = await t.GetResolvedTargetTexture(
  sampleCount,
  rasterizationMask,
  sampleMask,
  fragmentShaderOutputMask);


  if (sampleCount === 1) {
    t.CheckSingleSampledResult(texture, rasterizationMask, sampleMask, fragmentShaderOutputMask);
  } else {
    assert(sampleCount === 4);
    t.CheckMultiSampledResult(
    texture,
    sampleCount,
    rasterizationMask,
    sampleMask,
    fragmentShaderOutputMask);

  }
});
//# sourceMappingURL=sample_mask.spec.js.map