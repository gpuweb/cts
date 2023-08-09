export const description = `Experimental reconvergence tests based on the Vulkan reconvergence tests at:
https://github.com/KhronosGroup/VK-GL-CTS/blob/main/external/vulkancts/modules/vulkan/reconvergence/vktReconvergenceTests.cpp`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { Style, Program, generateSeeds } from './util.js'

export const g = makeTestGroup(GPUTest);

g.test('reconvergence')
  .desc(`Test reconvergence`)
  .params(u =>
    u
      .combine('style', [Style.Workgroup, Style.Subgroup, Style.Maximal] as const)
      .combine('seed', generateSeeds(5))
      .filter(u => {
        if (u.style == Style.Workgroup) {
          return true;
        }
        return false;
      })
      .beginSubcases()
  )
  .fn(t => {
    const invocations = 128; // t.device.limits.maxSubgroupSize;

    let program: Program = new Program(t.params.style, t.params.seed, invocations);
    let wgsl = program.generate();
    console.log(wgsl);

    const num = program.simulate(true, 16);

    const pipeline = t.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: t.device.createShaderModule({
          code: wgsl,
        }),
        entryPoint: 'main',
      },
    });

    //// Helper to create a `size`-byte buffer with binding number `binding`.
    //function createBuffer(size: number, binding: number) {
    //  const buffer = t.device.createBuffer({
    //    size,
    //    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    //  });
    //  t.trackForCleanup(buffer);

    //  bindGroupEntries.push({
    //    binding,
    //    resource: {
    //      buffer,
    //    },
    //  });

    //  return buffer;
    //}

    //const bindGroupEntries: GPUBindGroupEntry[] = [];
    //const inputBuffer = createBuffer(16, 0);
    //const ballotBuffer = createBuffer(16, 1);

    //const bindGroup = t.device.createBindGroup({
    //  layout: pipeline.getBindGroupLayout(0),
    //  entries: bindGroupEntries,
    //});

    //const encoder = t.device.createCommandEncoder();
    //const pass = encoder.beginComputePass();
    //pass.setPipeline(pipeline);
    //pass.setBindGroup(0, bindGroup);
    //pass.dispatchWorkgroups(1,1,1);
    //pass.end();
    //t.queue.submit([encoder.finish()]);
  });
