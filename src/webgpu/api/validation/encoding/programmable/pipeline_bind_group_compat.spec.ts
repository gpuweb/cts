export const description = `
TODO:
- test compatibility between bind groups and pipelines
    - bind groups required by the pipeline layout are required.
    - bind groups unused by the pipeline layout can be set or not.
        (Even if e.g. bind groups 0 and 2 are used, but 1 is unused.)
    - bindGroups[i].layout is "group-equivalent" (value-equal) to pipelineLayout.bgls[i].
    - in the test fn, test once without the dispatch/draw (should always be valid) and once with
      the dispatch/draw, to make sure the validation happens in dispatch/draw.
    - x= {dispatch, all draws} (dispatch/draw should be size 0 to make sure validation still happens if no-op)
    - x= all relevant stages

TODO: subsume existing test, rewrite fixture as needed.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { assert } from '../../../../../common/util/util.js';
import { kSamplerBindingTypes, kBufferBindingTypes } from '../../../../capability_info.js';
import { ValidationTest } from '../../validation_test.js';

function getBindGroupLayouts(
  device: GPUDevice,
  bindGroups: Array<Array<GPUBindGroupLayoutEntry>>
): Array<GPUBindGroupLayout> {
  const bindGroupLayouts = [];
  for (let i = 0; i < bindGroups.length; ++i) {
    // Support empty bindGroupLayout
    const entries = [];
    for (let j = 0; j < bindGroups[i].length; ++j) {
      const binding = bindGroups[i][j];
      assert(binding !== undefined);
      entries.push(bindGroups[i][j]);
    }
    bindGroupLayouts.push(device.createBindGroupLayout({ entries }));
  }
  return bindGroupLayouts;
}

class F extends ValidationTest {
  getUniformBuffer(): GPUBuffer {
    return this.device.createBuffer({
      size: 8 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM,
    });
  }

  createRenderPipelineWithLayout(
    device: GPUDevice,
    bindGroups: Array<Array<GPUBindGroupLayoutEntry>>
  ): GPURenderPipeline {
    const shader = `
      [[stage(vertex)]] fn vs_main() -> [[builtin(position)]] vec4<f32> {
        return vec4<f32>(1.0, 1.0, 0.0, 1.0);
      }

      [[stage(fragment)]] fn fs_main() -> [[location(0)]] vec4<f32> {
        return vec4<f32>(0.0, 1.0, 0.0, 1.0);
      }
    `;
    const bindGroupLayouts = getBindGroupLayouts(this.device, bindGroups);

    const pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts }),
      vertex: {
        module: this.device.createShaderModule({
          code: shader,
        }),
        entryPoint: 'vs_main',
      },
      fragment: {
        module: this.device.createShaderModule({
          code: shader,
        }),
        entryPoint: 'fs_main',
        targets: [{ format: 'rgba8unorm' }],
      },
      primitive: { topology: 'triangle-list' },
    });
    return pipeline;
  }

  createComputePipeline(
    device: GPUDevice,
    bindGroups: Array<Array<GPUBindGroupLayoutEntry>>
  ): GPUComputePipeline {
    const shader = `
      [[stage(compute), workgroup_size(1, 1, 1)]]
        fn main([[builtin(global_invocation_id)]] GlobalInvocationID : vec3<u32>) {
      }
    `;
    const bindGroupLayouts = getBindGroupLayouts(this.device, bindGroups);
    const pipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts }),
      compute: {
        module: this.device.createShaderModule({
          code: shader,
        }),
        entryPoint: 'main',
      },
    });
    return pipeline;
  }

  createRenderPipeline(device: GPUDevice): GPURenderPipeline {
    return this.createRenderPipelineWithLayout(device, [
      // Group 0
      [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
      ],

      // Group 1
      [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {},
        },
      ],
    ]);
  }

  beginRenderPass(commandEncoder: GPUCommandEncoder): GPURenderPassEncoder {
    const attachmentTexture = this.device.createTexture({
      format: 'rgba8unorm',
      size: { width: 16, height: 16, depthOrArrayLayers: 1 },
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    return commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: attachmentTexture.createView(),
          loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
          storeOp: 'store',
        },
      ],
    });
  }
}

export const g = makeTestGroup(F);

g.test('it_is_invalid_to_draw_in_a_render_pass_with_missing_bind_groups')
  .paramsSubcasesOnly([
    { setBindGroup1: true, setBindGroup2: true, _success: true },
    { setBindGroup1: true, setBindGroup2: false, _success: false },
    { setBindGroup1: false, setBindGroup2: true, _success: false },
    { setBindGroup1: false, setBindGroup2: false, _success: false },
  ])
  .fn(async t => {
    const { setBindGroup1, setBindGroup2, _success } = t.params;

    const pipeline = t.createRenderPipeline(t.device);

    const uniformBuffer = t.getUniformBuffer();

    const bindGroup0 = t.device.createBindGroup({
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
          },
        },
      ],
      layout: t.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: {}, // default type: uniform
          },
        ],
      }),
    });

    const bindGroup1 = t.device.createBindGroup({
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
          },
        },
      ],
      layout: t.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: {}, // default type uniform
          },
        ],
      }),
    });

    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    renderPass.setPipeline(pipeline);
    if (setBindGroup1) {
      renderPass.setBindGroup(0, bindGroup0);
    }
    if (setBindGroup2) {
      renderPass.setBindGroup(1, bindGroup1);
    }
    renderPass.draw(3);
    renderPass.endPass();
    t.expectValidationError(() => {
      commandEncoder.finish();
    }, !_success);
  });

g.test('buffer_binding,render_pipeline')
  .desc(
    `
  The GPUBufferBindingLayout bindings configure should be exactly
  same in PipelineLayout and bindgroup.
  - TODO: test more draw functions, e.g. indirect
  - TODO: test more visibilities, e.g. vetex
  - TODO: bind group should be created with different layout
  `
  )
  .params(u => u.combine('type', kBufferBindingTypes))
  .fn(async t => {
    const { type } = t.params;

    // Create fixed bindGroup
    const uniformBuffer = t.getUniformBuffer();

    const bindGroup = t.device.createBindGroup({
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
          },
        },
      ],
      layout: t.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: {}, // default type: uniform
          },
        ],
      }),
    });

    // Create pipeline with different layouts
    const pipeline = t.createRenderPipelineWithLayout(t.device, [
      [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {
            type,
          },
        },
      ],
    ]);

    const success = type === undefined || type === 'uniform';

    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(3);
    renderPass.endPass();
    t.expectValidationError(() => {
      commandEncoder.finish();
    }, !success);
  });

g.test('sampler_binding,render_pipeline')
  .desc(
    `
  The GPUSamplerBindingLayout bindings configure should be exactly
  same in PipelineLayout and bindgroup.
  - TODO: test more draw functions, e.g. indirect
  - TODO: test more visibilities, e.g. vetex
  `
  )
  .params(u =>
    u //
      .combine('bglType', kSamplerBindingTypes)
      .combine('bgType', kSamplerBindingTypes)
  )
  .fn(async t => {
    const { bglType, bgType } = t.params;
    const bindGroup = t.device.createBindGroup({
      entries: [
        {
          binding: 0,
          resource:
            bgType === 'comparison'
              ? t.device.createSampler({ compare: 'always' })
              : t.device.createSampler(),
        },
      ],
      layout: t.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: { type: bgType },
          },
        ],
      }),
    });

    // Create pipeline with different layouts
    const pipeline = t.createRenderPipelineWithLayout(t.device, [
      [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {
            type: bglType,
          },
        },
      ],
    ]);

    const success = bglType === bgType;

    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(3);
    renderPass.endPass();
    t.expectValidationError(() => {
      commandEncoder.finish();
    }, !success);
  });
