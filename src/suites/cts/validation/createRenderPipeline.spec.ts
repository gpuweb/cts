export const description = `
createRenderPipeline validation tests.
`;

import { TestGroup } from '../../../framework/index.js';
import GLSL from '../../../tools/glsl.macro.js';

import { ValidationTest } from './validation_test.js';

class F extends ValidationTest {
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

    return {
      vertexStage: this.getVertexStage(),
      fragmentStage: this.getFragmentStage(),
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

  getFragmentStage(): GPUProgrammableStageDescriptor {
    return {
      module: this.device.createShaderModule({
        code: GLSL(
          'fragment',
          `#version 450
            layout(location = 0) out vec4 fragColor;
            void main() {
              fragColor = vec4(0.0, 1.0, 0.0, 1.0);
            }
          `
        ),
      }),
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
  const goodDescriptor = t.getDescriptor({
    colorStates: [{ format: 'rgba8unorm' }],
  });

  // Control case
  t.device.createRenderPipeline(goodDescriptor);

  // Fails because RG11B10Float is non-renderable
  const badDescriptor = t.getDescriptor({
    colorStates: [{ format: 'rg11b10float' }],
  });

  await t.expectValidationError(() => {
    t.device.createRenderPipeline(badDescriptor);
  });
});

g.test('sample count must be valid', async t => {
  const goodDescriptor = t.getDescriptor({
    sampleCount: 4,
  });

  // Control case
  t.device.createRenderPipeline(goodDescriptor);

  // Fails because 3 is not a power of 2.
  const badDescriptor = t.getDescriptor({
    sampleCount: 3,
  });

  await t.expectValidationError(() => {
    t.device.createRenderPipeline(badDescriptor);
  });
});

g.test('sample count must be equal to the one of every attachment in the render pass', async t => {
  const { multisampledPass, multisampledPipeline, success } = t.params;

  const sampleCountForTexture = multisampledPass ? 4 : 1;
  const colorTexture = t.createTexture({
    format: 'rgba8unorm',
    sampleCount: sampleCountForTexture,
  });
  const depthStencilTexture = t.createTexture({
    format: 'depth24plus-stencil8',
    sampleCount: sampleCountForTexture,
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

  const sampleCountForPipeline = multisampledPipeline ? 4 : 1;
  const pipelineWithoutDepthStencilDescriptor = t.getDescriptor({
    sampleCount: sampleCountForPipeline,
  });
  const pipelineWithoutDepthStencil = t.device.createRenderPipeline(
    pipelineWithoutDepthStencilDescriptor
  );
  const pipelineWithDepthStencilOnlyDescriptor = t.getDescriptor({
    colorStates: [],
    depthStencilState: {
      format: 'depth24plus-stencil8',
      stencilBack: {
        compare: 'always',
        failOp: 'keep',
        depthFailOp: 'keep',
        passOp: 'keep',
      },
      stencilFront: {
        compare: 'always',
        failOp: 'keep',
        depthFailOp: 'keep',
        passOp: 'keep',
      },
    },
    sampleCount: sampleCountForPipeline,
  });
  const pipelineWithDepthStencilOnly = t.device.createRenderPipeline(
    pipelineWithDepthStencilOnlyDescriptor
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
    }, !success);
  }
}).params([
  { multisampledPass: true, multisampledPipeline: true, success: true }, // It is allowed to use multisampled render pass and multisampled render pipeline.
  { multisampledPass: true, multisampledPipeline: false, success: false }, // It is not allowed to use multisampled render pass and non-multisampled render pipeline.
  { multisampledPass: false, multisampledPipeline: true, success: false }, // It is not allowed to use non-multisampled render pass and multisampled render pipeline.
]);
