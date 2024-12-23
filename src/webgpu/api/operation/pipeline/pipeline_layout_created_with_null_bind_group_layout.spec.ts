export const description = `
Tests for the creation of pipeline layouts with null bind group layouts.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUConst } from '../../../constants.js';
import { GPUTest } from '../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('pipeline_layout_with_null_bind_group_layout,rendering')
  .desc(
    `
Tests that using a render pipeline created with a pipeline layout that has null bind group layout
works correctly.
`
  )
  .params(u =>
    u
      .combine('emptyBindGroupLayoutType', ['Null', 'Undefined'] as const)
      .combine('emptyBindGroupLayoutIndex', [0, 1, 2, 3] as const)
  )
  .fn(t => {
    const { emptyBindGroupLayoutType, emptyBindGroupLayoutIndex } = t.params;

    const colors = [
      [0.2, 0, 0, 0.2],
      [0, 0.2, 0, 0.2],
      [0, 0, 0.2, 0.2],
      [0.4, 0, 0, 0.2],
    ] as const;
    const outputColor = [0.0, 0.0, 0.0, 0.0];

    let declarations = '';
    let statement = 'return vec4(0.0, 0.0, 0.0, 0.0)';
    const bindGroupLayouts: (GPUBindGroupLayout | null | undefined)[] = [];
    const bindGroups: (GPUBindGroup | null)[] = [];
    for (let bindGroupIndex = 0; bindGroupIndex < 4; ++bindGroupIndex) {
      if (bindGroupIndex === emptyBindGroupLayoutIndex) {
        switch (emptyBindGroupLayoutType) {
          case 'Null':
            bindGroupLayouts.push(null);
            break;
          case 'Undefined':
            bindGroupLayouts.push(undefined);
            break;
        }
        bindGroups.push(null);
        continue;
      }

      declarations += `@group(${bindGroupIndex}) @binding(0) var<uniform> input${bindGroupIndex} : vec4f;\n`;
      statement += ` + input${bindGroupIndex}`;

      const bindGroupLayout = t.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUConst.ShaderStage.FRAGMENT,
            buffer: {
              type: 'uniform',
              minBindingSize: 16,
            },
          },
        ],
      });
      bindGroupLayouts.push(bindGroupLayout);

      const color = colors[bindGroupIndex];
      const buffer = t.createBufferTracked({
        usage: GPUBufferUsage.UNIFORM,
        size: 16,
        mappedAtCreation: true,
      });
      const bufferData = new Float32Array(buffer.getMappedRange());
      for (let i = 0; i < color.length; ++i) {
        bufferData[i] = color[i];

        outputColor[i] += color[i];
      }
      buffer.unmap();

      const bindGroup = t.device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: {
              buffer,
            },
          },
        ],
      });
      bindGroups.push(bindGroup);
    }

    const pipelineLayout = t.device.createPipelineLayout({
      bindGroupLayouts,
    });

    const format = 'rgba8unorm';
    const code = `
    ${declarations}
    @vertex
    fn vert_main() -> @builtin(position) vec4f {
        return vec4f(0.0, 0.0, 0.0, 1.0);
    }
    @fragment
    fn frag_main() -> @location(0) vec4f {
        ${statement};
    }
    `;
    const shaderModule = t.device.createShaderModule({
      code,
    });
    const renderPipeline = t.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
      },
      fragment: {
        module: shaderModule,
        targets: [
          {
            format,
          },
        ],
      },
      primitive: {
        topology: 'point-list',
      },
    });

    const renderTarget = t.createTextureTracked({
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      size: [1, 1, 1],
      format,
    });
    const commandEncoder = t.device.createCommandEncoder();
    const renderPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: renderTarget.createView(),
          loadOp: 'load',
          storeOp: 'store',
        },
      ],
    });
    for (let i = 0; i < 4; ++i) {
      renderPassEncoder.setBindGroup(i, bindGroups[i]);
    }
    renderPassEncoder.setPipeline(renderPipeline);
    renderPassEncoder.draw(1);
    renderPassEncoder.end();

    t.queue.submit([commandEncoder.finish()]);

    t.expectSingleColor(renderTarget, format, {
      size: [1, 1, 1],
      exp: { R: outputColor[0], G: outputColor[1], B: outputColor[2], A: outputColor[3] },
    });
  });

g.test('pipeline_layout_with_null_bind_group_layout,compute')
  .desc(
    `
Tests that using a compute pipeline created with a pipeline layout that has null bind group layout
works correctly.
`
  )
  .params(u =>
    u
      .combine('emptyBindGroupLayoutType', ['Null', 'Undefined'] as const)
      .combine('emptyBindGroupLayoutIndex', [0, 1, 2, 3] as const)
  )
  .fn(t => {
    const { emptyBindGroupLayoutType, emptyBindGroupLayoutIndex } = t.params;

    let declarations = '';
    let statement = 'output = 0u ';

    const outputBuffer = t.createBufferTracked({
      size: 4,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE,
    });
    let expectedValue = 0;

    const bindGroupLayouts: (GPUBindGroupLayout | null | undefined)[] = [];
    const bindGroups: (GPUBindGroup | null)[] = [];
    let outputDeclared = false;
    for (let bindGroupIndex = 0; bindGroupIndex < 4; ++bindGroupIndex) {
      if (bindGroupIndex === emptyBindGroupLayoutIndex) {
        switch (emptyBindGroupLayoutType) {
          case 'Null':
            bindGroupLayouts.push(null);
            break;
          case 'Undefined':
            bindGroupLayouts.push(undefined);
            break;
        }
        bindGroups.push(null);
        continue;
      }

      declarations += `@group(${bindGroupIndex}) @binding(0) var<uniform> input${bindGroupIndex} : u32;\n`;
      statement += ` + input${bindGroupIndex}`;

      const inputBuffer = t.createBufferTracked({
        usage: GPUBufferUsage.UNIFORM,
        size: 4,
        mappedAtCreation: true,
      });
      const bufferData = new Uint32Array(inputBuffer.getMappedRange());
      bufferData[0] = bindGroupIndex + 1;
      expectedValue += bindGroupIndex + 1;
      inputBuffer.unmap();

      const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [];
      const bindGroupEntries: GPUBindGroupEntry[] = [];
      bindGroupLayoutEntries.push({
        binding: 0,
        visibility: GPUConst.ShaderStage.COMPUTE,
        buffer: {
          type: 'uniform',
          minBindingSize: 4,
        },
      });
      bindGroupEntries.push({
        binding: 0,
        resource: {
          buffer: inputBuffer,
        },
      });

      if (!outputDeclared) {
        bindGroupLayoutEntries.push({
          binding: 1,
          visibility: GPUConst.ShaderStage.COMPUTE,
          buffer: {
            type: 'storage',
            minBindingSize: 4,
          },
        });
        bindGroupEntries.push({
          binding: 1,
          resource: {
            buffer: outputBuffer,
          },
        });
        declarations += `@group(${bindGroupIndex}) @binding(1) var<storage, read_write> output : u32;\n`;
        outputDeclared = true;
      }

      const bindGroupLayout = t.device.createBindGroupLayout({
        entries: bindGroupLayoutEntries,
      });
      bindGroupLayouts.push(bindGroupLayout);

      const bindGroup = t.device.createBindGroup({
        layout: bindGroupLayout,
        entries: bindGroupEntries,
      });
      bindGroups.push(bindGroup);
    }

    const pipelineLayout = t.device.createPipelineLayout({
      bindGroupLayouts,
    });

    const code = `
    ${declarations}
    @compute @workgroup_size(1, 1)
    fn main() {
      ${statement};
    }
    `;
    const module = t.device.createShaderModule({
      code,
    });
    const computePipeline = t.device.createComputePipeline({
      layout: pipelineLayout,
      compute: {
        module,
      },
    });

    const commandEncoder = t.device.createCommandEncoder();
    const computePassEncoder = commandEncoder.beginComputePass();
    for (let i = 0; i < bindGroups.length; ++i) {
      computePassEncoder.setBindGroup(i, bindGroups[i]);
    }
    computePassEncoder.setPipeline(computePipeline);
    computePassEncoder.dispatchWorkgroups(1);
    computePassEncoder.end();

    t.queue.submit([commandEncoder.finish()]);

    const expectedValues = new Uint32Array(1);
    expectedValues[0] = expectedValue;
    t.expectGPUBufferValuesEqual(outputBuffer, expectedValues);
  });
