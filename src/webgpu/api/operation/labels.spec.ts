export const description = `
Tests for object labels.
`;

import { makeTestGroup } from '../../../common/framework/test_group.js';
import { keysOf } from '../../../common/util/data_tables.js';
import { getGPU } from '../../../common/util/navigator_gpu.js';
import { GPUTest } from '../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

type TestFunction = (t: GPUTest, label: string) => Promise<void>;
const kTestFunctions: { [name: string]: TestFunction } = {
  createBuffer: async (t: GPUTest, label: string) => {
    const buffer = t.device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST, label });
    t.expect(buffer.label === label);
    buffer.destroy();
    t.expect(buffer.label === label);
  },

  requestDevice: async (t: GPUTest, label: string) => {
    const gpu = getGPU();
    const adapter = await gpu.requestAdapter();
    t.expect(!!adapter);
    const device = await adapter!.requestDevice({ label });
    t.expect(!!device);
    t.expect(device.label === label);
    device.destroy();
    t.expect(device.label === label);
  },

  createTexture: async (t: GPUTest, label: string) => {
    const texture = t.device.createTexture({
      label,
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    t.expect(texture.label === label);
    texture.destroy();
    t.expect(texture.label === label);
  },

  createSampler: async (t: GPUTest, label: string) => {
    const sampler = t.device.createSampler({ label });
    t.expect(sampler.label === label);
  },

  createBindGroupLayout: async (t: GPUTest, label: string) => {
    const bindGroupLayout = t.device.createBindGroupLayout({ label, entries: [] });
    t.expect(bindGroupLayout.label === label);
  },

  createPipelineLayout: async (t: GPUTest, label: string) => {
    const pipelineLayout = t.device.createPipelineLayout({ label, bindGroupLayouts: [] });
    t.expect(pipelineLayout.label === label);
  },

  createBindGroup: async (t: GPUTest, label: string) => {
    const layout = t.device.createBindGroupLayout({ entries: [] });
    const bindGroup = t.device.createBindGroup({ label, layout, entries: [] });
    t.expect(bindGroup.label === label);
  },

  createShaderModule: async (t: GPUTest, label: string) => {
    const shaderModule = t.device.createShaderModule({
      label,
      code: `
        @vertex fn vs() -> @builtin(position) vec4f {
         return vec4f(0, 0, 0, 1);
        }
      `,
    });
    t.expect(shaderModule.label === label);
  },

  createComputePipeline: async (t: GPUTest, label: string) => {
    const module = t.device.createShaderModule({
      code: `
        @compute @workgroup_size(1u) fn foo() {}
      `,
    });
    const computePipeline = t.device.createComputePipeline({
      label,
      layout: 'auto',
      compute: {
        module,
        entryPoint: 'foo',
      },
    });
    t.expect(computePipeline.label === label);
  },

  createRenderPipeline: async (t: GPUTest, label: string) => {
    const module = t.device.createShaderModule({
      code: `
        @vertex fn foo() -> @builtin(position) vec4f {
         return vec4f(0, 0, 0, 1);
        }
      `,
    });
    const renderPipeline = t.device.createRenderPipeline({
      label,
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'foo',
      },
    });
    t.expect(renderPipeline.label === label);
  },

  createComputePipelineAsync: async (t: GPUTest, label: string) => {
    const module = t.device.createShaderModule({
      code: `
        @compute @workgroup_size(1u) fn foo() {}
      `,
    });
    const computePipeline = await t.device.createComputePipelineAsync({
      label,
      layout: 'auto',
      compute: {
        module,
        entryPoint: 'foo',
      },
    });
    t.expect(computePipeline.label === label);
  },

  createRenderPipelineAsync: async (t: GPUTest, label: string) => {
    const module = t.device.createShaderModule({
      label,
      code: `
        @vertex fn foo() -> @builtin(position) vec4f {
         return vec4f(0, 0, 0, 1);
        }
      `,
    });
    const renderPipeline = await t.device.createRenderPipelineAsync({
      label,
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'foo',
      },
    });
    t.expect(renderPipeline.label === label);
  },

  createCommandEncoder: async (t: GPUTest, label: string) => {
    const encoder = t.device.createCommandEncoder({ label });
    t.expect(encoder.label === label);
  },

  createRenderBundleEncoder: async (t: GPUTest, label: string) => {
    const encoder = t.device.createRenderBundleEncoder({
      label,
      colorFormats: ['rgba8unorm'],
    });
    t.expect(encoder.label === label);
  },

  createQuerySet: async (t: GPUTest, label: string) => {
    const querySet = t.device.createQuerySet({
      label,
      type: 'occlusion',
      count: 1,
    });
    t.expect(querySet.label === label);
    querySet.destroy();
    t.expect(querySet.label === label);
  },

  beginRenderPass: async (t: GPUTest, label: string) => {
    const texture = t.device.createTexture({
      label,
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const label2 = `${label}-2`;
    const encoder = t.device.createCommandEncoder();
    encoder.label = label2;
    const renderPass = encoder.beginRenderPass({
      label,
      colorAttachments: [{ view: texture.createView(), loadOp: 'clear', storeOp: 'store' }],
    });
    t.expect(renderPass.label === label);
    renderPass.end();
    t.expect(renderPass.label === label);
    encoder.finish();
    t.expect(renderPass.label === label);
    t.expect(encoder.label === label2);
    texture.destroy();
  },

  beginComputePass: async (t: GPUTest, label: string) => {
    const label2 = `${label}-2`;
    const encoder = t.device.createCommandEncoder();
    encoder.label = label2;
    const computePass = encoder.beginComputePass({ label });
    t.expect(computePass.label === label);
    computePass.end();
    t.expect(computePass.label === label);
    encoder.finish();
    t.expect(computePass.label === label);
    t.expect(encoder.label === label2);
  },

  finish: async (t: GPUTest, label: string) => {
    const encoder = t.device.createCommandEncoder();
    const commandBuffer = encoder.finish({ label });
    t.expect(commandBuffer.label === label);
  },

  createView: async (t: GPUTest, label: string) => {
    const texture = t.device.createTexture({
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const view = texture.createView({ label });
    t.expect(view.label === label);
    texture.destroy();
    t.expect(view.label === label);
  },
};

g.test('object_has_descriptor_label')
  .desc(
    `
  For every create function, the descriptor.label is carried over to the object.label.
  
  TODO: test importExternalTexture
  TODO: make a best effort and generating an error that is likely to use label. There's nothing to check for
        but it may surface bugs related to unusual labels.
    `
  )
  .params(u =>
    u
      .combine('name', keysOf(kTestFunctions))
      .beginSubcases()
      .combine('label', ['label', '\0', 'null\0in\0label', '🌞👆'])
  )
  .fn(async t => {
    const { name, label } = t.params;
    await kTestFunctions[name](t, label);
  });

g.test('wrappers_do_not_share_labels')
  .desc('test that different wrapper objects for the same GPU object do not share labels')
  .fn(async t => {
    const module = t.device.createShaderModule({
      code: `
        @group(0) @binding(0) var<uniform> pos: vec4f;
        @vertex fn main() -> @builtin(position) vec4f {
          return pos;
        }
      `,
    });
    const pipeline = t.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'main',
      },
    });
    const layout1 = pipeline.getBindGroupLayout(0);
    const layout2 = pipeline.getBindGroupLayout(0);
    t.expect(layout1 !== layout2);

    layout1.label = 'foo';
    layout2.label = 'bar';

    t.expect(layout1.label === 'foo');
    t.expect(layout2.label === 'bar');
  });
