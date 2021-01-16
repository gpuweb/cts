export const description = `
Tests the behavior of anisotropic filtering.

TODO:
Note that anisotropic filtering is never guaranteed to occur, but we might be able to test some
things. If there are no guarantees we can issue warnings instead of failures. Ideas:
  - No *more* than the provided maxAnisotropy samples are used, by testing how many unique
    sample values come out of the sample operation.
  - Result with and without anisotropic filtering is different (if the hardware supports it).
  - Check anisotropy is done in the correct direciton (by having a 2D gradient and checking we get
    more of the color in the correct direction).
More generally:
  - Test very large and very small values (even if tests are very weak).
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { mipSize } from '../../../util/texture/subresource.js';

const kRTSize = 16;
const kBytesPerRow = 256;
const xm = kRTSize / 2;
const kColorAttachmentFormat = 'rgba8unorm';
const kTextureFormat = 'rgba8unorm';
const colors = [
  new Uint8Array([0xff, 0x00, 0x00, 0xff]), // miplevel = 0
  new Uint8Array([0x00, 0xff, 0x00, 0xff]), // miplevel = 1
  new Uint8Array([0x00, 0x00, 0xff, 0xff]), // miplevel = 2
];

export const g = makeTestGroup(GPUTest);

g.test('anisotropic_filter_checkerboard')
  .desc(
    `anisotropic filter rendering tests that draws a slanted plane and samples from a texture
    that only has a top level mipmap, the content of which is like a checkerboard.
    We will check the rendering result using sampler with maxAnisotropy values to be
    different from each other, as the sampling rate is different.
    We will also check if those large maxAnisotropy values are clamped so that rendering is the
    same as the supported upper limit say 16.`)
  .unimplemented();

g.test('anisotropic_filter_mipmap_color')
  .desc(
    `anisotropic filter rendering tests that draws a slanted plane and samples from a texture
    containing mipmaps of different colors.
    A similiar webgl demo is at https://jsfiddle.net/t8k7c95o/5/`
  )
  .params(
    [
      {
        maxAnisotropy: 1,
        _results: [
          {
            coord: {x: xm, y: 2},
            expected: colors[2]
          },
          {
            coord: {x: xm, y: 6},
            expected: [colors[0], colors[1]]
          }
        ]
      },
      {
        maxAnisotropy: 2,
        _results: [
          {
            coord: {x: xm, y: 2},
            expected: [colors[1], colors[2]]
          },
          {
            coord: {x: xm, y: 6},
            expected: colors[0]
          }
        ]
      },
      {
        maxAnisotropy: 16,
        _results: [
          {
            coord: {x: xm, y: 2},
            expected: [colors[0], colors[1]]
          },
          {
            coord: {x: xm, y: 6},
            expected: colors[0]
          }
        ]
      },
    ]
  )
  .fn(async t => {  
    const colorAttachment = t.device.createTexture({
      format: kColorAttachmentFormat,
      size: { width: kRTSize, height: kRTSize, depth: 1 },
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.OUTPUT_ATTACHMENT,
    });
    const colorAttachmentView = colorAttachment.createView();

    const mipLevelCount = 3;
    const textureSizeMipmap0 = 1 << (mipLevelCount - 1);
    const texture = t.device.createTexture({
      mipLevelCount,
      size: { width: textureSizeMipmap0, height: textureSizeMipmap0, depth: 1},
      format: kTextureFormat,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.SAMPLED
    });

    // init texture
    const textureEncoder = t.device.createCommandEncoder();
    // Populate each level with a different color
    for (let i = 0; i < mipLevelCount; i++) {
      const mipmapSize = mipSize([textureSizeMipmap0], i)[0];
      const bufferSize = kBytesPerRow * mipmapSize;  // RGBA8 for each pixel (256 > 16 * 4)

      // init texture data
      let data : Uint8Array = new Uint8Array(bufferSize);
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
      const buffer = t.device.createBuffer({
        usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        size: data.byteLength
      });
      t.device.defaultQueue.writeBuffer(buffer, 0, data);
      const bytesPerRow = kBytesPerRow;
      const rowsPerImage = kRTSize;

      textureEncoder.copyBufferToTexture(
        {
          buffer,
          bytesPerRow,
          rowsPerImage
        },
        {
          texture,
          mipLevel: i,
          origin: [0, 0, 0]
        },
        [mipmapSize, mipmapSize, 1]
      );
    }
    t.device.defaultQueue.submit([textureEncoder.finish()]);

    const textureView = texture.createView();

    const pipeline = t.device.createRenderPipeline({
      vertexStage: {
        module: t.device.createShaderModule({
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
        module: t.device.createShaderModule({
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
                format: "float4",
              },
              {
                // uv
                shaderLocation: 1,
                offset: 4 * 4,
                format: "float2",
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
      21.86800193786621
    ]);
    const uniformBuffer = t.device.createBuffer({
      size: matrixData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    t.device.defaultQueue.writeBuffer(uniformBuffer, 0, matrixData);

    // position : vec4, uv : vec2
    // uv is scaled
    const vertexData = new Float32Array([
      -0.5, 0.5, -0.5, 1, 0, 0,  0.5, 0.5, -0.5, 1, 1, 0, -0.5, 0.5, 0.5, 1, 0, 50,
      -0.5, 0.5, 0.5,  1, 0, 50, 0.5, 0.5, -0.5, 1, 1, 0, 0.5,  0.5, 0.5, 1, 1, 50,
    ]);
    const vertexBuffer = t.device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    t.device.defaultQueue.writeBuffer(vertexBuffer, 0, vertexData);

    const sampler = t.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      maxAnisotropy: t.params.maxAnisotropy,
    });

    const bindGroup = t.device.createBindGroup({
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: textureView },
        { binding: 2, resource: { buffer: uniformBuffer } },
      ],
      layout: pipeline.getBindGroupLayout(0),
    });

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          attachment: colorAttachmentView,
          storeOp: 'store',
          loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setBindGroup(0, bindGroup);
    pass.draw(6);
    pass.endPass();
    t.device.defaultQueue.submit([encoder.finish()]);

    for (let entry of t.params._results) {
      if (entry.expected instanceof Uint8Array) {
        // equal exactly one color
        t.expectSinglePixelIn2DTexture(
          colorAttachment,
          kColorAttachmentFormat,
          entry.coord,
          { exp: entry.expected as Uint8Array }
        );
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