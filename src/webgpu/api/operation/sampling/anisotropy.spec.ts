export const description = `
Tests the behavior of anisotropic filtering.

TODO:
Note that anisotropic filtering is never guaranteed to occur, but we might be able to test some
things. If there are no guarantees we can issue warnings instead of failures. Ideas:
  - No *more* than the provided maxAnisotropy samples are used, by testing how many unique
    sample values come out of the sample operation.
  - Check anisotropy is done in the correct direciton (by having a 2D gradient and checking we get
    more of the color in the correct direction).
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { assert } from '../../../../common/framework/util/util.js';
import { GPUTest } from '../../../gpu_test.js';
import { mipSize } from '../../../util/texture/subresource.js';

const kRTSize = 16;
const kBytesPerRow = 256;
const xMiddle = kRTSize / 2;  // we check the pixel value in the middle of the render target
const kColorAttachmentFormat = 'rgba8unorm';
const kTextureFormat = 'rgba8unorm';
const colors = [
  new Uint8Array([0xff, 0x00, 0x00, 0xff]), // miplevel = 0
  new Uint8Array([0x00, 0xff, 0x00, 0xff]), // miplevel = 1
  new Uint8Array([0x00, 0x00, 0xff, 0xff]), // miplevel = 2
];
const checkerColors = [
  new Uint8Array([0xff, 0x00, 0x00, 0xff]),
  new Uint8Array([0x00, 0xff, 0x00, 0xff]),
];

// renders texture a slanted plane placed in a specific way
class SamplerAnisotropicFilteringSlantedPlaneTest extends GPUTest {

  copyRenderTargetToBuffer(rt: GPUTexture): GPUBuffer {
    const byteLength = kRTSize * kBytesPerRow;
    const buffer = this.device.createBuffer({
      size: byteLength,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyTextureToBuffer(
      { texture: rt, mipLevel: 0, origin: [0, 0, 0] },
      { buffer, bytesPerRow: kBytesPerRow, rowsPerImage: kRTSize },
      { width: kRTSize, height: kRTSize, depth: 1 }
    );
    this.queue.submit([commandEncoder.finish()]);

    return buffer;
  }

  private pipeline: GPURenderPipeline | undefined;
  private uniformBuffer: GPUBuffer | undefined;
  private vertexBuffer: GPUBuffer | undefined;
  async init(): Promise<void> {
    await super.init();

    this.pipeline = this.device.createRenderPipeline({
      vertexStage: {
        module: this.device.createShaderModule({
          code: `
            [[block]] struct Uniforms {
                [[offset(0)]] matrix : mat4x4<f32>;
            };

            [[location(0)]] var<in> position : vec4<f32>;
            [[location(1)]] var<in> uv : vec2<f32>;

            [[set(0), binding(2)]] var<uniform> uniforms : Uniforms;

            [[builtin(position)]] var<out> Position : vec4<f32>;
            [[location(0)]] var<out> fragUV : vec2<f32>;

            [[stage(vertex)]] fn main() -> void {
                fragUV = uv;
                Position = uniforms.matrix * position;
            }
            `,
        }),
        entryPoint: 'main',
      },
      fragmentStage: {
        module: this.device.createShaderModule({
          code: `
            [[set(0), binding(0)]] var<uniform_constant> sampler0 : sampler;
            [[set(0), binding(1)]] var<uniform_constant> texture0 : texture_2d<f32>;

            [[builtin(frag_coord)]] var<in> FragCoord : vec4<f32>;

            [[location(0)]] var<in> fragUV: vec2<f32>;

            [[location(0)]] var<out> fragColor : vec4<f32>;

            [[stage(fragment)]] fn main() -> void {
                fragColor = textureSample(texture0, sampler0, fragUV);
            }
            `,
        }),
        entryPoint: 'main',
      },
      primitiveTopology: 'triangle-list',
      colorStates: [{ format: 'rgba8unorm' }],
      vertexState: {
        vertexBuffers: [
          {
            arrayStride: 6 * Float32Array.BYTES_PER_ELEMENT,
            attributes: [
              {
                // position
                shaderLocation: 0,
                offset: 0,
                format: 'float4',
              },
              {
                // uv
                shaderLocation: 1,
                offset: 4 * 4,
                format: 'float2',
              },
            ],
          },
        ],
      },
    });

    const matrixData = new Float32Array([
      -1.7320507764816284,
      1.8322050568049563e-16,
      -6.176817699518044e-17,
      -6.170640314703498e-17,
      -2.1211504944260596e-16,
      -1.496108889579773,
      0.5043753981590271,
      0.5038710236549377,
      0,
      -43.63650894165039,
      -43.232173919677734,
      -43.18894577026367,
      0,
      21.693578720092773,
      21.789791107177734,
      21.86800193786621,
    ]);
    this.uniformBuffer = this.device.createBuffer({
      size: matrixData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.defaultQueue.writeBuffer(this.uniformBuffer, 0, matrixData);

    // position : vec4, uv : vec2
    // uv is scaled
    const vertexData = new Float32Array([
      -0.5,
      0.5,
      -0.5,
      1,
      0,
      0,
      0.5,
      0.5,
      -0.5,
      1,
      1,
      0,
      -0.5,
      0.5,
      0.5,
      1,
      0,
      50,
      -0.5,
      0.5,
      0.5,
      1,
      0,
      50,
      0.5,
      0.5,
      -0.5,
      1,
      1,
      0,
      0.5,
      0.5,
      0.5,
      1,
      1,
      50,
    ]);
    this.vertexBuffer = this.device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.defaultQueue.writeBuffer(this.vertexBuffer, 0, vertexData);
  }

  // return the render target texture object
  drawSlantedPlane(textureView: GPUTextureView, sampler: GPUSampler): GPUTexture {
    // make sure it's already initialized
    assert(this.pipeline !== undefined);
    assert(this.uniformBuffer !== undefined);
    assert(this.vertexBuffer !== undefined);

    const bindGroup = this.device.createBindGroup({
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: textureView },
        { binding: 2, resource: { buffer: this.uniformBuffer } },
      ],
      layout: this.pipeline.getBindGroupLayout(0),
    });

    const colorAttachment = this.device.createTexture({
      format: kColorAttachmentFormat,
      size: { width: kRTSize, height: kRTSize, depth: 1 },
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.OUTPUT_ATTACHMENT,
    });
    const colorAttachmentView = colorAttachment.createView();

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          attachment: colorAttachmentView,
          storeOp: 'store',
          loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        },
      ],
    });
    pass.setPipeline(this.pipeline);
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setBindGroup(0, bindGroup);
    pass.draw(6);
    pass.endPass();
    this.device.defaultQueue.submit([encoder.finish()]);

    return colorAttachment;
  }
}

export const g = makeTestGroup(SamplerAnisotropicFilteringSlantedPlaneTest);

g.test('anisotropic_filter_checkerboard')
  .desc(
    `anisotropic filter rendering tests that draws a slanted plane and samples from a texture
    that only has a top level mipmap, the content of which is like a checkerboard.
    We will check the rendering result using sampler with maxAnisotropy values to be
    different from each other, as the sampling rate is different.
    We will also check if those large maxAnisotropy values are clamped so that rendering is the
    same as the supported upper limit say 16.
    A similar webgl demo is at https://jsfiddle.net/yqnbez24`
  )
  .fn(async t => {
    // init texture with only a top level mipmap
    const textureSize = 32;
    const texture = t.device.createTexture({
      mipLevelCount: 1,
      size: { width: textureSize, height: textureSize, depth: 1 },
      format: kTextureFormat,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.SAMPLED,
    });

    const textureEncoder = t.device.createCommandEncoder();

    const bufferSize = kBytesPerRow * textureSize; // RGBA8 for each pixel (256 > 16 * 4)

    // init checkerboard texture data
    const data: Uint8Array = new Uint8Array(bufferSize);
    for (let r = 0; r < textureSize; r++) {
      const o = r * kBytesPerRow;
      for (let c = o, end = o + textureSize * 4; c < end; c += 4) {
        const cid = (r + (c - o) / 4) % 2;
        const color = checkerColors[cid];
        data[c] = color[0];
        data[c + 1] = color[1];
        data[c + 2] = color[2];
        data[c + 3] = color[3];
      }
    }
    const buffer = t.makeBufferWithContents(data, GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
    const bytesPerRow = kBytesPerRow;
    const rowsPerImage = textureSize;

    textureEncoder.copyBufferToTexture(
      {
        buffer,
        bytesPerRow,
        rowsPerImage,
      },
      {
        texture,
        mipLevel: 0,
        origin: [0, 0, 0],
      },
      [textureSize, textureSize, 1]
    );

    t.device.defaultQueue.submit([textureEncoder.finish()]);

    const textureView = texture.createView();

    const samplers = [
      t.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
        maxAnisotropy: 1,
      }),
      t.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
        maxAnisotropy: 16,
      }),
      t.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
        maxAnisotropy: 1024,
      }),
    ];

    const byteLength = kRTSize * kBytesPerRow;

    const dst: GPUBuffer[] = [];

    await Promise.all(
      samplers.map((sampler, idx) => {
        const d = (dst[idx] = t.createAlignedCopyForMapRead(
          t.copyRenderTargetToBuffer(t.drawSlantedPlane(textureView, sampler)),
          byteLength,
          0
        ).dst);
        return d.mapAsync(GPUMapMode.READ);
      })
    ).then(() => {
      const results: Uint8Array[] = [];
      for (let i = 0; i < dst.length; i++) {
        results[i] = new Uint8Array(dst[i].getMappedRange());
      }

      const check0 = t.checkBuffer(results[0], results[1]);
      if (check0 === undefined) {
        t.expect(false, 'Render results with sampler.maxAnisotropy being 1 and 16 should be different.');
      }
      const check1 = t.checkBuffer(results[1], results[2]);
      if (check1 !== undefined) {
        t.warn('Render results with sampler.maxAnisotropy being 16 and 1024 should be the same.');
      }
    });
  });

g.test('anisotropic_filter_mipmap_color')
  .desc(
    `anisotropic filter rendering tests that draws a slanted plane and samples from a texture
    containing mipmaps of different colors.
    A similar webgl demo is at https://jsfiddle.net/t8k7c95o/5/`
  )
  .params([
    {
      maxAnisotropy: 1,
      _results: [
        {
          coord: { x: xMiddle, y: 2 },
          expected: colors[2],
        },
        {
          coord: { x: xMiddle, y: 6 },
          expected: [colors[0], colors[1]],
        },
      ],
    },
    {
      maxAnisotropy: 2,
      _results: [
        {
          coord: { x: xMiddle, y: 2 },
          expected: [colors[1], colors[2]],
        },
        {
          coord: { x: xMiddle, y: 6 },
          expected: colors[0],
        },
      ],
    },
    {
      maxAnisotropy: 16,
      _results: [
        {
          coord: { x: xMiddle, y: 2 },
          expected: [colors[0], colors[1]],
        },
        {
          coord: { x: xMiddle, y: 6 },
          expected: colors[0],
        },
      ],
    },
  ])
  .fn(async t => {
    // init texture
    const mipLevelCount = 3;
    const textureSizeMipmap0 = 1 << (mipLevelCount - 1);
    const texture = t.device.createTexture({
      mipLevelCount,
      size: { width: textureSizeMipmap0, height: textureSizeMipmap0, depth: 1 },
      format: kTextureFormat,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.SAMPLED,
    });

    const textureEncoder = t.device.createCommandEncoder();
    // Populate each level with a different color
    for (let i = 0; i < mipLevelCount; i++) {
      const mipmapSize = mipSize([textureSizeMipmap0], i)[0];
      const bufferSize = kBytesPerRow * mipmapSize; // RGBA8 for each pixel (256 > 16 * 4)

      // init texture data
      const data: Uint8Array = new Uint8Array(bufferSize);
      const color = colors[i];
      for (let r = 0; r < mipmapSize; r++) {
        const o = r * kBytesPerRow;
        for (let c = o, end = o + mipmapSize * 4; c < end; c += 4) {
          data[c] = color[0];
          data[c + 1] = color[1];
          data[c + 2] = color[2];
          data[c + 3] = color[3];
        }
      }
      const buffer = t.makeBufferWithContents(data, GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
      const bytesPerRow = kBytesPerRow;
      const rowsPerImage = mipmapSize;

      textureEncoder.copyBufferToTexture(
        {
          buffer,
          bytesPerRow,
          rowsPerImage,
        },
        {
          texture,
          mipLevel: i,
          origin: [0, 0, 0],
        },
        [mipmapSize, mipmapSize, 1]
      );
    }
    t.device.defaultQueue.submit([textureEncoder.finish()]);

    const textureView = texture.createView();

    const sampler = t.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      maxAnisotropy: t.params.maxAnisotropy,
    });

    const colorAttachment = t.drawSlantedPlane(textureView, sampler);

    for (const entry of t.params._results) {
      if (entry.expected instanceof Uint8Array) {
        // equal exactly one color
        t.expectSinglePixelIn2DTexture(colorAttachment, kColorAttachmentFormat, entry.coord, {
          exp: entry.expected as Uint8Array,
        });
      } else {
        // a lerp between two colors
        t.expectSinglePixelBetweenTwoValuesIn2DTexture(
          colorAttachment,
          kColorAttachmentFormat,
          entry.coord,
          { exp: entry.expected as [Uint8Array, Uint8Array] }
        );
      }
    }
  });
