export const description = `
Test other buffer usage validation rules that are not tests in ./in_pass_encoder.spec.js.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';

import { BufferResourceUsageTest, kAllBufferUsages } from './in_pass_encoder.spec.js';

export const g = makeTestGroup(BufferResourceUsageTest);

const kBufferSize = 256;

g.test('subresources,reset_buffer_usage_before_dispatch')
  .desc(
    `
Test that the buffer usages which are reset by another state-setting commands before a dispatch call
do not contribute directly to any usage scope in a compute pass.`
  )
  .params(u =>
    u
      .combine('usage0', ['uniform', 'storage', 'read-only-storage'] as const)
      .combine('usage1', ['uniform', 'storage', 'read-only-storage', 'indirect'] as const)
  )
  .fn(async t => {
    const { usage0, usage1 } = t.params;

    const kUsages = GPUBufferUsage.UNIFORM | GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT;
    const buffer = t.createBufferWithState('valid', {
      size: kBufferSize,
      usage: kUsages,
    });
    const anotherBuffer = t.createBufferWithState('valid', {
      size: kBufferSize,
      usage: kUsages,
    });

    const bindGroupLayouts: GPUBindGroupLayout[] = [
      t.createBindGroupLayoutForTest(usage0, 'compute'),
    ];
    if (usage1 !== 'indirect') {
      bindGroupLayouts.push(t.createBindGroupLayoutForTest(usage1, 'compute'));
    }
    const pipelineLayout = t.device.createPipelineLayout({ bindGroupLayouts });
    const computePipeline = t.createNoOpComputePipeline(pipelineLayout);

    const encoder = t.device.createCommandEncoder();
    const computePassEncoder = encoder.beginComputePass();
    computePassEncoder.setPipeline(computePipeline);

    // Set usage0 for buffer at bind group index 0
    const bindGroup0 = t.createBindGroupForTest(buffer, 0, usage0, 'compute');
    computePassEncoder.setBindGroup(0, bindGroup0);

    // Reset bind group index 0 with another bind group that uses anotherBuffer
    const anotherBindGroup = t.createBindGroupForTest(anotherBuffer, 0, usage0, 'compute');
    computePassEncoder.setBindGroup(0, anotherBindGroup);

    // Set usage1 for buffer
    switch (usage1) {
      case 'uniform':
      case 'storage':
      case 'read-only-storage': {
        const bindGroup1 = t.createBindGroupForTest(buffer, 0, usage1, 'compute');
        computePassEncoder.setBindGroup(1, bindGroup1);
        computePassEncoder.dispatchWorkgroups(1);
        break;
      }
      case 'indirect': {
        computePassEncoder.dispatchWorkgroupsIndirect(buffer, 0);
        break;
      }
    }
    computePassEncoder.end();

    t.expectValidationError(() => {
      encoder.finish();
    }, false);
  });

g.test('subresources,reset_buffer_usage_before_draw')
  .desc(
    `
Test that the buffer usages which are reset by another state-setting commands before a draw call
still contribute directly to the usage scope of the draw call.`
  )
  .params(u =>
    u
      .combine('usage0', ['uniform', 'storage', 'read-only-storage', 'vertex', 'index'] as const)
      .combine('usage1', kAllBufferUsages)
      .unless(t => {
        return t.usage0 === 'index' && t.usage1 === 'indirect';
      })
  )
  .fn(async t => {
    const { usage0, usage1 } = t.params;

    const kUsages =
      GPUBufferUsage.UNIFORM |
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.INDIRECT |
      GPUBufferUsage.VERTEX |
      GPUBufferUsage.INDEX;
    const buffer = t.createBufferWithState('valid', {
      size: kBufferSize,
      usage: kUsages,
    });
    const anotherBuffer = t.createBufferWithState('valid', {
      size: kBufferSize,
      usage: kUsages,
    });

    const encoder = t.device.createCommandEncoder();
    const renderPassEncoder = t.beginSimpleRenderPass(encoder);

    const bindGroupLayouts: GPUBindGroupLayout[] = [];
    let vertexBufferCount = 0;

    // Set buffer as usage0 and reset buffer with anotherBuffer as usage0
    switch (usage0) {
      case 'uniform':
      case 'storage':
      case 'read-only-storage': {
        const bindGroup0 = t.createBindGroupForTest(buffer, 0, usage0, 'fragment');
        renderPassEncoder.setBindGroup(bindGroupLayouts.length, bindGroup0);

        const anotherBindGroup = t.createBindGroupForTest(anotherBuffer, 0, usage0, 'fragment');
        renderPassEncoder.setBindGroup(bindGroupLayouts.length, anotherBindGroup);

        bindGroupLayouts.push(t.createBindGroupLayoutForTest(usage0, 'fragment'));
        break;
      }
      case 'vertex': {
        renderPassEncoder.setVertexBuffer(vertexBufferCount, buffer);
        renderPassEncoder.setVertexBuffer(vertexBufferCount, anotherBuffer);

        ++vertexBufferCount;
        break;
      }
      case 'index': {
        renderPassEncoder.setIndexBuffer(buffer, 'uint16');
        renderPassEncoder.setIndexBuffer(anotherBuffer, 'uint16');
        break;
      }
    }

    // Set buffer as usage1
    switch (usage1) {
      case 'uniform':
      case 'storage':
      case 'read-only-storage': {
        const bindGroup1 = t.createBindGroupForTest(buffer, 0, usage1, 'fragment');
        renderPassEncoder.setBindGroup(bindGroupLayouts.length, bindGroup1);

        bindGroupLayouts.push(t.createBindGroupLayoutForTest(usage1, 'fragment'));
        break;
      }
      case 'vertex': {
        renderPassEncoder.setVertexBuffer(vertexBufferCount, buffer);
        ++vertexBufferCount;
        break;
      }
      case 'index': {
        renderPassEncoder.setIndexBuffer(buffer, 'uint16');
        break;
      }
      case 'indirect':
      case 'indexedIndirect':
        break;
    }

    // Add draw call
    const pipelineLayout = t.device.createPipelineLayout({
      bindGroupLayouts,
    });
    const renderPipeline = t.createRenderPipelineForTest(pipelineLayout, vertexBufferCount);
    renderPassEncoder.setPipeline(renderPipeline);
    switch (usage1) {
      case 'indexedIndirect': {
        if (usage0 !== 'index') {
          const indexBuffer = t.createBufferWithState('valid', {
            size: 4,
            usage: GPUBufferUsage.INDEX,
          });
          renderPassEncoder.setIndexBuffer(indexBuffer, 'uint16');
        }
        renderPassEncoder.drawIndexedIndirect(buffer, 0);
        break;
      }
      case 'indirect': {
        renderPassEncoder.drawIndirect(buffer, 0);
        break;
      }
      case 'index': {
        renderPassEncoder.drawIndexed(1);
        break;
      }
      case 'vertex':
      case 'uniform':
      case 'storage':
      case 'read-only-storage': {
        if (usage0 === 'index') {
          renderPassEncoder.drawIndexed(1);
        } else {
          renderPassEncoder.draw(1);
        }
        break;
      }
    }

    renderPassEncoder.end();

    const fail = (usage0 === 'storage') !== (usage1 === 'storage');
    t.expectValidationError(() => {
      encoder.finish();
    }, fail);
  });
