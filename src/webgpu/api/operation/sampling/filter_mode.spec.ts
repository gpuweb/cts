export const description = `
Tests the behavior of different filtering modes in minFilter/magFilter/mipmapFilter.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { kAddressModes, kFilterModes, kMipmapFilterModes } from '../../../capability_info.js';
import {
  EncodableTextureFormat,
  kRenderableColorTextureFormats,
  kTextureFormatInfo,
} from '../../../format_info.js';
import { GPUTest, TextureTestMixin } from '../../../gpu_test.js';
import { getTextureCopyLayout } from '../../../util/texture/layout.js';
import { TexelView } from '../../../util/texture/texel_view.js';

export const g = makeTestGroup(TextureTestMixin(GPUTest));

/* eslint-disable prettier/prettier */
const kExpectedUVClampedNearest = [
  [0, 0, 1, 1],
  [0, 0, 1, 1],
  [1, 1, 0, 0],
  [1, 1, 0, 0],
];
const kExpectedUClampedNearest = [
  [1, 1, 0, 0],
  [0, 0, 1, 1],
  [1, 1, 0, 0],
  [0, 0, 1, 1],
];
const kExpectedVClampedNearest = [
  [1, 0, 1, 0],
  [1, 0, 1, 0],
  [0, 1, 0, 1],
  [0, 1, 0, 1],
];
const kExpectedUVRepeatNearest = [
  [0, 1, 0, 1],
  [1, 0, 1, 0],
  [0, 1, 0, 1],
  [1, 0, 1, 0],
];

const kExpectedUVClampedLinear = [
  [ 0.000, 0.250, 0.750, 1.000 ],
  [ 0.250, 0.375, 0.625, 0.750 ],
  [ 0.750, 0.625, 0.375, 0.250 ],
  [ 1.000, 0.750, 0.250, 0.000 ],
];
const kExpectedUClampedLinear = [
  [ 0.250, 0.375, 0.625, 0.750 ],
  [ 0.250, 0.375, 0.625, 0.750 ],
  [ 0.750, 0.625, 0.375, 0.250 ],
  [ 0.750, 0.625, 0.375, 0.250 ],
];
const kExpectedVClampedLinear = [
  [ 0.250, 0.250, 0.750, 0.750 ],
  [ 0.375, 0.375, 0.625, 0.625 ],
  [ 0.625, 0.625, 0.375, 0.375 ],
  [ 0.750, 0.750, 0.250, 0.250 ],
];
const kExpectedUVRepeatLinear = [
  [ 0.375, 0.375, 0.625, 0.625 ],
  [ 0.375, 0.375, 0.625, 0.625 ],
  [ 0.625, 0.625, 0.375, 0.375 ],
  [ 0.625, 0.625, 0.375, 0.375 ],
];
/* eslint-enable prettier/prettier */

// Given the 2x2 checkerboard texture we are using for the sample texture, address modes of
// 'clamped-to-edge' and 'mirror-repeat' are actually identical, so we can just do a preprocess
// step of reassining to `clamped-to-edge`.
function expectedNearestColors(
  format: EncodableTextureFormat,
  addressModeU: GPUAddressMode,
  addressModeV: GPUAddressMode
): TexelView {
  if (addressModeU === 'mirror-repeat') {
    addressModeU = 'clamp-to-edge';
  }
  if (addressModeV === 'mirror-repeat') {
    addressModeV = 'clamp-to-edge';
  }
  let expectedColors: number[][];
  if (addressModeU === 'clamp-to-edge' && addressModeV === 'clamp-to-edge') {
    expectedColors = kExpectedUVClampedNearest;
  }
  if (addressModeU === 'repeat' && addressModeU === 'repeat') {
    expectedColors = kExpectedUVRepeatNearest;
  }
  if (addressModeU === 'repeat' && addressModeV === 'clamp-to-edge') {
    expectedColors = kExpectedVClampedNearest;
  }
  if (addressModeU === 'clamp-to-edge' && addressModeV === 'repeat') {
    expectedColors = kExpectedUClampedNearest;
  }
  return TexelView.fromTexelsAsColors(format, coord => {
    const c = expectedColors[coord.y][coord.x];
    return { R: c, G: c, B: c, A: 1.0 };
  });
}
function expectedLinearColors(
  format: EncodableTextureFormat,
  addressModeU: GPUAddressMode,
  addressModeV: GPUAddressMode
): TexelView {
  if (addressModeU === 'mirror-repeat') {
    addressModeU = 'clamp-to-edge';
  }
  if (addressModeV === 'mirror-repeat') {
    addressModeV = 'clamp-to-edge';
  }
  let expectedColors: number[][];
  if (addressModeU === 'clamp-to-edge' && addressModeV === 'clamp-to-edge') {
    expectedColors = kExpectedUVClampedLinear;
  }
  if (addressModeU === 'repeat' && addressModeU === 'repeat') {
    expectedColors = kExpectedUVRepeatLinear;
  }
  if (addressModeU === 'repeat' && addressModeV === 'clamp-to-edge') {
    expectedColors = kExpectedVClampedLinear;
  }
  if (addressModeU === 'clamp-to-edge' && addressModeV === 'repeat') {
    expectedColors = kExpectedUClampedLinear;
  }
  return TexelView.fromTexelsAsColors(format, coord => {
    const c = expectedColors[coord.y][coord.x];
    return { R: c, G: c, B: c, A: 1.0 };
  });
}
function expectedColors(
  format: EncodableTextureFormat,
  filterMode: GPUFilterMode,
  addressModeU: GPUAddressMode,
  addressModeV: GPUAddressMode
): TexelView {
  switch (filterMode) {
    case 'nearest':
      return expectedNearestColors(format, addressModeU, addressModeV);
    case 'linear':
      return expectedLinearColors(format, addressModeU, addressModeV);
  }
}

// Simple checkerboard 2x2 texture used as a base for the sampling.
const kCheckerTextureSize = 2;
const kCheckerTextureData = [
  { R: 0.0, G: 0.0, B: 0.0, A: 1.0 },
  { R: 1.0, G: 1.0, B: 1.0, A: 1.0 },
  { R: 1.0, G: 1.0, B: 1.0, A: 1.0 },
  { R: 0.0, G: 0.0, B: 0.0, A: 1.0 },
];

// Different UVs are used between 'linear' and 'nearest' modes. In 'linear' mode, we can just map
// the UVs 1:1 since the outer edges of the quad will get contributions based on the address modes.
// For 'nearest' however, we purposely map the UVs such that the texture bleeds off the sides to
// verify that the address modes are indeed working as intended.
const kLinearUVs = `
const uv = array(
  vec2f(1., 0.), vec2f(1., 1.), vec2f(0., 1.),
  vec2f(1., 0.), vec2f(0., 1.), vec2f(0., 0.),
);`;
const kNearestUVs = `
const uv = array(
  vec2f(1.25, -0.25), vec2f(1.25, 1.25), vec2f(-0.25, 1.25),
  vec2f(1.25, -0.25), vec2f(-0.25, 1.25), vec2f(-0.25, -0.25),
);`;

g.test('magFilter')
  .desc(
    `
  Test that for filterable formats, magFilter mode correctly modifies the sampling.
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
        return (
          kTextureFormatInfo[t.format].color.type === 'float' ||
          kTextureFormatInfo[t.format].color.type === 'unfilterable-float'
        );
      })
      .beginSubcases()
      .combine('filterMode', kFilterModes)
      .combine('addressModeU', kAddressModes)
      .combine('addressModeV', kAddressModes)
  )
  .beforeAllSubcases(t => {
    if (kTextureFormatInfo[t.params.format].color.type === 'unfilterable-float') {
      t.selectDeviceOrSkipTestCase('float32-filterable');
    }
  })
  .fn(t => {
    const { format, filterMode, addressModeU, addressModeV } = t.params;
    // Upscales the 2x2 to a 4x4 texture.
    const kRenderSize = 4;
    const kUVs = filterMode === 'linear' ? kLinearUVs : kNearestUVs;

    const sampler = t.device.createSampler({
      addressModeU,
      addressModeV,
      magFilter: filterMode,
    });
    const sampleTexture = t.createTextureFromTexelView(
      TexelView.fromTexelsAsColors(format, coord => {
        const id = coord.x + coord.y * kCheckerTextureSize;
        return kCheckerTextureData[id];
      }),
      {
        size: [kCheckerTextureSize, kCheckerTextureSize],
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
        ${kUVs}
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
      expectedColors(format, filterMode, addressModeU, addressModeV),
      [kRenderSize, kRenderSize]
    );
  });

g.test('minFilter')
  .desc(
    `
  Test that for filterable formats, minFilter mode correctly modifies the sampling.
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
        return (
          kTextureFormatInfo[t.format].color.type === 'float' ||
          kTextureFormatInfo[t.format].color.type === 'unfilterable-float'
        );
      })
      .beginSubcases()
      .combine('filterMode', kFilterModes)
      .combine('addressModeU', kAddressModes)
      .combine('addressModeV', kAddressModes)
  )
  .beforeAllSubcases(t => {
    if (kTextureFormatInfo[t.params.format].color.type === 'unfilterable-float') {
      t.selectDeviceOrSkipTestCase('float32-filterable');
    }
  })
  .fn(t => {
    const { format, filterMode, addressModeU, addressModeV } = t.params;
    // For each pixel in the render result, a single sub-pixel sized quad is placed such that the
    // center of the pixel corresponds to the region of the texture as if we are upsampling the
    // texture.
    const kRenderSize = 4;
    const kUVs = filterMode === 'linear' ? kLinearUVs : kNearestUVs;

    const sampler = t.device.createSampler({
      addressModeU,
      addressModeV,
      minFilter: filterMode,
    });
    const sampleTexture = t.createTextureFromTexelView(
      TexelView.fromTexelsAsColors(format, coord => {
        const id = coord.x + coord.y * kCheckerTextureSize;
        return kCheckerTextureData[id];
      }),
      {
        size: [kCheckerTextureSize, kCheckerTextureSize],
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
        const grid = vec2f(4., 4.);
        const size = 1. / 2.;

        const constantPlaneOffset = vec2f(3. / 8., 3. / 8.);
        const perPixelOffset = -1. / 4.;

        const pos = array(
          vec2f( size,  size), vec2f( size, -size), vec2f(-size, -size),
          vec2f( size,  size), vec2f(-size, -size), vec2f(-size,  size),
        );
        ${kUVs}

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
    renderPass.draw(6, kRenderSize * kRenderSize);
    renderPass.end();
    t.device.queue.submit([commandEncoder.finish()]);

    t.expectTexelViewComparisonIsOkInTexture(
      { texture: renderTexture },
      expectedColors(format, filterMode, addressModeU, addressModeV),
      [kRenderSize, kRenderSize]
    );
  });

g.test('mipmapFilter')
  .desc(
    `
  Test that for filterable formats, mipmapFilter modes correctly modifies the sampling.
    - format= {<filterable formats>}
    - filterMode= {'nearest', 'linear'}
  `
  )
  .params(u =>
    u
      .combine('format', kRenderableColorTextureFormats)
      .filter(t => {
        return (
          kTextureFormatInfo[t.format].color.type === 'float' ||
          kTextureFormatInfo[t.format].color.type === 'unfilterable-float'
        );
      })
      .beginSubcases()
      .combine('filterMode', kMipmapFilterModes)
  )
  .beforeAllSubcases(t => {
    if (kTextureFormatInfo[t.params.format].color.type === 'unfilterable-float') {
      t.selectDeviceOrSkipTestCase('float32-filterable');
    }
  })
  .fn(t => {
    const { format, filterMode } = t.params;
    // Takes a 8x8/4x4 mipmapped texture and renders it on multiple quads with different UVs such
    // that each instanced quad from left to right emulates moving the quad further and further from
    // the camera. Each quad is then rendered to a single pixel in a 1-dimensional texture. Since
    // the 8x8 is fully black and the 4x4 is fully white, we should see the pixels increase in
    // brightness from left to right when sampling linearly, and jump from black to white when
    // sampling for the nearest mip level.
    const kTextureSize = 8;
    const kRenderSize = 8;

    const sampler = t.device.createSampler({
      mipmapFilter: filterMode,
    });
    const sampleTexture = t.createTextureFromTexelViewsMultipleMipmaps(
      [
        TexelView.fromTexelsAsColors(format, () => {
          return { R: 0.0, G: 0.0, B: 0.0, A: 1.0 };
        }),
        TexelView.fromTexelsAsColors(format, coord => {
          return { R: 1.0, G: 1.0, B: 1.0, A: 1.0 };
        }),
      ],
      {
        size: [kTextureSize, 1],
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      }
    );
    const renderTexture = t.device.createTexture({
      format,
      size: [kRenderSize, 1],
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
        const grid = vec2f(${kRenderSize}., 1.);
        const pos = array(
          vec2f( 1.0,  1.0), vec2f( 1.0, -1.0), vec2f(-1.0, -1.0),
          vec2f( 1.0,  1.0), vec2f(-1.0, -1.0), vec2f(-1.0,  1.0),
        );
        const uv = array(
          vec2f(1., 0.), vec2f(1., 1.), vec2f(0., 1.),
          vec2f(1., 0.), vec2f(0., 1.), vec2f(0., 0.),
        );

        // Compute the offset of the plane.
        let cell = vec2f(f32(ii) % grid.x, 0.);
        let cellOffset = cell / grid * 2;
        let absPos = (pos[vi] + 1) / grid - 1 + cellOffset;
        let uvFactor = (1. / 8.) * (1 + (f32(ii) / (grid.x - 1)));
        return VertexOut(vec4f(absPos, 0.0, 1.0), uv[vi] * uvFactor);
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
    renderPass.draw(6, kRenderSize);
    renderPass.end();
    t.device.queue.submit([commandEncoder.finish()]);

    // Since mipmap filtering varies across different backends, we verify that the result exhibits
    // filtered characteristics without strict value equalities via copies to a buffer.
    const buffer = t.copyWholeTextureToNewBufferSimple(renderTexture, 0);
    t.expectGPUBufferValuesPassCheck(
      buffer,
      actual => {
        // Convert the buffer to texel view so we can do comparisons.
        const layout = getTextureCopyLayout(format, '2d', [kRenderSize, 1, 1]);
        const view = TexelView.fromTextureDataByReference(format, actual, {
          bytesPerRow: layout.bytesPerRow,
          rowsPerImage: layout.rowsPerImage,
          subrectOrigin: [0, 0, 0],
          subrectSize: [kRenderSize, 1, 1],
        });

        // We only check the R component for the conditions, since all components should be equal if
        // specified in the format.
        switch (filterMode) {
          case 'linear': {
            // For 'linear' mode, we check that the resulting 1d image is monotonically increasing.
            for (let x = 1; x < kRenderSize; x++) {
              const { R: Ri } = view.color({ x: x - 1, y: 0, z: 0 });
              const { R: Rj } = view.color({ x, y: 0, z: 0 });
              if (Ri! >= Rj!) {
                return Error(
                  'Linear filtering on mipmaps should be a monotonically increasing sequence:\n' +
                    view.toString(
                      { x: 0, y: 0, z: 0 },
                      { width: kRenderSize, height: 1, depthOrArrayLayers: 1 }
                    )
                );
              }
            }
            break;
          }
          case 'nearest': {
            // For 'nearest' mode, we check that the resulting 1d image changes from 0.0 to 1.0
            // exactly once.
            let changes = 0;
            for (let x = 1; x < kRenderSize; x++) {
              const { R: Ri } = view.color({ x: x - 1, y: 0, z: 0 });
              const { R: Rj } = view.color({ x, y: 0, z: 0 });
              if (Ri! !== Rj!) {
                changes++;
              }
            }
            if (changes !== 1) {
              return Error(
                `Nearest filtering on mipmaps should change exacly once but found (${changes}):\n` +
                  view.toString(
                    { x: 0, y: 0, z: 0 },
                    { width: kRenderSize, height: 1, depthOrArrayLayers: 1 }
                  )
              );
            }
            break;
          }
        }
        return undefined;
      },
      { srcByteOffset: 0, type: Uint8Array, typedLength: buffer.size }
    );
  });
