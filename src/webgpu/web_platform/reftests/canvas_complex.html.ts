import { assert, unreachable } from '../../../common/util/util.js';

import { runRefTest } from './gpu_ref_test.js';

// <canvas> element from html page
declare const cvs: HTMLCanvasElement;

type WriteCanvasMethod =
  | 'copyBufferToTexture'
  | 'copyTextureToTexture'
  | 'copyExternalImageToTexture'
  | 'DrawTextureSample'
  | 'DrawVertexColor';

export function run(format: GPUTextureFormat, writeCanvasMethod: WriteCanvasMethod) {
  runRefTest(async t => {
    // const ctx = (cvs.getContext('webgpu') as unknown) as GPUCanvasContext;
    const ctx = cvs.getContext('webgpu');
    assert(ctx !== null, 'Failed to get WebGPU context from canvas');

    switch (format) {
      case 'bgra8unorm':
      case 'bgra8unorm-srgb':
      case 'rgba8unorm':
      case 'rgba8unorm-srgb':
        break;
      default:
        unreachable();
    }

    ctx.configure({
      device: t.device,
      format,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    function copyBufferToTexture() {
      const rows = 2;
      const bytesPerRow = 256;
      const buffer = t.device.createBuffer({
        mappedAtCreation: true,
        size: rows * bytesPerRow,
        usage: GPUBufferUsage.COPY_SRC,
      });
      const mapping = buffer.getMappedRange();
      switch (format) {
        case 'bgra8unorm':
          {
            const data = new Uint8Array(mapping);
            data.set(new Uint8Array([0x00, 0x00, 0x7f, 0xff]), 0); // red
            data.set(new Uint8Array([0x00, 0x7f, 0x00, 0xff]), 4); // green
            data.set(new Uint8Array([0x7f, 0x00, 0x00, 0xff]), 256 + 0); // blue
            data.set(new Uint8Array([0x00, 0x7f, 0x7f, 0xff]), 256 + 4); // yellow
          }
          break;
        case 'rgba8unorm':
          {
            const data = new Uint8Array(mapping);
            data.set(new Uint8Array([0x7f, 0x00, 0x00, 0xff]), 0); // red
            data.set(new Uint8Array([0x00, 0x7f, 0x00, 0xff]), 4); // green
            data.set(new Uint8Array([0x00, 0x00, 0x7f, 0xff]), 256 + 0); // blue
            data.set(new Uint8Array([0x7f, 0x7f, 0x00, 0xff]), 256 + 4); // yellow
          }
          break;
        case 'bgra8unorm-srgb':
          {
            // TODO
          }
          break;
        case 'rgba8unorm-srgb':
          {
            // TODO
          }
          break;
      }
      buffer.unmap();

      const encoder = t.device.createCommandEncoder();
      encoder.copyBufferToTexture({ buffer, bytesPerRow }, { texture: ctx.getCurrentTexture() }, [
        2,
        2,
        1,
      ]);
      t.device.queue.submit([encoder.finish()]);
    }

    async function getImageBitmapFromFile(): Promise<ImageBitmap> {
      const img = new Image();
      img.src = '../../../resources/canvas-complex-2x2.png';
      await img.decode();
      return createImageBitmap(img);
    }

    function setupSrcTexture(imageBitmap: ImageBitmap): GPUTexture {
      const [srcWidth, srcHeight] = [imageBitmap.width, imageBitmap.height];
      const srcTexture = t.device.createTexture({
        size: [srcWidth, srcHeight, 1],
        format,
        usage:
          GPUTextureUsage.SAMPLED |
          GPUTextureUsage.RENDER_ATTACHMENT |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.COPY_SRC,
      });
      t.device.queue.copyExternalImageToTexture({ source: imageBitmap }, { texture: srcTexture }, [
        imageBitmap.width,
        imageBitmap.height,
      ]);
      return srcTexture;
    }

    async function copyExternalImageToTexture() {
      const imageBitmap = await getImageBitmapFromFile();
      t.device.queue.copyExternalImageToTexture(
        { source: imageBitmap },
        { texture: ctx.getCurrentTexture() },
        [imageBitmap.width, imageBitmap.height]
      );
    }

    async function copyTextureToTexture() {
      const imageBitmap = await getImageBitmapFromFile();
      const srcTexture = setupSrcTexture(imageBitmap);

      const encoder = t.device.createCommandEncoder();
      encoder.copyTextureToTexture(
        { texture: srcTexture, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
        { texture: ctx.getCurrentTexture(), mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
        [imageBitmap.width, imageBitmap.height, 1]
      );
      t.device.queue.submit([encoder.finish()]);
    }

    async function DrawTextureSample() {
      const imageBitmap = await getImageBitmapFromFile();
      const srcTexture = setupSrcTexture(imageBitmap);

      const pipeline = t.device.createRenderPipeline({
        vertex: {
          module: t.device.createShaderModule({
            code: `
struct VertexOutput {
  [[builtin(position)]] Position : vec4<f32>;
  [[location(0)]] fragUV : vec2<f32>;
};

[[stage(vertex)]]
fn main([[builtin(vertex_index)]] VertexIndex : u32) -> VertexOutput {
  var pos = array<vec2<f32>, 6>(
      vec2<f32>( 1.0,  1.0),
      vec2<f32>( 1.0, -1.0),
      vec2<f32>(-1.0, -1.0),
      vec2<f32>( 1.0,  1.0),
      vec2<f32>(-1.0, -1.0),
      vec2<f32>(-1.0,  1.0));

  var uv = array<vec2<f32>, 6>(
      vec2<f32>(1.0, 0.0),
      vec2<f32>(1.0, 1.0),
      vec2<f32>(0.0, 1.0),
      vec2<f32>(1.0, 0.0),
      vec2<f32>(0.0, 1.0),
      vec2<f32>(0.0, 0.0));

  var output : VertexOutput;
  output.Position = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
  output.fragUV = uv[VertexIndex];
  return output;
}
            `,
          }),
          entryPoint: 'main',
        },
        fragment: {
          module: t.device.createShaderModule({
            code: `
[[group(0), binding(0)]] var mySampler: sampler;
[[group(0), binding(1)]] var myTexture: texture_2d<f32>;

[[stage(fragment)]]
fn main([[location(0)]] fragUV: vec2<f32>) -> [[location(0)]] vec4<f32> {
  return textureSample(myTexture, mySampler, fragUV);
}
            `,
          }),
          entryPoint: 'main',
          targets: [
            {
              format,
            },
          ],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });

      const sampler = t.device.createSampler({
        magFilter: 'nearest',
        minFilter: 'nearest',
      });

      const uniformBindGroup = t.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: sampler,
          },
          {
            binding: 1,
            resource: srcTexture.createView(),
          },
        ],
      });

      const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [
          {
            view: ctx.getCurrentTexture().createView(),

            loadValue: { r: 0.5, g: 0.5, b: 0.5, a: 1.0 },
            storeOp: 'store',
          },
        ],
      };

      const commandEncoder = t.device.createCommandEncoder();
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, uniformBindGroup);
      passEncoder.draw(6, 1, 0, 0);
      passEncoder.endPass();
      t.device.queue.submit([commandEncoder.finish()]);
    }

    function DrawVertexColor() {
      const pipeline = t.device.createRenderPipeline({
        vertex: {
          module: t.device.createShaderModule({
            code: `
struct VertexOutput {
  [[builtin(position)]] Position : vec4<f32>;
  [[location(0)]] fragColor : vec4<f32>;
};

[[stage(vertex)]]
fn main([[builtin(vertex_index)]] VertexIndex : u32) -> VertexOutput {
  var pos = array<vec2<f32>, 6>(
      vec2<f32>( 0.5,  0.5),
      vec2<f32>( 0.5, -0.5),
      vec2<f32>(-0.5, -0.5),
      vec2<f32>( 0.5,  0.5),
      vec2<f32>(-0.5, -0.5),
      vec2<f32>(-0.5,  0.5));

  var offset = array<vec2<f32>, 4>(
    vec2<f32>( -0.5,  0.5),
    vec2<f32>( 0.5, 0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>( 0.5,  -0.5));

  var color = array<vec4<f32>, 4>(
      vec4<f32>(0.49804, 0.0, 0.0, 1.0),
      vec4<f32>(0.0, 0.49804, 0.0, 1.0),
      vec4<f32>(0.0, 0.0, 0.49804, 1.0),
      vec4<f32>(0.49804, 0.49804, 0.0, 1.0)); // 0.49804 -> 0x7f

  var output : VertexOutput;
  output.Position = vec4<f32>(pos[VertexIndex % 6u] + offset[VertexIndex / 6u], 0.0, 1.0);
  output.fragColor = color[VertexIndex / 6u];
  return output;
}
            `,
          }),
          entryPoint: 'main',
        },
        fragment: {
          module: t.device.createShaderModule({
            code: `
[[stage(fragment)]]
fn main([[location(0)]] fragColor: vec4<f32>) -> [[location(0)]] vec4<f32> {
  return fragColor;
}
            `,
          }),
          entryPoint: 'main',
          targets: [
            {
              format,
            },
          ],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });

      const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [
          {
            view: ctx.getCurrentTexture().createView(),

            loadValue: { r: 0.5, g: 0.5, b: 0.5, a: 1.0 },
            storeOp: 'store',
          },
        ],
      };

      const commandEncoder = t.device.createCommandEncoder();
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setPipeline(pipeline);
      passEncoder.draw(24, 1, 0, 0);
      passEncoder.endPass();
      t.device.queue.submit([commandEncoder.finish()]);
    }

    switch (writeCanvasMethod) {
      case 'copyBufferToTexture':
        copyBufferToTexture();
        break;
      case 'copyExternalImageToTexture':
        await copyExternalImageToTexture();
        break;
      case 'copyTextureToTexture':
        await copyTextureToTexture();
        break;
      case 'DrawTextureSample':
        await DrawTextureSample();
        break;
      case 'DrawVertexColor':
        DrawVertexColor();
        break;
      default:
        unreachable();
    }
  });
}
