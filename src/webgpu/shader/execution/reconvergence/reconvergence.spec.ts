export const description = `Experimental reconvergence tests based on the Vulkan reconvergence tests at:
https://github.com/KhronosGroup/VK-GL-CTS/blob/main/external/vulkancts/modules/vulkan/reconvergence/vktReconvergenceTests.cpp`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { iterRange, unreachable } from '../../../../common/util/util.js';
import { Style, Program, generateSeeds } from './util.js'

export const g = makeTestGroup(GPUTest);

function testProgram(t: GPUTest, program: Program) {
  let wgsl = program.genCode();
  console.log(wgsl);

  let num = program.simulate(true, 16);
  console.log(`Max locations = ${num}`);

  num = program.simulate(true, 32);
  console.log(`Max locations = ${num}`);

  const pipeline = t.device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: t.device.createShaderModule({
        code: wgsl,
      }),
      entryPoint: 'main',
    },
  });

  const inputBuffer = t.makeBufferWithContents(
    new Uint32Array([...iterRange(128, x => x)]),
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  );
  t.trackForCleanup(inputBuffer);

  const ballotBuffer = t.device.createBuffer({
    size: 128 * 4, // TODO: FIXME
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  t.trackForCleanup(ballotBuffer);

  const locationBuffer = t.makeBufferWithContents(
    new Uint32Array([...iterRange(program.invocations, x => 0)]),
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  );
  t.trackForCleanup(locationBuffer);

  const bindGroup = t.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: inputBuffer
        },
      },
      {
        binding: 1,
        resource: {
          buffer: ballotBuffer
        },
      },
      {
        binding: 2,
        resource: {
          buffer: locationBuffer
        },
      },
    ],
  });

  const encoder = t.device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(1,1,1);
  pass.end();
  t.queue.submit([encoder.finish()]);
}

g.test('predefined_reconvergence')
  .desc(`Test reconvergence using some predefined programs`)
  .params(u =>
    u
      .combine('test', [...iterRange(3, x => x)] as const)
      .beginSubcases()
  )
  .fn(t => {
    const invocations = 128; // t.device.limits.maxSubgroupSize;

    let program: Program;
    switch (t.params.test) {
      case 0: {
        program = new Program(Style.Workgroup, 1, invocations);
        program.predefinedProgram1();
        break;
      }
      case 1: {
        program = new Program(Style.Subgroup, 1, invocations);
        program.predefinedProgram1();
        break;
      }
      case 2: {
        program = new Program(Style.Subgroup, 1, invocations);
        program.predefinedProgram2();
        break;
      }
      default: {
        program = new Program();
        unreachable('Unhandled testcase');
      }
    }

    testProgram(t, program);
  });

g.test('random_reconvergence')
  .desc(`Test reconvergence using randomly generated programs`)
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
    program.generate();

    testProgram(t, program);
  });
