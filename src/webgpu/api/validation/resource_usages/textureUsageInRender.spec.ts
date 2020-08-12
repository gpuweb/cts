export const description = `
Texture Usages Validation Tests in Render Pass.

Test Coverage:
 - Tests that read and write usages upon the same texture subresource, or different subresources
   of the same texture. Different subresources of the same texture includes different mip levels,
   different array layers, and different aspects.
   - When read and write usages are binding to the same texture subresource, an error should be
     generated. Otherwise, no error should be generated.
`;

import { poptions, params } from '../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { kTextureFormatInfo, kShaderStages } from '../../../capability_info.js';
import { ValidationTest } from '../validation_test.js';

class TextureUsageTracking extends ValidationTest {
  createTexture(
    options: {
      width?: number;
      height?: number;
      arrayLayerCount?: number;
      mipLevelCount?: number;
      sampleCount?: number;
      format?: GPUTextureFormat;
      usage?: GPUTextureUsageFlags;
    } = {}
  ): GPUTexture {
    const {
      width = 32,
      height = 32,
      arrayLayerCount = 1,
      mipLevelCount = 1,
      sampleCount = 1,
      format = 'rgba8unorm',
      usage = GPUTextureUsage.OUTPUT_ATTACHMENT | GPUTextureUsage.SAMPLED,
    } = options;

    return this.device.createTexture({
      size: { width, height, depth: arrayLayerCount },
      mipLevelCount,
      sampleCount,
      dimension: '2d',
      format,
      usage,
    });
  }
}

export const g = makeTestGroup(TextureUsageTracking);

const BASE_LEVEL = 3;
const BASE_LAYER = 0;
const TOTAL_LEVELS = 6;
const TOTAL_LAYERS = 2;

g.test('subresources_and_binding_types_combination_for_color')
  .params(
    params()
      .combine([
        // Two texture usages are binding to the same texture subresource.
        {
          baseLevel: BASE_LEVEL,
          baseLayer: BASE_LAYER,
          levelCount: 1,
          layerCount: 1,
          _resourceSuccess: false,
        },

        // Two texture usages are binding to different mip levels of the same texture.
        {
          baseLevel: BASE_LEVEL + 1,
          baseLayer: BASE_LAYER,
          levelCount: 1,
          layerCount: 1,
          _resourceSuccess: true,
        },

        // Two texture usages are binding to different array layers of the same texture.
        {
          baseLevel: BASE_LEVEL,
          baseLayer: BASE_LAYER + 1,
          levelCount: 1,
          layerCount: 1,
          _resourceSuccess: true,
        },

        // The second texture usage contains the whole mip chain where the first texture usage is using.
        {
          baseLevel: 0,
          baseLayer: BASE_LAYER,
          levelCount: TOTAL_LEVELS,
          layerCount: 1,
          _resourceSuccess: false,
        },

        // The second texture usage contains the all layers where the first texture usage is using.
        {
          baseLevel: BASE_LEVEL,
          baseLayer: 0,
          levelCount: 1,
          layerCount: TOTAL_LAYERS,
          _resourceSuccess: false,
        },
      ])
      .combine([
        {
          type0: 'sampled-texture',
          type1: 'sampled-texture',
          _usageSuccess: true,
        },
        {
          type0: 'sampled-texture',
          type1: 'readonly-storage-texture',
          _usageSuccess: true,
        },
        {
          type0: 'sampled-texture',
          type1: 'writeonly-storage-texture',
          _usageSuccess: false,
        },
        {
          type0: 'sampled-texture',
          type1: 'render-target',
          _usageSuccess: false,
        },
        {
          type0: 'readonly-storage-texture',
          type1: 'readonly-storage-texture',
          _usageSuccess: true,
        },
        {
          type0: 'readonly-storage-texture',
          type1: 'writeonly-storage-texture',
          _usageSuccess: false,
        },
        {
          type0: 'readonly-storage-texture',
          type1: 'render-target',
          _usageSuccess: false,
        },
        // Race condition upon multiple writable storage texture is valid.
        {
          type0: 'writeonly-storage-texture',
          type1: 'writeonly-storage-texture',
          _usageSuccess: true,
        },
        {
          type0: 'writeonly-storage-texture',
          type1: 'render-target',
          _usageSuccess: false,
        },
      ] as const)
  )
  .fn(async t => {
    const {
      baseLevel,
      baseLayer,
      levelCount,
      layerCount,
      type0,
      type1,
      _usageSuccess,
      _resourceSuccess,
    } = t.params;

    const texture = t.createTexture({
      arrayLayerCount: TOTAL_LAYERS,
      mipLevelCount: TOTAL_LEVELS,
      usage: GPUTextureUsage.SAMPLED | GPUTextureUsage.STORAGE | GPUTextureUsage.OUTPUT_ATTACHMENT,
    });

    const view0 = texture.createView({
      baseMipLevel: BASE_LEVEL,
      mipLevelCount: 1,
      baseArrayLayer: BASE_LAYER,
      arrayLayerCount: 1,
    });

    const view1Dimension = layerCount !== 1 ? '2d-array' : '2d';
    const view1 = texture.createView({
      dimension: view1Dimension,
      baseMipLevel: baseLevel,
      mipLevelCount: levelCount,
      baseArrayLayer: baseLayer,
      arrayLayerCount: layerCount,
    });

    const bglEntries: GPUBindGroupLayoutEntry[] = [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        type: type0,
        // Currently setting two 'render-target' usages in the same render pass is impossible.
        // We don't need to test that. So type0 is either 'sampled-texture' or storage usages.
        // It can't be 'render-target'.
        storageTextureFormat: type0 === 'sampled-texture' ? undefined : 'rgba8unorm',
      },
    ];
    const bgEntries: GPUBindGroupEntry[] = [{ binding: 0, resource: view0 }];
    if (type1 !== 'render-target') {
      bglEntries.push({
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        type: type1,
        viewDimension: view1Dimension,
        storageTextureFormat: type1 === 'sampled-texture' ? undefined : 'rgba8unorm',
      });
      bgEntries.push({ binding: 1, resource: view1 });
    }
    const bindGroup = t.device.createBindGroup({
      entries: bgEntries,
      layout: t.device.createBindGroupLayout({ entries: bglEntries }),
    });

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          attachment: type1 === 'render-target' ? view1 : t.createTexture().createView(),
          loadValue: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
          storeOp: 'store',
        },
      ],
    });
    pass.setBindGroup(0, bindGroup);
    pass.endPass();

    const success = _resourceSuccess || _usageSuccess;
    t.expectValidationError(() => {
      encoder.finish();
    }, !success);
  });

g.test('readwrite_upon_aspects')
  .params(
    params()
      .combine(poptions('format', ['depth32float', 'depth24plus', 'depth24plus-stencil8'] as const))
      .combine(poptions('readAspect', ['all', 'depth-only', 'stencil-only'] as const))
      .combine(poptions('writeAspect', ['all', 'depth-only', 'stencil-only'] as const))
      .unless(
        ({ format, readAspect, writeAspect }) =>
          // TODO: Exclude depth-only aspect once WebGPU supports stencil-only texture format(s).
          (readAspect === 'stencil-only' && !kTextureFormatInfo[format].stencil) ||
          (writeAspect === 'stencil-only' && !kTextureFormatInfo[format].stencil)
      )
  )
  .fn(async t => {
    const { format, readAspect, writeAspect } = t.params;

    const view = t.createTexture({ format }).createView();

    const bindGroupLayout = t.device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, type: 'sampled-texture' }],
    });

    const bindGroup = t.device.createBindGroup({
      entries: [{ binding: 0, resource: view }],
      layout: bindGroupLayout,
    });

    const success =
      (readAspect === 'depth-only' && writeAspect === 'stencil-only') ||
      (readAspect === 'stencil-only' && writeAspect === 'depth-only');

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          attachment: t.createTexture().createView(),
          loadValue: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        attachment: view,
        depthStoreOp: 'clear',
        depthLoadValue: 'load',
        stencilStoreOp: 'clear',
        stencilLoadValue: 'load',
      },
    });
    pass.setBindGroup(0, bindGroup);
    pass.endPass();

    t.expectValidationError(() => {
      encoder.finish();
    }, !success);
  });

g.test('shader_stages_and_visibility')
  .params(
    params()
      .combine(poptions('readVisibility', [0, ...kShaderStages]))
      .combine(poptions('writeVisibility', [0, ...kShaderStages]))
  )
  .fn(async t => {
    const { readVisibility, writeVisibility } = t.params;

    // writeonly-storage-texture binding type is not supported in vertex stage. So, this test
    // uses writeonly-storage-texture binding as writable binding upon the same subresource if
    // vertex stage is not included. Otherwise, it uses output attachment instead.
    const writeHasVertexStage = Boolean(writeVisibility & GPUShaderStage.VERTEX);
    const texUsage = writeHasVertexStage
      ? GPUTextureUsage.SAMPLED | GPUTextureUsage.OUTPUT_ATTACHMENT
      : GPUTextureUsage.SAMPLED | GPUTextureUsage.STORAGE;

    const texture = t.createTexture({ usage: texUsage });
    const view = texture.createView();
    const bglEntries: GPUBindGroupLayoutEntry[] = [
      { binding: 0, visibility: readVisibility, type: 'sampled-texture' },
    ];
    const bgEntries: GPUBindGroupEntry[] = [{ binding: 0, resource: view }];
    if (!writeHasVertexStage) {
      bglEntries.push({
        binding: 1,
        visibility: writeVisibility,
        type: 'writeonly-storage-texture',
        storageTextureFormat: 'rgba8unorm',
      });
      bgEntries.push({ binding: 1, resource: view });
    }
    const bindGroup = t.device.createBindGroup({
      entries: bgEntries,
      layout: t.device.createBindGroupLayout({ entries: bglEntries }),
    });

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          attachment: writeHasVertexStage ? view : t.createTexture().createView(),
          loadValue: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
          storeOp: 'store',
        },
      ],
    });
    pass.setBindGroup(0, bindGroup);
    pass.endPass();

    // Texture usages in bindings with invisible shader stages should be tracked. Invisible shader
    // stages include shader stage with visibility none and compute shader stage in render pass.
    t.expectValidationError(() => {
      encoder.finish();
    });
  });
