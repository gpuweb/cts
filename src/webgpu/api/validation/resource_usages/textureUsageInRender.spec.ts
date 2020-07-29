export const description = `
Texture Usages Validation Tests in Render Pass.

Test Coverage:
 - Tests that read and write usages upon the same texture subresource, or different subresources
   of the same texture. Different subresources of the same texture includes different mip levels,
   different array layers, and different aspects.
   - When read and write usages are binding to the same texture subresource, an error should be
     generated. Otherwise, no error should be generated.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ValidationTest } from '../validation_test.js';

const READ_BASE_LEVEL = 3;
const READ_BASE_LAYER = 0;

class F extends ValidationTest {
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

  getDescriptor(
    options: {
      format?: GPUTextureFormat;
      dimension?: GPUTextureViewDimension;
      aspect?: GPUTextureAspect;
      baseMipLevel?: number;
      mipLevelCount?: number;
      baseArrayLayer?: number;
      arrayLayerCount?: number;
    } = {}
  ): GPUTextureViewDescriptor {
    const {
      format = 'rgba8unorm',
      dimension = '2d',
      aspect = 'all',
      baseMipLevel = 0,
      mipLevelCount = 1,
      baseArrayLayer = 0,
      arrayLayerCount = 1,
    } = options;
    return {
      format,
      dimension,
      aspect,
      baseMipLevel,
      mipLevelCount,
      baseArrayLayer,
      arrayLayerCount,
    };
  }
}

export const g = makeTestGroup(F);

g.test('readwrite_on_different_types_of_subresources')
  .params([
    // read and write usages are binding to the same texture subresource.
    {
      format: 'rgba8unorm' as const,
      writeBaseLevel: READ_BASE_LEVEL,
      writeBaseLayer: READ_BASE_LAYER,
      writeAspect: 'all' as const,
      success: false,
    },

    // read and write usages are binding to different mip levels of the same texture.
    {
      format: 'rgba8unorm' as const,
      writeBaseLevel: READ_BASE_LEVEL + 1,
      writeBaseLayer: READ_BASE_LAYER,
      writeAspect: 'all' as const,
      success: true,
    },

    // read and write usages are binding to different array layers of the same texture.
    {
      format: 'rgba8unorm' as const,
      writeBaseLevel: READ_BASE_LEVEL,
      writeBaseLayer: READ_BASE_LAYER + 1,
      writeAspect: 'all' as const,
      success: true,
    },

    // read and write usages are binding to different aspects of the same texture.
    {
      format: 'depth24plus-stencil8' as const,
      writeBaseLevel: READ_BASE_LEVEL,
      writeBaseLayer: READ_BASE_LAYER,
      writeAspect: 'stencil-only' as const,
      success: true,
    },
  ])
  .fn(async t => {
    const { format, writeBaseLevel, writeBaseLayer, writeAspect, success } = t.params;

    const texture = t.createTexture({ arrayLayerCount: 2, mipLevelCount: 6, format });
    const readAspect = format === 'depth24plus-stencil8' ? 'depth-only' : 'all';

    const sampleView = texture.createView(
      t.getDescriptor({
        format,
        aspect: readAspect,
        baseMipLevel: READ_BASE_LEVEL,
        baseArrayLayer: READ_BASE_LAYER,
      })
    );
    const renderView = texture.createView(
      t.getDescriptor({
        format,
        aspect: writeAspect,
        baseMipLevel: writeBaseLevel,
        baseArrayLayer: writeBaseLayer,
      })
    );

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
          attachment:
            format !== 'depth24plus-stencil8' ? renderView : t.createTexture().createView(),
          loadValue: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
          storeOp: 'store',
        },
      ],
      depthStencilAttachment:
        format !== 'depth24plus-stencil8'
          ? undefined
          : {
              attachment: renderView,
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
