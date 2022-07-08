export const description = `
render pass descriptor validation tests.

TODO: per-test descriptions, make test names more succinct
TODO: review for completeness
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import {
  kDepthStencilFormats,
  kRenderableColorTextureFormats,
  kTextureFormatInfo,
} from '../../../capability_info.js';
import { ValidationTest } from '../validation_test.js';

class F extends ValidationTest {
  createTexture(
    options: {
      format?: GPUTextureFormat;
      width?: number;
      height?: number;
      arrayLayerCount?: number;
      mipLevelCount?: number;
      sampleCount?: number;
      usage?: GPUTextureUsageFlags;
    } = {}
  ): GPUTexture {
    const {
      format = 'rgba8unorm',
      width = 16,
      height = 16,
      arrayLayerCount = 1,
      mipLevelCount = 1,
      sampleCount = 1,
      usage = GPUTextureUsage.RENDER_ATTACHMENT,
    } = options;

    return this.device.createTexture({
      size: { width, height, depthOrArrayLayers: arrayLayerCount },
      format,
      mipLevelCount,
      sampleCount,
      usage,
    });
  }

  getColorAttachment(
    texture: GPUTexture,
    textureViewDescriptor?: GPUTextureViewDescriptor
  ): GPURenderPassColorAttachment {
    const view = texture.createView(textureViewDescriptor);

    return {
      view,
      clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
      loadOp: 'clear',
      storeOp: 'store',
    };
  }

  getDepthStencilAttachment(
    texture: GPUTexture,
    textureViewDescriptor?: GPUTextureViewDescriptor
  ): GPURenderPassDepthStencilAttachment {
    const view = texture.createView(textureViewDescriptor);

    return {
      view,
      depthClearValue: 1.0,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
      stencilClearValue: 0,
      stencilLoadOp: 'clear',
      stencilStoreOp: 'store',
    };
  }

  tryRenderPass(success: boolean, descriptor: GPURenderPassDescriptor): void {
    const commandEncoder = this.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass(descriptor);
    renderPass.end();

    this.expectValidationError(() => {
      commandEncoder.finish();
    }, !success);
  }
}

export const g = makeTestGroup(F);

g.test('attachments,one_color_attachment')
  .desc(`Test that a render pass works with only one color attachment.`)
  .fn(t => {
    const colorTexture = t.createTexture({ format: 'rgba8unorm' });
    const descriptor = {
      colorAttachments: [t.getColorAttachment(colorTexture)],
    };

    t.tryRenderPass(true, descriptor);
  });

g.test('attachments,one_depth_stencil_attachment')
  .desc(`Test that a render pass works with only one depthStencil attachment.`)
  .fn(t => {
    const depthStencilTexture = t.createTexture({ format: 'depth24plus-stencil8' });
    const descriptor = {
      colorAttachments: [],
      depthStencilAttachment: t.getDepthStencilAttachment(depthStencilTexture),
    };

    t.tryRenderPass(true, descriptor);
  });

g.test('color_attachments,empty')
  .desc(
    `
  Test that when colorAttachments has all values be 'undefined' or the sequence is empty, the
  depthStencilAttachment must not be 'undefined'.
  `
  )
  .paramsSubcasesOnly(u =>
    u
      .combine('colorAttachments', [
        [],
        [undefined],
        [undefined, undefined],
        new Array(8).fill(undefined),
        [{ format: 'rgba8unorm' }],
      ])
      .combine('hasDepthStencilAttachment', [false, true])
  )
  .fn(async t => {
    const { colorAttachments, hasDepthStencilAttachment } = t.params;

    let isEmptyColorTargets = true;
    for (let i = 0; i < colorAttachments.length; i++) {
      if (colorAttachments[i] !== undefined) {
        isEmptyColorTargets = false;
        const colorTexture = t.createTexture();
        colorAttachments[i] = t.getColorAttachment(colorTexture);
      }
    }

    const _success = !isEmptyColorTargets || hasDepthStencilAttachment;
    t.tryRenderPass(_success, {
      colorAttachments,
      depthStencilAttachment: hasDepthStencilAttachment
        ? t.getDepthStencilAttachment(t.createTexture({ format: 'depth24plus-stencil8' }))
        : undefined,
    });
  });

g.test('color_attachments,out_of_bounds')
  .desc(
    `
  Test that the out of bound of color attachment indexes are handled.
    - a validation error is generated when color attachments exceed the maximum limit(8).
  `
  )
  .paramsSimple([
    { colorAttachmentsCount: 8, _success: true }, // Control case
    { colorAttachmentsCount: 9, _success: false }, // Out of bounds
  ])
  .fn(async t => {
    const { colorAttachmentsCount, _success } = t.params;

    const colorAttachments = [];
    for (let i = 0; i < colorAttachmentsCount; i++) {
      const colorTexture = t.createTexture();
      colorAttachments.push(t.getColorAttachment(colorTexture));
    }

    t.tryRenderPass(_success, { colorAttachments });
  });

g.test('attachments,same_size')
  .desc(
    `
  Test that attachments have the same size. Otherwise, a validation error should be generated.
    - Succeed if all attachments have the same size.
    - Fail if one of the color attachments has a different size.
    - Fail if the depth stencil attachment has a different size.
  `
  )
  .fn(async t => {
    const colorTexture1x1A = t.createTexture({ width: 1, height: 1, format: 'rgba8unorm' });
    const colorTexture1x1B = t.createTexture({ width: 1, height: 1, format: 'rgba8unorm' });
    const colorTexture2x2 = t.createTexture({ width: 2, height: 2, format: 'rgba8unorm' });
    const depthStencilTexture1x1 = t.createTexture({
      width: 1,
      height: 1,
      format: 'depth24plus-stencil8',
    });
    const depthStencilTexture2x2 = t.createTexture({
      width: 2,
      height: 2,
      format: 'depth24plus-stencil8',
    });

    {
      // Control case: all the same size (1x1)
      const descriptor: GPURenderPassDescriptor = {
        colorAttachments: [
          t.getColorAttachment(colorTexture1x1A),
          t.getColorAttachment(colorTexture1x1B),
        ],
        depthStencilAttachment: t.getDepthStencilAttachment(depthStencilTexture1x1),
      };

      t.tryRenderPass(true, descriptor);
    }
    {
      // One of the color attachments has a different size
      const descriptor: GPURenderPassDescriptor = {
        colorAttachments: [
          t.getColorAttachment(colorTexture1x1A),
          t.getColorAttachment(colorTexture2x2),
        ],
      };

      t.tryRenderPass(false, descriptor);
    }
    {
      // The depth stencil attachment has a different size
      const descriptor: GPURenderPassDescriptor = {
        colorAttachments: [
          t.getColorAttachment(colorTexture1x1A),
          t.getColorAttachment(colorTexture1x1B),
        ],
        depthStencilAttachment: t.getDepthStencilAttachment(depthStencilTexture2x2),
      };

      t.tryRenderPass(false, descriptor);
    }
  });

g.test('attachments,color_depth_mismatch')
  .desc(`Test that attachments match whether they are used for color or depth stencil.`)
  .fn(async t => {
    const colorTexture = t.createTexture({ format: 'rgba8unorm' });
    const depthStencilTexture = t.createTexture({ format: 'depth24plus-stencil8' });

    {
      // Using depth-stencil for color
      const descriptor: GPURenderPassDescriptor = {
        colorAttachments: [t.getColorAttachment(depthStencilTexture)],
      };

      t.tryRenderPass(false, descriptor);
    }
    {
      // Using color for depth-stencil
      const descriptor: GPURenderPassDescriptor = {
        colorAttachments: [],
        depthStencilAttachment: t.getDepthStencilAttachment(colorTexture),
      };

      t.tryRenderPass(false, descriptor);
    }
  });

g.test('attachments,layer_count')
  .desc(
    `
  Test the layer counts for color or depth stencil.
    - Fail if using 2D array texture view with arrayLayerCount > 1.
    - Succeed if using 2D array texture view that covers the first layer of the texture.
    - Succeed if using 2D array texture view that covers the last layer for depth stencil.
  `
  )
  .paramsSimple([
    { arrayLayerCount: 5, baseArrayLayer: 0, _success: false },
    { arrayLayerCount: 1, baseArrayLayer: 0, _success: true },
    { arrayLayerCount: 1, baseArrayLayer: 9, _success: true },
  ])
  .fn(async t => {
    const { arrayLayerCount, baseArrayLayer, _success } = t.params;

    const ARRAY_LAYER_COUNT = 10;
    const MIP_LEVEL_COUNT = 1;
    const COLOR_FORMAT = 'rgba8unorm';
    const DEPTH_STENCIL_FORMAT = 'depth24plus-stencil8';

    const colorTexture = t.createTexture({
      format: COLOR_FORMAT,
      width: 32,
      height: 32,
      mipLevelCount: MIP_LEVEL_COUNT,
      arrayLayerCount: ARRAY_LAYER_COUNT,
    });
    const depthStencilTexture = t.createTexture({
      format: DEPTH_STENCIL_FORMAT,
      width: 32,
      height: 32,
      mipLevelCount: MIP_LEVEL_COUNT,
      arrayLayerCount: ARRAY_LAYER_COUNT,
    });

    const baseTextureViewDescriptor: GPUTextureViewDescriptor = {
      dimension: '2d-array',
      baseArrayLayer,
      arrayLayerCount,
      baseMipLevel: 0,
      mipLevelCount: MIP_LEVEL_COUNT,
    };

    {
      // Check 2D array texture view for color
      const textureViewDescriptor: GPUTextureViewDescriptor = {
        ...baseTextureViewDescriptor,
        format: COLOR_FORMAT,
      };

      const descriptor: GPURenderPassDescriptor = {
        colorAttachments: [t.getColorAttachment(colorTexture, textureViewDescriptor)],
      };

      t.tryRenderPass(_success, descriptor);
    }
    {
      // Check 2D array texture view for depth stencil
      const textureViewDescriptor: GPUTextureViewDescriptor = {
        ...baseTextureViewDescriptor,
        format: DEPTH_STENCIL_FORMAT,
      };

      const descriptor: GPURenderPassDescriptor = {
        colorAttachments: [],
        depthStencilAttachment: t.getDepthStencilAttachment(
          depthStencilTexture,
          textureViewDescriptor
        ),
      };

      t.tryRenderPass(_success, descriptor);
    }
  });

g.test('attachments,mip_level_count')
  .desc(
    `
  Test the mip level count for color or depth stencil.
    - Fail if using 2D texture view with mipLevelCount > 1.
    - Succeed if using 2D texture view that covers the first level of the texture.
    - Succeed if using 2D texture view that covers the last level of the texture.
  `
  )
  .paramsSimple([
    { mipLevelCount: 2, baseMipLevel: 0, _success: false },
    { mipLevelCount: 1, baseMipLevel: 0, _success: true },
    { mipLevelCount: 1, baseMipLevel: 3, _success: true },
  ])
  .fn(async t => {
    const { mipLevelCount, baseMipLevel, _success } = t.params;

    const ARRAY_LAYER_COUNT = 1;
    const MIP_LEVEL_COUNT = 4;
    const COLOR_FORMAT = 'rgba8unorm';
    const DEPTH_STENCIL_FORMAT = 'depth24plus-stencil8';

    const colorTexture = t.createTexture({
      format: COLOR_FORMAT,
      width: 32,
      height: 32,
      mipLevelCount: MIP_LEVEL_COUNT,
      arrayLayerCount: ARRAY_LAYER_COUNT,
    });
    const depthStencilTexture = t.createTexture({
      format: DEPTH_STENCIL_FORMAT,
      width: 32,
      height: 32,
      mipLevelCount: MIP_LEVEL_COUNT,
      arrayLayerCount: ARRAY_LAYER_COUNT,
    });

    const baseTextureViewDescriptor: GPUTextureViewDescriptor = {
      dimension: '2d',
      baseArrayLayer: 0,
      arrayLayerCount: ARRAY_LAYER_COUNT,
      baseMipLevel,
      mipLevelCount,
    };

    {
      // Check 2D texture view for color
      const textureViewDescriptor: GPUTextureViewDescriptor = {
        ...baseTextureViewDescriptor,
        format: COLOR_FORMAT,
      };

      const descriptor: GPURenderPassDescriptor = {
        colorAttachments: [t.getColorAttachment(colorTexture, textureViewDescriptor)],
      };

      t.tryRenderPass(_success, descriptor);
    }
    {
      // Check 2D texture view for depth stencil
      const textureViewDescriptor: GPUTextureViewDescriptor = {
        ...baseTextureViewDescriptor,
        format: DEPTH_STENCIL_FORMAT,
      };

      const descriptor: GPURenderPassDescriptor = {
        colorAttachments: [],
        depthStencilAttachment: t.getDepthStencilAttachment(
          depthStencilTexture,
          textureViewDescriptor
        ),
      };

      t.tryRenderPass(_success, descriptor);
    }
  });

g.test('color_attachments,non_multisampled')
  .desc(
    `
  Test that setting a resolve target is invalid if the color attachments is non multisampled.
  `
  )
  .fn(async t => {
    const colorTexture = t.createTexture({ sampleCount: 1 });
    const resolveTargetTexture = t.createTexture({ sampleCount: 1 });

    const descriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: colorTexture.createView(),
          resolveTarget: resolveTargetTexture.createView(),
          clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    };

    t.tryRenderPass(false, descriptor);
  });

g.test('color_attachments,sample_count')
  .desc(
    `
  Test the usages of multisampled textures for color attachments.
    - Succeed if using a multisampled color attachment without setting a resolve target.
    - Fail if using multiple color attachments with different sample counts.
  `
  )
  .fn(async t => {
    const colorTexture = t.createTexture({ sampleCount: 1 });
    const multisampledColorTexture = t.createTexture({ sampleCount: 4 });

    {
      // It is allowed to use a multisampled color attachment without setting resolve target
      const descriptor: GPURenderPassDescriptor = {
        colorAttachments: [t.getColorAttachment(multisampledColorTexture)],
      };
      t.tryRenderPass(true, descriptor);
    }
    {
      // It is not allowed to use multiple color attachments with different sample counts
      const descriptor: GPURenderPassDescriptor = {
        colorAttachments: [
          t.getColorAttachment(colorTexture),
          t.getColorAttachment(multisampledColorTexture),
        ],
      };

      t.tryRenderPass(false, descriptor);
    }
  });

g.test('resolveTarget,sample_count')
  .desc(
    `
  Test that using multisampled resolve target is invalid for color attachments.
  `
  )
  .fn(async t => {
    const multisampledColorTexture = t.createTexture({ sampleCount: 4 });
    const multisampledResolveTargetTexture = t.createTexture({ sampleCount: 4 });

    const colorAttachment = t.getColorAttachment(multisampledColorTexture);
    colorAttachment.resolveTarget = multisampledResolveTargetTexture.createView();

    const descriptor: GPURenderPassDescriptor = {
      colorAttachments: [colorAttachment],
    };

    t.tryRenderPass(false, descriptor);
  });

g.test('resolveTarget,array_layer_count')
  .desc(
    `
  Test that using a resolve target with array layer count is greater than 1 is invalid for color
  attachments.
  `
  )
  .fn(async t => {
    const multisampledColorTexture = t.createTexture({ sampleCount: 4 });
    const resolveTargetTexture = t.createTexture({ arrayLayerCount: 2 });

    const colorAttachment = t.getColorAttachment(multisampledColorTexture);
    colorAttachment.resolveTarget = resolveTargetTexture.createView({ dimension: '2d-array' });

    const descriptor: GPURenderPassDescriptor = {
      colorAttachments: [colorAttachment],
    };

    t.tryRenderPass(false, descriptor);
  });

g.test('resolveTarget,mipmap_level_count')
  .desc(
    `
  Test that using a resolve target with that mipmap level count is greater than 1 is invalid for
  color attachments.
  `
  )
  .fn(async t => {
    const multisampledColorTexture = t.createTexture({ sampleCount: 4 });
    const resolveTargetTexture = t.createTexture({ mipLevelCount: 2 });

    const colorAttachment = t.getColorAttachment(multisampledColorTexture);
    colorAttachment.resolveTarget = resolveTargetTexture.createView();

    const descriptor: GPURenderPassDescriptor = {
      colorAttachments: [colorAttachment],
    };

    t.tryRenderPass(false, descriptor);
  });

g.test('resolveTarget,usage')
  .desc(
    `
  Test that using a resolve target whose usage is not RENDER_ATTACHMENT is invalid for color
  attachments.

  TODO: Add a control case (include vs exclude RENDER_ATTACHMENT usage)
  `
  )
  .fn(async t => {
    const multisampledColorTexture = t.createTexture({ sampleCount: 4 });
    const resolveTargetTexture = t.createTexture({
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    const colorAttachment = t.getColorAttachment(multisampledColorTexture);
    colorAttachment.resolveTarget = resolveTargetTexture.createView();

    const descriptor: GPURenderPassDescriptor = {
      colorAttachments: [colorAttachment],
    };

    t.tryRenderPass(false, descriptor);
  });

g.test('it_is_invalid_to_use_a_resolve_target_in_error_state').fn(async t => {
  const ARRAY_LAYER_COUNT = 1;

  const multisampledColorTexture = t.createTexture({ sampleCount: 4 });
  const resolveTargetTexture = t.createTexture({ arrayLayerCount: ARRAY_LAYER_COUNT });

  const colorAttachment = t.getColorAttachment(multisampledColorTexture);
  t.expectValidationError(() => {
    colorAttachment.resolveTarget = resolveTargetTexture.createView({
      dimension: '2d',
      format: 'rgba8unorm',
      baseArrayLayer: ARRAY_LAYER_COUNT + 1,
    });
  });

  const descriptor: GPURenderPassDescriptor = {
    colorAttachments: [colorAttachment],
  };

  t.tryRenderPass(false, descriptor);
});

g.test('use_of_multisampled_attachment_and_non_multisampled_resolve_target_is_allowed').fn(
  async t => {
    const multisampledColorTexture = t.createTexture({ sampleCount: 4 });
    const resolveTargetTexture = t.createTexture({ sampleCount: 1 });

    const colorAttachment = t.getColorAttachment(multisampledColorTexture);
    colorAttachment.resolveTarget = resolveTargetTexture.createView();

    const descriptor: GPURenderPassDescriptor = {
      colorAttachments: [colorAttachment],
    };

    t.tryRenderPass(true, descriptor);
  }
);

g.test('use_a_resolve_target_in_a_format_different_than_the_attachment_is_not_allowed').fn(
  async t => {
    const multisampledColorTexture = t.createTexture({ sampleCount: 4 });
    const resolveTargetTexture = t.createTexture({ format: 'bgra8unorm' });

    const colorAttachment = t.getColorAttachment(multisampledColorTexture);
    colorAttachment.resolveTarget = resolveTargetTexture.createView();

    const descriptor: GPURenderPassDescriptor = {
      colorAttachments: [colorAttachment],
    };

    t.tryRenderPass(false, descriptor);
  }
);

g.test('size_of_the_resolve_target_must_be_the_same_as_the_color_attachment').fn(async t => {
  const size = 16;
  const multisampledColorTexture = t.createTexture({ width: size, height: size, sampleCount: 4 });
  const resolveTargetTexture = t.createTexture({
    width: size * 2,
    height: size * 2,
    mipLevelCount: 2,
  });

  {
    const resolveTargetTextureView = resolveTargetTexture.createView({
      baseMipLevel: 0,
      mipLevelCount: 1,
    });

    const colorAttachment = t.getColorAttachment(multisampledColorTexture);
    colorAttachment.resolveTarget = resolveTargetTextureView;

    const descriptor: GPURenderPassDescriptor = {
      colorAttachments: [colorAttachment],
    };

    t.tryRenderPass(false, descriptor);
  }
  {
    const resolveTargetTextureView = resolveTargetTexture.createView({ baseMipLevel: 1 });

    const colorAttachment = t.getColorAttachment(multisampledColorTexture);
    colorAttachment.resolveTarget = resolveTargetTextureView;

    const descriptor: GPURenderPassDescriptor = {
      colorAttachments: [colorAttachment],
    };

    t.tryRenderPass(true, descriptor);
  }
});

g.test('check_depth_stencil_attachment_sample_counts_mismatch').fn(async t => {
  const multisampledDepthStencilTexture = t.createTexture({
    sampleCount: 4,
    format: 'depth24plus-stencil8',
  });

  {
    // It is not allowed to use a depth stencil attachment whose sample count is different from the
    // one of the color attachment
    const depthStencilTexture = t.createTexture({
      sampleCount: 1,
      format: 'depth24plus-stencil8',
    });
    const multisampledColorTexture = t.createTexture({ sampleCount: 4 });
    const descriptor: GPURenderPassDescriptor = {
      colorAttachments: [t.getColorAttachment(multisampledColorTexture)],
      depthStencilAttachment: t.getDepthStencilAttachment(depthStencilTexture),
    };

    t.tryRenderPass(false, descriptor);
  }
  {
    const colorTexture = t.createTexture({ sampleCount: 1 });
    const descriptor: GPURenderPassDescriptor = {
      colorAttachments: [t.getColorAttachment(colorTexture)],
      depthStencilAttachment: t.getDepthStencilAttachment(multisampledDepthStencilTexture),
    };

    t.tryRenderPass(false, descriptor);
  }
  {
    // It is allowed to use a multisampled depth stencil attachment whose sample count is equal to
    // the one of the color attachment.
    const multisampledColorTexture = t.createTexture({ sampleCount: 4 });
    const descriptor: GPURenderPassDescriptor = {
      colorAttachments: [t.getColorAttachment(multisampledColorTexture)],
      depthStencilAttachment: t.getDepthStencilAttachment(multisampledDepthStencilTexture),
    };

    t.tryRenderPass(true, descriptor);
  }
  {
    // It is allowed to use a multisampled depth stencil attachment with no color attachment
    const descriptor: GPURenderPassDescriptor = {
      colorAttachments: [],
      depthStencilAttachment: t.getDepthStencilAttachment(multisampledDepthStencilTexture),
    };

    t.tryRenderPass(true, descriptor);
  }
});

g.test('depth_stencil_attachment')
  .desc(
    `
  Test GPURenderPassDepthStencilAttachment Usage:
  - depthReadOnly and stencilReadOnly must match if the format is a combined depth-stencil format.
  - depthLoadOp and depthStoreOp must be provided iff the format has a depth aspect and depthReadOnly is not true.
  - stencilLoadOp and stencilStoreOp must be provided iff the format has a stencil aspect and stencilReadOnly is not true.
  `
  )
  .params(u =>
    u //
      .combine('format', kDepthStencilFormats)
      .beginSubcases()
      .combine('depthReadOnly', [false, true])
      .combine('stencilReadOnly', [false, true])
      .combine('setDepthLoadStoreOp', [false, true])
      .combine('setStencilLoadStoreOp', [false, true])
  )
  .beforeAllSubcases(t => {
    t.selectDeviceForTextureFormatOrSkipTestCase(t.params.format);
  })
  .fn(async t => {
    const {
      format,
      depthReadOnly,
      stencilReadOnly,
      setDepthLoadStoreOp,
      setStencilLoadStoreOp,
    } = t.params;

    let isValid = true;
    const info = kTextureFormatInfo[format];
    if (info.depth && info.stencil) {
      isValid &&= depthReadOnly === stencilReadOnly;
    }

    if (info.depth && !depthReadOnly) {
      isValid &&= setDepthLoadStoreOp;
    } else {
      isValid &&= !setDepthLoadStoreOp;
    }

    if (info.stencil && !stencilReadOnly) {
      isValid &&= setStencilLoadStoreOp;
    } else {
      isValid &&= !setStencilLoadStoreOp;
    }

    const depthStencilAttachment: GPURenderPassDepthStencilAttachment = {
      view: t.createTexture({ format }).createView(),
      depthReadOnly,
      stencilReadOnly,
    };

    if (setDepthLoadStoreOp) {
      depthStencilAttachment.depthLoadOp = 'clear';
      depthStencilAttachment.depthStoreOp = 'store';
    }
    if (setStencilLoadStoreOp) {
      depthStencilAttachment.stencilLoadOp = 'clear';
      depthStencilAttachment.stencilStoreOp = 'store';
    }

    const descriptor = {
      colorAttachments: [t.getColorAttachment(t.createTexture())],
      depthStencilAttachment,
    };

    t.tryRenderPass(isValid, descriptor);
  });

g.test('multisample_render_target_formats_support_resolve')
  .params(u =>
    u
      .combine('format', kRenderableColorTextureFormats)
      .filter(t => kTextureFormatInfo[t.format].multisample)
  )
  .fn(async t => {
    const { format } = t.params;
    const multisampledColorTexture = t.createTexture({ format, sampleCount: 4 });
    const resolveTarget = t.createTexture({ format });

    const colorAttachment = t.getColorAttachment(multisampledColorTexture);
    colorAttachment.resolveTarget = resolveTarget.createView();

    t.tryRenderPass(kTextureFormatInfo[format].resolve, {
      colorAttachments: [colorAttachment],
    });
  });
