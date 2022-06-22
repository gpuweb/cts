export const description = `
Tests for capability checking for features enabling optional texture formats.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { assert } from '../../../../../common/util/util.js';
import { kAllTextureFormats, kTextureFormatInfo } from '../../../../capability_info.js';
import { kAllCanvasTypes, createCanvas } from '../../../../util/create_elements.js';
import { ValidationTest } from '../../validation_test.js';

export const g = makeTestGroup(ValidationTest);

const kOptionalTextureFormats = kAllTextureFormats.filter(
  t => kTextureFormatInfo[t].feature !== undefined
);

g.test('texture_descriptor')
  .desc(
    `
  Test creating a texture with an optional texture format will fail if the required optional feature
  is not enabled.
  `
  )
  .params(u =>
    u.combine('format', kOptionalTextureFormats).combine('enable_required_feature', [true, false])
  )
  .beforeAllSubcases(t => {
    const { format, enable_required_feature } = t.params;

    const formatInfo = kTextureFormatInfo[format];
    if (enable_required_feature) {
      t.selectDeviceOrSkipTestCase(formatInfo.feature);
    }
  })
  .fn(async t => {
    const { format, enable_required_feature } = t.params;

    const formatInfo = kTextureFormatInfo[format];
    t.shouldThrow(enable_required_feature ? false : 'TypeError', () => {
      t.device.createTexture({
        format,
        size: [formatInfo.blockWidth, formatInfo.blockHeight, 1] as const,
        usage: GPUTextureUsage.TEXTURE_BINDING,
      });
    });
  });

g.test('texture_descriptor_view_formats')
  .desc(
    `
  Test creating a texture with view formats that have an optional texture format will fail if the
  required optional feature is not enabled.
  `
  )
  .params(u =>
    u.combine('format', kOptionalTextureFormats).combine('enable_required_feature', [true, false])
  )
  .beforeAllSubcases(t => {
    const { format, enable_required_feature } = t.params;

    const formatInfo = kTextureFormatInfo[format];
    if (enable_required_feature) {
      t.selectDeviceOrSkipTestCase(formatInfo.feature);
    }
  })
  .fn(async t => {
    const { format, enable_required_feature } = t.params;

    const formatInfo = kTextureFormatInfo[format];
    t.shouldThrow(enable_required_feature ? false : 'TypeError', () => {
      t.device.createTexture({
        format,
        size: [formatInfo.blockWidth, formatInfo.blockHeight, 1] as const,
        usage: GPUTextureUsage.TEXTURE_BINDING,
        viewFormats: [format],
      });
    });
  });

g.test('texture_view_descriptor')
  .desc(
    `
  Test creating a texture view with all texture formats will fail if the required optional feature
  is not enabled.
  `
  )
  .params(u =>
    u.combine('format', kOptionalTextureFormats).combine('enable_required_feature', [true, false])
  )
  .beforeAllSubcases(t => {
    const { format, enable_required_feature } = t.params;

    const formatInfo = kTextureFormatInfo[format];
    if (enable_required_feature) {
      t.selectDeviceOrSkipTestCase(formatInfo.feature);
    }
  })
  .fn(async t => {
    const { format, enable_required_feature } = t.params;

    const formatInfo = kTextureFormatInfo[format];
    const testTexture = t.device.createTexture({
      format,
      size: [formatInfo.blockWidth, formatInfo.blockHeight, 1] as const,
      usage: GPUTextureUsage.TEXTURE_BINDING,
    });
    const testViewDesc: GPUTextureViewDescriptor = {
      format,
      dimension: '2d',
      aspect: 'all',
      arrayLayerCount: 1,
      baseMipLevel: 0,
      mipLevelCount: 1,
      baseArrayLayer: 0,
    };
    t.shouldThrow(enable_required_feature ? false : 'TypeError', () => {
      testTexture.createView(testViewDesc);
    });
  });

g.test('canvas_configuration')
  .desc(
    `
  Test configuring a canvas with optional texture formats will throw an exception if the required
  optional feature is not enabled. Otherwise, a validation error should be generated instead of
  throwing an exception.
  `
  )
  .params(u =>
    u
      .combine('format', kOptionalTextureFormats)
      .combine('canvasType', kAllCanvasTypes)
      .combine('enable_required_feature', [true, false])
  )
  .beforeAllSubcases(t => {
    const { format, enable_required_feature } = t.params;

    const formatInfo = kTextureFormatInfo[format];
    if (enable_required_feature) {
      t.selectDeviceOrSkipTestCase(formatInfo.feature);
    }
  })
  .fn(async t => {
    const { format, canvasType, enable_required_feature } = t.params;

    const canvas = createCanvas(t, canvasType, 2, 2);
    const ctx = canvas.getContext('webgpu' as const);
    assert(ctx !== null, 'Failed to get WebGPU context from canvas');

    const canvasConf = {
      device: t.device,
      format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    };

    if (enable_required_feature) {
      t.expectValidationError(() => {
        ctx.configure(canvasConf);
      });
    } else {
      t.shouldThrow('TypeError', () => {
        ctx.configure(canvasConf);
      });
    }
  });

g.test('storage_texture_binding_layout')
  .desc(
    `
  Test creating a GPUStorageTextureBindingLayout with an optional texture format will fail if the
  required optional feature are not enabled.

  Note: This test has no cases if there are no optional texture formats supporting storage.
  `
  )
  .params(u =>
    u
      .combine('format', kOptionalTextureFormats)
      .filter(t => kTextureFormatInfo[t.format].storage)
      .combine('enable_required_feature', [true, false])
  )
  .beforeAllSubcases(t => {
    const { format, enable_required_feature } = t.params;

    const formatInfo = kTextureFormatInfo[format];
    if (enable_required_feature) {
      t.selectDeviceOrSkipTestCase(formatInfo.feature);
    }
  })
  .fn(async t => {
    const { format, enable_required_feature } = t.params;

    t.shouldThrow(enable_required_feature ? false : 'TypeError', () => {
      t.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
              format,
            },
          },
        ],
      });
    });
  });

g.test('color_target_state')
  .desc(
    `
  Test creating a render pipeline with an optional texture format set in GPUColorTargetState will
  fail if the required optional feature is not enabled.

  Note: This test has no cases if there are no optional texture formats supporting color rendering.
  `
  )
  .params(u =>
    u
      .combine('format', kOptionalTextureFormats)
      .filter(t => kTextureFormatInfo[t.format].renderable && kTextureFormatInfo[t.format].color)
      .combine('enable_required_feature', [true, false])
  )
  .beforeAllSubcases(t => {
    const { format, enable_required_feature } = t.params;

    const formatInfo = kTextureFormatInfo[format];
    if (enable_required_feature) {
      t.selectDeviceOrSkipTestCase(formatInfo.feature);
    }
  })
  .fn(async t => {
    const { format, enable_required_feature } = t.params;

    t.shouldThrow(enable_required_feature ? false : 'TypeError', () => {
      t.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: t.device.createShaderModule({
            code: `
              @vertex
              fn main()-> @builtin(position) vec4<f32> {
                return vec4<f32>(0.0, 0.0, 0.0, 1.0);
              }`,
          }),
          entryPoint: 'main',
        },
        fragment: {
          module: t.device.createShaderModule({
            code: `
              @fragment
              fn main() -> @location(0) vec4<f32> {
                return vec4<f32>(0.0, 1.0, 0.0, 1.0);
              }`,
          }),
          entryPoint: 'main',
          targets: [{ format }],
        },
      });
    });
  });

g.test('depth_stencil_state')
  .desc(
    `
  Test creating a render pipeline with an optional texture format set in GPUColorTargetState will
  fail if the required optional feature is not enabled.
  `
  )
  .params(u =>
    u
      .combine('format', kOptionalTextureFormats)
      .filter(
        t =>
          kTextureFormatInfo[t.format].renderable &&
          (kTextureFormatInfo[t.format].depth || kTextureFormatInfo[t.format].stencil)
      )
      .combine('enable_required_feature', [true, false])
  )
  .beforeAllSubcases(t => {
    const { format, enable_required_feature } = t.params;

    const formatInfo = kTextureFormatInfo[format];
    if (enable_required_feature) {
      t.selectDeviceOrSkipTestCase(formatInfo.feature);
    }
  })
  .fn(async t => {
    const { format, enable_required_feature } = t.params;

    t.shouldThrow(enable_required_feature ? false : 'TypeError', () => {
      t.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: t.device.createShaderModule({
            code: `
              @vertex
              fn main()-> @builtin(position) vec4<f32> {
                return vec4<f32>(0.0, 0.0, 0.0, 1.0);
              }`,
          }),
          entryPoint: 'main',
        },
        depthStencil: {
          format,
        },
        fragment: {
          module: t.device.createShaderModule({
            code: `
              @fragment
              fn main() -> @location(0) vec4<f32> {
                return vec4<f32>(0.0, 1.0, 0.0, 1.0);
              }`,
          }),
          entryPoint: 'main',
          targets: [{ format: 'rgba8unorm' }],
        },
      });
    });
  });

g.test('render_bundle_encoder_descriptor_color_format')
  .desc(
    `
  Test creating a render bundle encoder with an optional texture format set as one of the color
  format will fail if the required optional feature is not enabled.

  Note: This test has no cases if there are no optional texture formats supporting color rendering.
  `
  )
  .params(u =>
    u
      .combine('format', kOptionalTextureFormats)
      .filter(t => kTextureFormatInfo[t.format].renderable && kTextureFormatInfo[t.format].color)
      .combine('enable_required_feature', [true, false])
  )
  .beforeAllSubcases(t => {
    const { format, enable_required_feature } = t.params;

    const formatInfo = kTextureFormatInfo[format];
    if (enable_required_feature) {
      t.selectDeviceOrSkipTestCase(formatInfo.feature);
    }
  })
  .fn(async t => {
    const { format, enable_required_feature } = t.params;

    t.shouldThrow(enable_required_feature ? false : 'TypeError', () => {
      t.device.createRenderBundleEncoder({
        colorFormats: [format],
      });
    });
  });

g.test('render_bundle_encoder_descriptor_depth_stencil_format')
  .desc(
    `
  Test creating a render bundle encoder with an optional texture format set as the depth stencil
  format will fail if the required optional feature is not enabled.
  `
  )
  .params(u =>
    u
      .combine('format', kOptionalTextureFormats)
      .filter(
        t =>
          kTextureFormatInfo[t.format].renderable &&
          (kTextureFormatInfo[t.format].depth || kTextureFormatInfo[t.format].stencil)
      )
      .combine('enable_required_feature', [true, false])
  )
  .beforeAllSubcases(t => {
    const { format, enable_required_feature } = t.params;

    const formatInfo = kTextureFormatInfo[format];
    if (enable_required_feature) {
      t.selectDeviceOrSkipTestCase(formatInfo.feature);
    }
  })
  .fn(async t => {
    const { format, enable_required_feature } = t.params;

    t.shouldThrow(enable_required_feature ? false : 'TypeError', () => {
      t.device.createRenderBundleEncoder({
        colorFormats: ['rgba8unorm'],
        depthStencilFormat: format,
      });
    });
  });
