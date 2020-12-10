export const description = `
Validation for attachment compatibility between render passes, bundles, and pipelines

TODO: Add sparse color attachment compatibility test when defined by specification
`;

import { poptions, params } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import { range } from '../../../common/framework/util/util.js';
import {
  kRegularTextureFormatInfo,
  kRegularTextureFormats,
  kSizedDepthStencilFormats,
  kUnsizedDepthStencilFormats,
  RegularTextureFormat,
} from '../../capability_info.js';

import { ValidationTest, CommandBufferMaker } from './validation_test.js';

// TODO: Update maximum color attachments when defined
const kColorAttachmentCounts = range(4, i => i + 1);
const kDepthStencilAttachmentFormats = [
  undefined,
  ...kSizedDepthStencilFormats,
  ...kUnsizedDepthStencilFormats,
] as const;

class F extends ValidationTest {
  createAttachmentTextureView(format: GPUTextureFormat) {
    return this.device
      .createTexture({
        size: [1, 1, 1],
        format,
        usage: GPUTextureUsage.OUTPUT_ATTACHMENT,
      })
      .createView();
  }

  createColorAttachment(format: GPUTextureFormat): GPURenderPassColorAttachmentDescriptor {
    return {
      attachment: this.createAttachmentTextureView(format),
      loadValue: [0, 0, 0, 0],
    };
  }

  createDepthAttachment(format: GPUTextureFormat): GPURenderPassDepthStencilAttachmentDescriptor {
    return {
      attachment: this.createAttachmentTextureView(format),
      depthLoadValue: 0,
      depthStoreOp: 'clear',
      stencilLoadValue: 1,
      stencilStoreOp: 'clear',
    };
  }

  createPassOrBundleEncoder(
    encoderType: 'render pass' | 'render bundle',
    colorFormats: Iterable<GPUTextureFormat>,
    depthStencilFormat?: GPUTextureFormat
  ): CommandBufferMaker<GPURenderPassEncoder | GPURenderBundleEncoder> {
    const encoder = this.device.createCommandEncoder();
    const passDesc: GPURenderPassDescriptor = {
      colorAttachments: Array.from(colorFormats, format => this.createColorAttachment(format)),
      depthStencilAttachment:
        depthStencilFormat !== undefined
          ? this.createDepthAttachment(depthStencilFormat)
          : undefined,
    };
    const pass = encoder.beginRenderPass(passDesc);
    switch (encoderType) {
      case 'render bundle': {
        const bundleEncoder = this.device.createRenderBundleEncoder({
          colorFormats,
          depthStencilFormat,
        });

        return {
          encoder: bundleEncoder,
          finish() {
            const bundle = bundleEncoder.finish();
            pass.executeBundles([bundle]);
            pass.endPass();
            return encoder.finish();
          },
        };
      }
      case 'render pass':
        return {
          encoder: pass,
          finish() {
            pass.endPass();
            return encoder.finish();
          },
        };
    }
  }

  createRenderPipeline(
    colorStates: Iterable<GPUColorStateDescriptor>,
    depthStencilState?: GPUDepthStencilStateDescriptor
  ) {
    const wgslVertex = `
    [[builtin(position)]] var<out> position : vec4<f32>;

    [[stage(vertex)]]
    fn main() -> void {
      position = vec4<f32>(0.0, 0.0, 0.0, 0.0);
      return;
    }
  `;
    const wgslFragment = `
    [[stage(fragment)]]
    fn main() -> void {
      return;
    }
  `;

    return this.device.createRenderPipeline({
      vertexStage: {
        module: this.device.createShaderModule({
          code: wgslVertex,
        }),
        entryPoint: 'main',
      },
      fragmentStage: {
        module: this.device.createShaderModule({
          code: wgslFragment,
        }),
        entryPoint: 'main',
      },
      primitiveTopology: 'triangle-list',
      colorStates,
      depthStencilState,
    });
  }
}

export const g = makeTestGroup(F);

const kColorAttachmentFormats = kRegularTextureFormats
  .map((key): [RegularTextureFormat, typeof kRegularTextureFormatInfo[RegularTextureFormat]] => [
    key,
    kRegularTextureFormatInfo[key],
  ])
  .filter(([, format]) => format.color && format.renderable)
  .map(([key]) => key);

g.test('render_pass_and_bundle_color_format')
  .desc('Test that color attachment formats in render passes and bundles must match.')
  .params(
    params()
      .combine(poptions('passFormat', kColorAttachmentFormats))
      .combine(poptions('bundleFormat', kColorAttachmentFormats))
  )
  .fn(t => {
    const { passFormat, bundleFormat } = t.params;
    const bundleEncoder = t.device.createRenderBundleEncoder({
      colorFormats: [bundleFormat],
    });
    const bundle = bundleEncoder.finish();
    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [t.createColorAttachment(passFormat)],
    });
    pass.executeBundles([bundle]);
    pass.endPass();
    t.expectValidationError(() => {
      t.queue.submit([encoder.finish()]);
    }, passFormat !== bundleFormat);
  });

g.test('render_pass_and_bundle_color_count')
  .desc('Test that the number of color attachments in render passes and bundles must match.')
  .params(
    params()
      .combine(poptions('passCount', kColorAttachmentCounts))
      .combine(poptions('bundleCount', kColorAttachmentCounts))
  )
  .fn(t => {
    const { passCount, bundleCount } = t.params;
    const bundleEncoder = t.device.createRenderBundleEncoder({
      colorFormats: range(bundleCount, () => 'rgba8unorm'),
    });
    const bundle = bundleEncoder.finish();

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: range(passCount, () => t.createColorAttachment('rgba8unorm')),
    });
    pass.executeBundles([bundle]);
    pass.endPass();
    t.expectValidationError(() => {
      t.queue.submit([encoder.finish()]);
    }, passCount !== bundleCount);
  });

g.test('render_pass_and_bundle_depth_format')
  .desc('Test that the depth attachment format in render passes and bundles must match.')
  .params(
    params()
      .combine(poptions('passFormat', kDepthStencilAttachmentFormats))
      .combine(poptions('bundleFormat', kDepthStencilAttachmentFormats))
  )
  .fn(t => {
    const { passFormat, bundleFormat } = t.params;
    const bundleEncoder = t.device.createRenderBundleEncoder({
      colorFormats: ['rgba8unorm'],
      depthStencilFormat: bundleFormat,
    });
    const bundle = bundleEncoder.finish();
    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [t.createColorAttachment('rgba8unorm')],
      depthStencilAttachment:
        passFormat !== undefined ? t.createDepthAttachment(passFormat) : undefined,
    });
    pass.executeBundles([bundle]);
    pass.endPass();
    t.expectValidationError(() => {
      t.queue.submit([encoder.finish()]);
    }, passFormat !== bundleFormat);
  });

g.test('render_pass_or_bundle_and_pipeline_color_format')
  .desc(
    `
Test that color attachment formats in render passes or bundles match the pipeline color format.
`
  )
  .params(
    params()
      .combine(poptions('encoderType', ['render pass', 'render bundle'] as const))
      .combine(poptions('encoderFormat', kColorAttachmentFormats))
      .combine(poptions('pipelineFormat', kColorAttachmentFormats))
  )
  .fn(t => {
    const { encoderType, encoderFormat, pipelineFormat } = t.params;
    const pipeline = t.createRenderPipeline([{ format: pipelineFormat }]);

    const { encoder, finish } = t.createPassOrBundleEncoder(encoderType, [encoderFormat]);
    encoder.setPipeline(pipeline);

    t.expectValidationError(() => {
      t.queue.submit([finish()]);
    }, encoderFormat !== pipelineFormat);
  });

g.test('render_pass_or_bundle_and_pipeline_color_count')
  .desc(
    `
Test that the number of color attachments in render passes or bundles match the pipeline color
count.
`
  )
  .params(
    params()
      .combine(poptions('encoderType', ['render pass', 'render bundle'] as const))
      .combine(poptions('encoderCount', kColorAttachmentCounts))
      .combine(poptions('pipelineCount', kColorAttachmentCounts))
  )
  .fn(t => {
    const { encoderType, encoderCount, pipelineCount } = t.params;
    const pipeline = t.createRenderPipeline(range(pipelineCount, () => ({ format: 'rgba8unorm' })));

    const { encoder, finish } = t.createPassOrBundleEncoder(
      encoderType,
      range(encoderCount, () => 'rgba8unorm')
    );
    encoder.setPipeline(pipeline);

    t.expectValidationError(() => {
      t.queue.submit([finish()]);
    }, encoderCount !== pipelineCount);
  });

g.test('render_pass_and_pipeline_depth_format')
  .desc(
    `
Test that the depth attachment format in render passes or bundles match the pipeline depth format.
`
  )
  .params(
    params()
      .combine(poptions('encoderType', ['render pass', 'render bundle'] as const))
      .combine(poptions('encoderFormat', kDepthStencilAttachmentFormats))
      .combine(poptions('pipelineFormat', kDepthStencilAttachmentFormats))
  )
  .fn(t => {
    const { encoderType, encoderFormat, pipelineFormat } = t.params;
    const pipeline = t.createRenderPipeline(
      [{ format: 'rgba8unorm' }],
      pipelineFormat !== undefined ? { format: pipelineFormat } : undefined
    );

    const { encoder, finish } = t.createPassOrBundleEncoder(
      encoderType,
      ['rgba8unorm'],
      encoderFormat
    );
    encoder.setPipeline(pipeline);

    t.expectValidationError(() => {
      t.queue.submit([finish()]);
    }, encoderFormat !== pipelineFormat);
  });
