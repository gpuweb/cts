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
import { kTextureFormatInfo } from '../../../capability_info.js';
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
    } = {}
  ): GPUTexture {
    const {
      width = 32,
      height = 32,
      arrayLayerCount = 1,
      mipLevelCount = 1,
      sampleCount = 1,
      format = 'rgba8unorm',
    } = options;

    return this.device.createTexture({
      size: { width, height, depth: arrayLayerCount },
      mipLevelCount,
      sampleCount,
      dimension: '2d',
      format,
      usage: GPUTextureUsage.OUTPUT_ATTACHMENT | GPUTextureUsage.SAMPLED,
    });
  }
}

export const g = makeTestGroup(TextureUsageTracking);

const READ_BASE_LEVEL = 3;
const READ_BASE_LAYER = 0;

g.test('readwrite_upon_subresources')
  .params([
    // read and write usages are binding to the same texture subresource.
    {
      writeBaseLevel: READ_BASE_LEVEL,
      writeBaseLayer: READ_BASE_LAYER,
      _success: false,
    },

    // read and write usages are binding to different mip levels of the same texture.
    {
      writeBaseLevel: READ_BASE_LEVEL + 1,
      writeBaseLayer: READ_BASE_LAYER,
      _success: true,
    },

    // read and write usages are binding to different array layers of the same texture.
    {
      writeBaseLevel: READ_BASE_LEVEL,
      writeBaseLayer: READ_BASE_LAYER + 1,
      _success: true,
    },
  ])
  .fn(async t => {
    const { writeBaseLevel, writeBaseLayer, _success } = t.params;

    const texture = t.createTexture({ arrayLayerCount: 2, mipLevelCount: 6 });

    const sampleView = texture.createView({
      baseMipLevel: READ_BASE_LEVEL,
      mipLevelCount: 1,
      baseArrayLayer: READ_BASE_LAYER,
      arrayLayerCount: 1,
    });
    const renderView = texture.createView({
      baseMipLevel: writeBaseLevel,
      mipLevelCount: 1,
      baseArrayLayer: writeBaseLayer,
      arrayLayerCount: 1,
    });

    const bindGroupLayout = t.device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, type: 'sampled-texture' }],
    });

    const bindGroup = t.device.createBindGroup({
      entries: [{ binding: 0, resource: sampleView }],
      layout: bindGroupLayout,
    });

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          attachment: renderView,
          loadValue: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
          storeOp: 'store',
        },
      ],
    });
    pass.setBindGroup(0, bindGroup);
    pass.endPass();

    t.expectValidationError(() => {
      encoder.finish();
    }, !_success);
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
