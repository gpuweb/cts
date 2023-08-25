export const description = `
Tests the behavior of different filtering modes in minFilter/magFilter/mipmapFilter.

TODO:
- Test exact sampling results with small tolerance. Tests should differentiate between different
  values for all three filter modes to make sure none are missed or incorrect in implementations.
- (Likely unnecessary with the above.) Test exactly the expected number of samples are used.
  Test this by setting up a rendering and asserting how many different shades result.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { kAddressModes, kFilterModes } from '../../../capability_info.js';
import {
  EncodableTextureFormat,
  kRenderableColorTextureFormats,
  kTextureFormatInfo,
} from '../../../format_info.js';
import { GPUTest, TextureTestMixin } from '../../../gpu_test.js';
import { TexelView } from '../../../util/texture/texel_view.js';

export const g = makeTestGroup(TextureTestMixin(GPUTest));

/* eslint-disable prettier/prettier */
const kExpectedUVClampedMagFilterNearest = [
  [0.0,    0.0, 0.0, 1.0, 1.0,    1.0],

  [0.0,    0.0, 0.0, 1.0, 1.0,    1.0],
  [0.0,    0.0, 0.0, 1.0, 1.0,    1.0],
  [1.0,    1.0, 1.0, 0.0, 0.0,    0.0],
  [1.0,    1.0, 1.0, 0.0, 0.0,    0.0],

  [1.0,    1.0, 1.0, 0.0, 0.0,    0.0],
];
const kExpectedUClampedMagFilterNearest = [
  [1.0,    1.0, 1.0, 0.0, 0.0,    0.0],

  [0.0,    0.0, 0.0, 1.0, 1.0,    1.0],
  [0.0,    0.0, 0.0, 1.0, 1.0,    1.0],
  [1.0,    1.0, 1.0, 0.0, 0.0,    0.0],
  [1.0,    1.0, 1.0, 0.0, 0.0,    0.0],

  [0.0,    0.0, 0.0, 1.0, 1.0,    1.0],
];
const kExpectedVClampedMagFilterNearest = [
  [1.0,    0.0, 0.0, 1.0, 1.0,    0.0],

  [1.0,    0.0, 0.0, 1.0, 1.0,    0.0],
  [1.0,    0.0, 0.0, 1.0, 1.0,    0.0],
  [0.0,    1.0, 1.0, 0.0, 0.0,    1.0],
  [0.0,    1.0, 1.0, 0.0, 0.0,    1.0],

  [0.0,    1.0, 1.0, 0.0, 0.0,    1.0],
];
const kExpectedUVRepeatMagFilterNearest = [
  [0.0,    1.0, 1.0, 0.0, 0.0,    1.0],

  [1.0,    0.0, 0.0, 1.0, 1.0,    0.0],
  [1.0,    0.0, 0.0, 1.0, 1.0,    0.0],
  [0.0,    1.0, 1.0, 0.0, 0.0,    1.0],
  [0.0,    1.0, 1.0, 0.0, 0.0,    1.0],

  [1.0,    0.0, 0.0, 1.0, 1.0,    0.0],
];
const kExpectedUVClampedMagFilterLinear = [
  [0.000,    0.000, 0.250, 0.750, 1.000,    1.000],

  [0.000,    0.000, 0.250, 0.750, 1.000,    1.000],
  [0.250,    0.250, 0.375, 0.625, 0.750,    0.750],
  [0.750,    0.750, 0.625, 0.375, 0.250,    0.250],
  [1.000,    1.000, 0.750, 0.250, 0.000,    0.000],

  [1.000,    1.000, 0.750, 0.250, 0.000,    0.000],
];
const kExpectedUClampedMagFilterLinear = [
  [0.750,    0.750, 0.625, 0.375, 0.250,    0.250],

  [0.250,    0.250, 0.375, 0.625, 0.750,    0.750],
  [0.250,    0.250, 0.375, 0.625, 0.750,    0.750],
  [0.750,    0.750, 0.625, 0.375, 0.250,    0.250],
  [0.750,    0.750, 0.625, 0.375, 0.250,    0.250],

  [0.250,    0.250, 0.375, 0.625, 0.750,    0.750],
];
const kExpectedVClampedMagFilterLinear = [
  [0.750,    0.250, 0.250, 0.750, 0.750,    0.250],

  [0.750,    0.250, 0.250, 0.750, 0.750,    0.250],
  [0.625,    0.375, 0.375, 0.625, 0.625,    0.375],
  [0.375,    0.625, 0.625, 0.375, 0.375,    0.625],
  [0.250,    0.750, 0.750, 0.250, 0.250,    0.750],

  [0.250,    0.750, 0.750, 0.250, 0.250,    0.750],
];
const kExpectedUVRepeatMagFilterLinear = [
  [0.375,    0.625, 0.625, 0.375, 0.375,    0.625],

  [0.625,    0.375, 0.375, 0.625, 0.625,    0.375],
  [0.625,    0.375, 0.375, 0.625, 0.625,    0.375],
  [0.375,    0.625, 0.625, 0.375, 0.375,    0.625],
  [0.375,    0.625, 0.625, 0.375, 0.375,    0.625],

  [0.625,    0.375, 0.375, 0.625, 0.625,    0.375],
];
/* eslint-enable prettier/prettier */

function expectedMagFilterRenderColors(
  format: EncodableTextureFormat,
  filterMode: GPUFilterMode,
  addressModeU: GPUAddressMode,
  addressModeV: GPUAddressMode
): TexelView {
  // Given the 2x2 checkerboard texture we are using for the sample texture, address modes of
  // 'clamped-to-edge' and 'mirror-repeat' are actually identical, so we can just do a preprocess
  // step of reassining to `clamped-to-edge`.
  if (addressModeU === 'mirror-repeat') {
    addressModeU = 'clamp-to-edge';
  }
  if (addressModeV === 'mirror-repeat') {
    addressModeV = 'clamp-to-edge';
  }
  let expectedColors: number[][];
  if (filterMode === 'nearest') {
    if (addressModeU === 'clamp-to-edge' && addressModeV === 'clamp-to-edge') {
      expectedColors = kExpectedUVClampedMagFilterNearest;
    }
    if (addressModeU === 'repeat' && addressModeU === 'repeat') {
      expectedColors = kExpectedUVRepeatMagFilterNearest;
    }
    if (addressModeU === 'repeat' && addressModeV === 'clamp-to-edge') {
      expectedColors = kExpectedVClampedMagFilterNearest;
    }
    if (addressModeU === 'clamp-to-edge' && addressModeV === 'repeat') {
      expectedColors = kExpectedUClampedMagFilterNearest;
    }
  } else if (filterMode === 'linear') {
    if (addressModeU === 'clamp-to-edge' && addressModeV === 'clamp-to-edge') {
      expectedColors = kExpectedUVClampedMagFilterLinear;
    }
    if (addressModeU === 'repeat' && addressModeU === 'repeat') {
      expectedColors = kExpectedUVRepeatMagFilterLinear;
    }
    if (addressModeU === 'repeat' && addressModeV === 'clamp-to-edge') {
      expectedColors = kExpectedVClampedMagFilterLinear;
    }
    if (addressModeU === 'clamp-to-edge' && addressModeV === 'repeat') {
      expectedColors = kExpectedUClampedMagFilterLinear;
    }
  }
  return TexelView.fromTexelsAsColors(format, coord => {
    const c = expectedColors[coord.y][coord.x];
    return { R: c, G: c, B: c, A: 1.0 };
  });
}

g.test('magFilter')
  .desc(
    `
  Test that for filterable formats, magFilter options correctly modifies the sampling.
    - format= {<filterable formats>}
    - filterMode= {'nearest', 'linear'}
    - addressModeU= {'clamp-to-edge', 'repeat', 'mirror-repeat'}
    - addressModeV= {'clamp-to-edge', 'repeat', 'mirror-repeat'}
  `
  )
  .params(u =>
    u
      .combine('format', kRenderableColorTextureFormats)
      .filter(t => {
        return kTextureFormatInfo[t.format].color.type === 'float';
      })
      .beginSubcases()
      .combine('filterMode', kFilterModes)
      .combine('addressModeU', kAddressModes)
      .combine('addressModeV', kAddressModes)
  )
  .fn(t => {
    const { format, filterMode, addressModeU, addressModeV } = t.params;
    const sampler = t.device.createSampler({
      addressModeU,
      addressModeV,
      magFilter: filterMode,
    });

    // Simple checkerboard 2x2 texture.
    const kTextureSize = 2;
    const kRenderSize = 6;
    const kTextureData = [
      { R: 0.0, G: 0.0, B: 0.0, A: 1.0 },
      { R: 1.0, G: 1.0, B: 1.0, A: 1.0 },
      { R: 1.0, G: 1.0, B: 1.0, A: 1.0 },
      { R: 0.0, G: 0.0, B: 0.0, A: 1.0 },
    ];

    const sampleTexture = t.createTextureFromTexelView(
      TexelView.fromTexelsAsColors(format, coord => {
        const id = coord.x + coord.y * kTextureSize;
        return kTextureData[id];
      }),
      {
        size: [kTextureSize, kTextureSize],
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      }
    );
    const renderTexture = t.device.createTexture({
      format,
      size: [kRenderSize, kRenderSize],
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });
    const module = t.device.createShaderModule({
      code: `
      @group(0) @binding(0) var s : sampler;
      @group(0) @binding(1) var t : texture_2d<f32>;

      struct VertexOut {
        @builtin(position) pos: vec4f,
        @location(0) uv: vec2f,
      };

      @vertex
      fn vs_main(@builtin(vertex_index) i : u32) -> VertexOut {
        const pos = array(
          vec2f( 1.0,  1.0), vec2f( 1.0, -1.0), vec2f(-1.0, -1.0),
          vec2f( 1.0,  1.0), vec2f(-1.0, -1.0), vec2f(-1.0,  1.0),
        );
        const uv = array(
          vec2f(1.25, -0.25), vec2f(1.25, 1.25), vec2f(-0.25, 1.25),
          vec2f(1.25, -0.25), vec2f(-0.25, 1.25), vec2f(-0.25, -0.25),
        );
        return VertexOut(vec4f(pos[i], 0.0, 1.0), uv[i]);
      }

      @fragment
      fn fs_main(@location(0) uv : vec2f) -> @location(0) vec4f {
        return textureSample(t, s, uv);
      }
      `,
    });
    const pipeline = t.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs_main',
      },
      fragment: {
        module,
        entryPoint: 'fs_main',
        targets: [{ format }],
      },
      primitive: { topology: 'triangle-list' },
    });
    const bindgroup = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: sampleTexture.createView() },
      ],
    });
    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: renderTexture.createView(),
          clearValue: [0, 0, 0, 0],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindgroup);
    renderPass.draw(6);
    renderPass.end();
    t.device.queue.submit([commandEncoder.finish()]);

    t.expectTexelViewComparisonIsOkInTexture(
      { texture: renderTexture },
      expectedMagFilterRenderColors(format, filterMode, addressModeU, addressModeV),
      [kRenderSize, kRenderSize]
    );
  });

g.test('minFilter')
  .desc(
    `
  Test that for filterable formats, minFilter options correctly modifies the sampling.
    - format= {<filterable formats>}
    - filterMode= {'nearest', 'linear'}
    - addressModeU= {'clamp-to-edge', 'repeat', 'mirror-repeat'}
    - addressModeV= {'clamp-to-edge', 'repeat', 'mirror-repeat'}
  `
  )
  .params(u =>
    u
      .combine('format', kRenderableColorTextureFormats)
      .filter(t => {
        return kTextureFormatInfo[t.format].color.type === 'float';
      })
      //.beginSubcases()
      .combine('filterMode', kFilterModes)
      .combine('addressModeU', kAddressModes)
      .combine('addressModeV', kAddressModes)
  )
  .fn(t => {
    const { format, filterMode, addressModeU, addressModeV } = t.params;
    const sampler = t.device.createSampler({
      addressModeU,
      addressModeV,
      minFilter: filterMode,
    });

    // Simple checkerboard 2x2 texture.
    const kTextureSize = 2;
    const kRenderSize = 6;
    const kTextureData = [
      { R: 0.0, G: 0.0, B: 0.0, A: 1.0 },
      { R: 1.0, G: 1.0, B: 1.0, A: 1.0 },
      { R: 1.0, G: 1.0, B: 1.0, A: 1.0 },
      { R: 0.0, G: 0.0, B: 0.0, A: 1.0 },
    ];

    const sampleTexture = t.createTextureFromTexelView(
      TexelView.fromTexelsAsColors(format, coord => {
        const id = coord.x + coord.y * kTextureSize;
        return kTextureData[id];
      }),
      {
        size: [kTextureSize, kTextureSize],
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      }
    );
    const renderTexture = t.device.createTexture({
      format,
      size: [kRenderSize, kRenderSize],
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });
    const module = t.device.createShaderModule({
      code: `
      @group(0) @binding(0) var s : sampler;
      @group(0) @binding(1) var t : texture_2d<f32>;

      struct VertexOut {
        @builtin(position) pos: vec4f,
        @location(0) uv: vec2f,
      };

      @vertex
      fn vs_main(@builtin(vertex_index) vi : u32,
                 @builtin(instance_index) ii: u32) -> VertexOut {
        const grid = vec2f(6., 6.);
        const size = 7. / 12.;

        const constantPlaneOffset = vec2f(5. / 12., 5. / 12.);
        const perPixelOffset = -1. / 6.;

        const pos = array(
          vec2f( size,  size), vec2f( size, -size), vec2f(-size, -size),
          vec2f( size,  size), vec2f(-size, -size), vec2f(-size,  size),
        );
        const uv = array(
          vec2f(1.25, -0.25), vec2f(1.25, 1.25), vec2f(-0.25, 1.25),
          vec2f(1.25, -0.25), vec2f(-0.25, 1.25), vec2f(-0.25, -0.25),
        );

        // Compute the offset of the plane.
        let cell = vec2f(f32(ii) % grid.x, floor(f32(ii) / grid.y));
        let cellOffset = cell / grid * 2;
        let instancePos =
          pos[vi] + constantPlaneOffset + vec2(cell.x * perPixelOffset, cell.y * perPixelOffset);
        let absPos = (instancePos + 1) / grid - 1 + cellOffset;
        return VertexOut(vec4f(absPos, 0.0, 1.0), uv[vi]);
      }

      @fragment
      fn fs_main(@location(0) uv : vec2f) -> @location(0) vec4f {
        return textureSample(t, s, uv);
      }
      `,
    });
    const pipeline = t.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs_main',
      },
      fragment: {
        module,
        entryPoint: 'fs_main',
        targets: [{ format }],
      },
      primitive: { topology: 'triangle-list' },
    });
    const bindgroup = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: sampleTexture.createView() },
      ],
    });
    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: renderTexture.createView(),
          clearValue: [0, 0, 0, 0],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindgroup);
    renderPass.draw(6, 36);
    renderPass.end();
    t.device.queue.submit([commandEncoder.finish()]);

    t.expectTexelViewComparisonIsOkInTexture(
      { texture: renderTexture },
      expectedMagFilterRenderColors(format, filterMode, addressModeU, addressModeV),
      [kRenderSize, kRenderSize]
    );
  });
