export const description = `
createRenderPipeline validation tests.
`;

import { TestGroup } from '../../../framework/index.js';
import GLSL from '../../../tools/glsl.macro.js';

import { ValidationTest } from './validation_test.js';

class F extends ValidationTest {
  async init(): Promise<void> {
    await Promise.all([super.init(), this.initGLSL()]);
  }

  getDescriptor(
    options: {
      primitiveTopology?: GPUPrimitiveTopology;
      colorStates?: GPUColorStateDescriptor[];
      sampleCount?: number;
      depthStencilState?: GPUDepthStencilStateDescriptor;
    } = {}
  ): GPURenderPipelineDescriptor {
    const defaultColorStates: GPUColorStateDescriptor[] = [{ format: 'rgba8unorm' }];
    const {
      primitiveTopology = 'triangle-list',
      colorStates = defaultColorStates,
      sampleCount = 1,
      depthStencilState,
    } = options;

    const format = colorStates.length ? colorStates[0].format : 'rgba8unorm';

    return {
      vertexStage: this.getVertexStage(),
      fragmentStage: this.getFragmentStage(format),
      layout: this.getPipelineLayout(),
      primitiveTopology,
      colorStates,
      sampleCount,
      depthStencilState,
    };
  }

  getVertexStage(): GPUProgrammableStageDescriptor {
    return {
      module: this.device.createShaderModule({
        code: GLSL(
          'vertex',
          `#version 450
            void main() {
              gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
            }
          `
        ),
      }),
      entryPoint: 'main',
    };
  }

  getFragmentStage(format: GPUTextureFormat): GPUProgrammableStageDescriptor {
    let fragColorType;
    if (format.endsWith('sint')) {
      fragColorType = 'ivec4';
    } else if (format.endsWith('uint')) {
      fragColorType = 'uvec4';
    } else {
      fragColorType = 'vec4';
    }

    const code = `
      #version 450
      layout(location = 0) out ${fragColorType} fragColor;
      void main() {
        fragColor = ${fragColorType}(0.0, 1.0, 0.0, 1.0);
      }
    `;

    return {
      module: this.makeShaderModule('fragment', code),
      entryPoint: 'main',
    };
  }

  getPipelineLayout(): GPUPipelineLayout {
    return this.device.createPipelineLayout({ bindGroupLayouts: [] });
  }

  createTexture(params: { format: GPUTextureFormat; sampleCount: number }): GPUTexture {
    const { format, sampleCount } = params;

    return this.device.createTexture({
      size: { width: 4, height: 4, depth: 1 },
      usage: GPUTextureUsage.OUTPUT_ATTACHMENT,
      format,
      sampleCount,
    });
  }
}

export const g = new TestGroup(F);

g.test('basic use of createRenderPipeline', t => {
  const descriptor = t.getDescriptor();

  t.device.createRenderPipeline(descriptor);
});

g.test('at least one color state is required', async t => {
  const goodDescriptor = t.getDescriptor({
    colorStates: [{ format: 'rgba8unorm' }],
  });

  // Control case
  t.device.createRenderPipeline(goodDescriptor);

  // Fail because lack of color states
  const badDescriptor = t.getDescriptor({
    colorStates: [],
  });

  await t.expectValidationError(() => {
    t.device.createRenderPipeline(badDescriptor);
  });
});

g.test('color formats must be renderable', async t => {
  const { format, _success } = t.params;

  const descriptor = t.getDescriptor({ colorStates: [{ format }] });

  if (_success) {
    // Succeeds when format is renderable
    t.device.createRenderPipeline(descriptor);
  } else {
    // Fails because when format is non-renderable
    await t.expectValidationError(() => {
      t.device.createRenderPipeline(descriptor);
    });
  }
}).params([
  // 8-bit formats
  { format: 'r8unorm', _success: true },
  { format: 'r8snorm', _success: false },
  { format: 'r8uint', _success: true },
  { format: 'r8sint', _success: true },
  // 16-bit formats
  { format: 'r16uint', _success: true },
  { format: 'r16sint', _success: true },
  { format: 'r16float', _success: true },
  { format: 'rg8unorm', _success: true },
  { format: 'rg8snorm', _success: false },
  { format: 'rg8uint', _success: true },
  { format: 'rg8sint', _success: true },
  // 32-bit formats
  { format: 'r32uint', _success: true },
  { format: 'r32sint', _success: true },
  { format: 'r32float', _success: true },
  { format: 'rg16uint', _success: true },
  { format: 'rg16sint', _success: true },
  { format: 'rg16float', _success: true },
  { format: 'rgba8unorm', _success: true },
  { format: 'rgba8unorm-srgb', _success: true },
  { format: 'rgba8snorm', _success: false },
  { format: 'rgba8uint', _success: true },
  { format: 'rgba8sint', _success: true },
  { format: 'bgra8unorm', _success: true },
  { format: 'bgra8unorm-srgb', _success: true },
  // Packed 32-bit formats
  { format: 'rgb10a2unorm', _success: true },
  { format: 'rg11b10float', _success: false },
  // 64-bit formats
  { format: 'rg32uint', _success: true },
  { format: 'rg32sint', _success: true },
  { format: 'rg32float', _success: true },
  { format: 'rgba16uint', _success: true },
  { format: 'rgba16sint', _success: true },
  { format: 'rgba16float', _success: true },
  // 128-bit formats
  { format: 'rgba32uint', _success: true },
  { format: 'rgba32sint', _success: true },
  { format: 'rgba32float', _success: true },
]);

g.test('sample count must be valid', async t => {
  const { sampleCount, _success } = t.params;

  const descriptor = t.getDescriptor({ sampleCount });

  if (_success) {
    // Succeeds when sample count is valid
    t.device.createRenderPipeline(descriptor);
  } else {
    // Fails when sample count is not 4 or 1
    await t.expectValidationError(() => {
      t.device.createRenderPipeline(descriptor);
    });
  }
}).params([
  { sampleCount: 0, _success: false },
  { sampleCount: 1, _success: true },
  { sampleCount: 2, _success: false },
  { sampleCount: 3, _success: false },
  { sampleCount: 4, _success: true },
  { sampleCount: 8, _success: false },
  { sampleCount: 16, _success: false },
]);

g.test('sample count must be equal to the one of every attachment in the render pass', async t => {
  const { attachmentSamples, pipelineSamples, _success } = t.params;

  const colorTexture = t.createTexture({
    format: 'rgba8unorm',
    sampleCount: attachmentSamples,
  });
  const depthStencilTexture = t.createTexture({
    format: 'depth24plus-stencil8',
    sampleCount: attachmentSamples,
  });
  const renderPassDescriptorWithoutDepthStencil = {
    colorAttachments: [
      {
        attachment: colorTexture.createView(),
        loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
      },
    ],
  };
  const renderPassDescriptorWithDepthStencilOnly = {
    colorAttachments: [],
    depthStencilAttachment: {
      attachment: depthStencilTexture.createView(),
      depthLoadValue: 1.0,
      depthStoreOp: 'store',
      stencilLoadValue: 0,
      stencilStoreOp: 'store',
    },
  };

  const pipelineWithoutDepthStencil = t.device.createRenderPipeline(
    t.getDescriptor({
      sampleCount: pipelineSamples,
    })
  );
  const pipelineWithDepthStencilOnly = t.device.createRenderPipeline(
    t.getDescriptor({
      colorStates: [],
      depthStencilState: { format: 'depth24plus-stencil8' },
      sampleCount: pipelineSamples,
    })
  );

  for (const { renderPassDescriptor, pipeline } of [
    {
      renderPassDescriptor: renderPassDescriptorWithoutDepthStencil,
      pipeline: pipelineWithoutDepthStencil,
    },
    {
      renderPassDescriptor: renderPassDescriptorWithDepthStencilOnly,
      pipeline: pipelineWithDepthStencilOnly,
    },
  ]) {
    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
    renderPass.setPipeline(pipeline);
    renderPass.endPass();

    await t.expectValidationError(() => {
      commandEncoder.finish();
    }, !_success);
  }
}).params([
  { attachmentSamples: 4, pipelineSamples: 4, _success: true }, // It is allowed to use multisampled render pass and multisampled render pipeline.
  { attachmentSamples: 4, pipelineSamples: 1, _success: false }, // It is not allowed to use multisampled render pass and non-multisampled render pipeline.
  { attachmentSamples: 1, pipelineSamples: 4, _success: false }, // It is not allowed to use non-multisampled render pass and multisampled render pipeline.
]);
