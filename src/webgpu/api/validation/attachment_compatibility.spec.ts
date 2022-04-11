export const description = `
Validation for attachment compatibility between render passes, bundles, and pipelines

TODO: Add sparse color attachment compatibility test when defined by specification
`;

import { makeTestGroup } from '../../../common/framework/test_group.js';
import { range } from '../../../common/util/util.js';
import {
  kRegularTextureFormats,
  kSizedDepthStencilFormats,
  kUnsizedDepthStencilFormats,
  kTextureSampleCounts,
  kMaxColorAttachments,
  kTextureFormatInfo,
} from '../../capability_info.js';

import { ValidationTest } from './validation_test.js';

const kColorAttachmentCounts = range(kMaxColorAttachments, i => i + 1);
const kColorAttachments = kColorAttachmentCounts
  .map(count => {
    // generate cases with 0..1 null attachments at different location
    // e.g. count == 2
    // [
    //    [1, 1],
    //    [0, 1],
    //    [1, 0],
    // ]
    // 0 means null attachment, 1 means non-null attachment, at the slot

    // Special cases: we need at least a color attachment, when we don't have depth stencil attachment
    if (count === 1) {
      return [[1]];
    }
    if (count === 2) {
      return [
        [1, 1],
        [0, 1],
        [1, 0],
      ];
    }

    // [1, 1, ..., 1]: all color attachment are used
    let result = [new Array<number>(count).fill(1)];

    // [1, 0, 1, ..., 1]: generate cases with one null attachment at different locations
    result = result.concat(
      range(count, i => {
        const r = new Array<number>(count).fill(1);
        r[i] = 0;
        return r;
      })
    );

    // [1, 0, 1, ..., 0, 1]: generate cases with two null attachments at different locations
    result = result.concat(
      range(count - 1, i => {
        const cases = [] as number[][];
        for (let j = i + 1; j < count; j++) {
          const r = new Array<number>(count).fill(1);
          r[i] = 0;
          r[j] = 0;
          cases.push(r);
        }

        return cases;
      }).flat()
    );

    return result;
  })
  .flat() as number[][];

const kDepthStencilAttachmentFormats = [
  undefined,
  ...kSizedDepthStencilFormats,
  ...kUnsizedDepthStencilFormats,
] as const;

class F extends ValidationTest {
  createAttachmentTextureView(format: GPUTextureFormat, sampleCount?: number) {
    return this.device
      .createTexture({
        // Size matching the "arbitrary" size used by ValidationTest helpers.
        size: [16, 16, 1],
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        sampleCount,
      })
      .createView();
  }

  createColorAttachment(
    format: GPUTextureFormat | undefined,
    sampleCount?: number
  ): GPURenderPassColorAttachment | undefined {
    return format === undefined
      ? undefined
      : {
          view: this.createAttachmentTextureView(format, sampleCount),
          clearValue: [0, 0, 0, 0],
          loadOp: 'clear',
          storeOp: 'store',
        };
  }

  createDepthAttachment(
    format: GPUTextureFormat,
    sampleCount?: number
  ): GPURenderPassDepthStencilAttachment {
    const attachment: GPURenderPassDepthStencilAttachment = {
      view: this.createAttachmentTextureView(format, sampleCount),
    };
    if (kTextureFormatInfo[format].depth) {
      attachment.depthClearValue = 0;
      attachment.depthLoadOp = 'clear';
      attachment.depthStoreOp = 'discard';
    }
    if (kTextureFormatInfo[format].stencil) {
      attachment.stencilClearValue = 1;
      attachment.stencilLoadOp = 'clear';
      attachment.stencilStoreOp = 'discard';
    }
    return attachment;
  }

  createRenderPipeline(
    targets: Iterable<GPUColorTargetState | undefined>,
    depthStencil?: GPUDepthStencilState,
    sampleCount?: number
  ) {
    return this.device.createRenderPipeline({
      vertex: {
        module: this.device.createShaderModule({
          code: `
            @stage(vertex) fn main() -> @builtin(position) vec4<f32> {
              return vec4<f32>(0.0, 0.0, 0.0, 0.0);
            }`,
        }),
        entryPoint: 'main',
      },
      fragment: {
        module: this.device.createShaderModule({
          code: '@stage(fragment) fn main() {}',
        }),
        entryPoint: 'main',
        targets,
      },
      primitive: { topology: 'triangle-list' },
      depthStencil,
      multisample: { count: sampleCount },
    });
  }
}

export const g = makeTestGroup(F);

const kColorAttachmentFormats = kRegularTextureFormats.filter(format => {
  const info = kTextureFormatInfo[format];
  return info.color && info.renderable;
});

g.test('render_pass_and_bundle,color_format')
  .desc('Test that color attachment formats in render passes and bundles must match.')
  .paramsSubcasesOnly(u =>
    u //
      .combine('passFormat', kColorAttachmentFormats)
      .combine('bundleFormat', kColorAttachmentFormats)
  )
  .fn(t => {
    const { passFormat, bundleFormat } = t.params;
    const bundleEncoder = t.device.createRenderBundleEncoder({
      colorFormats: [bundleFormat],
    });
    const bundle = bundleEncoder.finish();

    const { encoder, validateFinishAndSubmit } = t.createEncoder('non-pass');
    const pass = encoder.beginRenderPass({
      colorAttachments: [t.createColorAttachment(passFormat)],
    });
    pass.executeBundles([bundle]);
    pass.end();
    validateFinishAndSubmit(passFormat === bundleFormat, true);
  });

g.test('render_pass_and_bundle,color_count')
  .desc(
    `
  Test that the number of color attachments in render passes and bundles must match.
  `
  )
  .paramsSubcasesOnly(u =>
    u //
      .combine('passCount', kColorAttachmentCounts)
      .combine('bundleCount', kColorAttachmentCounts)
  )
  .fn(t => {
    const { passCount, bundleCount } = t.params;
    const bundleEncoder = t.device.createRenderBundleEncoder({
      colorFormats: range(bundleCount, () => 'rgba8unorm'),
    });
    const bundle = bundleEncoder.finish();

    const { encoder, validateFinishAndSubmit } = t.createEncoder('non-pass');
    const pass = encoder.beginRenderPass({
      colorAttachments: range(passCount, () => t.createColorAttachment('rgba8unorm')),
    });
    pass.executeBundles([bundle]);
    pass.end();
    validateFinishAndSubmit(passCount === bundleCount, true);
  });

g.test('render_pass_and_bundle,color_sparse')
  .desc(
    `
  Test that each of color attachments in render passes and bundles must match.
  `
  )
  .params(u =>
    u //
      // introduce attachmentCount to make it easier to split the test
      .combine('attachmentCount', kColorAttachmentCounts)
      .beginSubcases()
      .combine('passAttachments', kColorAttachments)
      .combine('bundleAttachments', kColorAttachments)
      .filter(
        p =>
          p.attachmentCount === p.passAttachments.length &&
          p.attachmentCount === p.bundleAttachments.length
      )
  )
  .fn(t => {
    const { passAttachments, bundleAttachments } = t.params;
    const colorFormats = bundleAttachments.map(i => (i === 1 ? 'rgba8unorm' : undefined));
    const bundleEncoder = t.device.createRenderBundleEncoder({
      colorFormats,
    });
    const bundle = bundleEncoder.finish();

    const { encoder, validateFinishAndSubmit } = t.createEncoder('non-pass');
    const colorAttachments = passAttachments.map(i =>
      t.createColorAttachment(i === 1 ? 'rgba8unorm' : undefined)
    );
    const pass = encoder.beginRenderPass({
      colorAttachments,
    });
    pass.executeBundles([bundle]);
    pass.end();
    validateFinishAndSubmit(
      passAttachments.every((v, i) => v === bundleAttachments[i]),
      true
    );
  });

g.test('render_pass_and_bundle,depth_format')
  .desc('Test that the depth attachment format in render passes and bundles must match.')
  .paramsSubcasesOnly(u =>
    u //
      .combine('passFormat', kDepthStencilAttachmentFormats)
      .combine('bundleFormat', kDepthStencilAttachmentFormats)
  )
  .fn(async t => {
    const { passFormat, bundleFormat } = t.params;
    await t.selectDeviceForTextureFormatOrSkipTestCase([passFormat, bundleFormat]);

    const bundleEncoder = t.device.createRenderBundleEncoder({
      colorFormats: ['rgba8unorm'],
      depthStencilFormat: bundleFormat,
    });
    const bundle = bundleEncoder.finish();

    const { encoder, validateFinishAndSubmit } = t.createEncoder('non-pass');
    const pass = encoder.beginRenderPass({
      colorAttachments: [t.createColorAttachment('rgba8unorm')],
      depthStencilAttachment:
        passFormat !== undefined ? t.createDepthAttachment(passFormat) : undefined,
    });
    pass.executeBundles([bundle]);
    pass.end();
    validateFinishAndSubmit(passFormat === bundleFormat, true);
  });

g.test('render_pass_and_bundle,sample_count')
  .desc('Test that the sample count in render passes and bundles must match.')
  .paramsSubcasesOnly(u =>
    u //
      .combine('renderSampleCount', kTextureSampleCounts)
      .combine('bundleSampleCount', kTextureSampleCounts)
  )
  .fn(t => {
    const { renderSampleCount, bundleSampleCount } = t.params;
    const bundleEncoder = t.device.createRenderBundleEncoder({
      colorFormats: ['rgba8unorm'],
      sampleCount: bundleSampleCount,
    });
    const bundle = bundleEncoder.finish();
    const { encoder, validateFinishAndSubmit } = t.createEncoder('non-pass');
    const pass = encoder.beginRenderPass({
      colorAttachments: [t.createColorAttachment('rgba8unorm', renderSampleCount)],
    });
    pass.executeBundles([bundle]);
    pass.end();
    validateFinishAndSubmit(renderSampleCount === bundleSampleCount, true);
  });

g.test('render_pass_or_bundle_and_pipeline,color_format')
  .desc(
    `
Test that color attachment formats in render passes or bundles match the pipeline color format.
`
  )
  .params(u =>
    u
      .combine('encoderType', ['render pass', 'render bundle'] as const)
      .beginSubcases()
      .combine('encoderFormat', kColorAttachmentFormats)
      .combine('pipelineFormat', kColorAttachmentFormats)
  )
  .fn(t => {
    const { encoderType, encoderFormat, pipelineFormat } = t.params;
    const pipeline = t.createRenderPipeline([{ format: pipelineFormat, writeMask: 0 }]);

    const { encoder, validateFinishAndSubmit } = t.createEncoder(encoderType, {
      attachmentInfo: { colorFormats: [encoderFormat] },
    });
    encoder.setPipeline(pipeline);
    validateFinishAndSubmit(encoderFormat === pipelineFormat, true);
  });

g.test('render_pass_or_bundle_and_pipeline,color_count')
  .desc(
    `
Test that the number of color attachments in render passes or bundles match the pipeline color
count.
`
  )
  .params(u =>
    u
      .combine('encoderType', ['render pass', 'render bundle'] as const)
      .beginSubcases()
      .combine('encoderCount', kColorAttachmentCounts)
      .combine('pipelineCount', kColorAttachmentCounts)
  )
  .fn(t => {
    const { encoderType, encoderCount, pipelineCount } = t.params;
    const pipeline = t.createRenderPipeline(
      range(pipelineCount, () => ({ format: 'rgba8unorm', writeMask: 0 }))
    );

    const { encoder, validateFinishAndSubmit } = t.createEncoder(encoderType, {
      attachmentInfo: { colorFormats: range(encoderCount, () => 'rgba8unorm') },
    });
    encoder.setPipeline(pipeline);
    validateFinishAndSubmit(encoderCount === pipelineCount, true);
  });

g.test('render_pass_or_bundle_and_pipeline,color_sparse')
  .desc(
    `
Test that each of color attachments in render passes or bundles match that of the pipeline.
`
  )
  .params(u =>
    u
      .combine('encoderType', ['render pass', 'render bundle'] as const)
      // introduce attachmentCount to make it easier to split the test
      .combine('attachmentCount', kColorAttachmentCounts)
      .beginSubcases()
      .combine('encoderAttachments', kColorAttachments)
      .combine('pipelineAttachments', kColorAttachments)
      .filter(
        p =>
          p.attachmentCount === p.encoderAttachments.length &&
          p.attachmentCount === p.pipelineAttachments.length
      )
  )
  .fn(t => {
    const { encoderType, encoderAttachments, pipelineAttachments } = t.params;

    const colorTargets = pipelineAttachments.map(i =>
      i === 1 ? ({ format: 'rgba8unorm', writeMask: 0 } as GPUColorTargetState) : undefined
    );
    const pipeline = t.createRenderPipeline(colorTargets);

    const colorFormats = encoderAttachments.map(i => (i === 1 ? 'rgba8unorm' : undefined));
    const { encoder, validateFinishAndSubmit } = t.createEncoder(encoderType, {
      attachmentInfo: { colorFormats },
    });
    encoder.setPipeline(pipeline);
    validateFinishAndSubmit(
      encoderAttachments.every((v, i) => v === pipelineAttachments[i]),
      true
    );
  });

g.test('render_pass_or_bundle_and_pipeline,depth_format')
  .desc(
    `
Test that the depth attachment format in render passes or bundles match the pipeline depth format.
`
  )
  .params(u =>
    u
      .combine('encoderType', ['render pass', 'render bundle'] as const)
      .beginSubcases()
      .combine('encoderFormat', kDepthStencilAttachmentFormats)
      .combine('pipelineFormat', kDepthStencilAttachmentFormats)
  )
  .fn(async t => {
    const { encoderType, encoderFormat, pipelineFormat } = t.params;
    await t.selectDeviceForTextureFormatOrSkipTestCase([encoderFormat, pipelineFormat]);

    const pipeline = t.createRenderPipeline(
      [{ format: 'rgba8unorm', writeMask: 0 }],
      pipelineFormat !== undefined ? { format: pipelineFormat } : undefined
    );

    const { encoder, validateFinishAndSubmit } = t.createEncoder(encoderType, {
      attachmentInfo: { colorFormats: ['rgba8unorm'], depthStencilFormat: encoderFormat },
    });
    encoder.setPipeline(pipeline);
    validateFinishAndSubmit(encoderFormat === pipelineFormat, true);
  });

g.test('render_pass_or_bundle_and_pipeline,sample_count')
  .desc(
    `
Test that the sample count in render passes or bundles match the pipeline sample count for both color texture and depthstencil texture.
`
  )
  .params(u =>
    u
      .combine('encoderType', ['render pass', 'render bundle'] as const)
      .combine('attachmentType', ['color', 'depthstencil'] as const)
      .beginSubcases()
      .combine('encoderSampleCount', kTextureSampleCounts)
      .combine('pipelineSampleCount', kTextureSampleCounts)
  )
  .fn(t => {
    const { encoderType, attachmentType, encoderSampleCount, pipelineSampleCount } = t.params;

    const colorFormats = attachmentType === 'color' ? ['rgba8unorm' as const] : [];
    const depthStencilFormat =
      attachmentType === 'depthstencil' ? ('depth24plus-stencil8' as const) : undefined;

    const pipeline = t.createRenderPipeline(
      colorFormats.map(format => ({ format, writeMask: 0 })),
      depthStencilFormat ? { format: depthStencilFormat } : undefined,
      pipelineSampleCount
    );

    const { encoder, validateFinishAndSubmit } = t.createEncoder(encoderType, {
      attachmentInfo: { colorFormats, depthStencilFormat, sampleCount: encoderSampleCount },
    });
    encoder.setPipeline(pipeline);
    validateFinishAndSubmit(encoderSampleCount === pipelineSampleCount, true);
  });
