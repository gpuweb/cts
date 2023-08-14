export const description = `Experimental reconvergence tests based on the Vulkan reconvergence tests at:
https://github.com/KhronosGroup/VK-GL-CTS/blob/main/external/vulkancts/modules/vulkan/reconvergence/vktReconvergenceTests.cpp`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import {
  assert,
  iterRange,
  TypedArrayBufferViewConstructor,
  unreachable
} from '../../../../common/util/util.js';
import { Style, Program, generateSeeds } from './util.js'

export const g = makeTestGroup(GPUTest);

/**
 * @returns The population count of input.
 */
function popcount(input: number): number {
  let n = input;
  n = n - ((n >> 1) & 0x55555555)
  n = (n & 0x33333333) + ((n >> 2) & 0x33333333)
  return ((n + (n >> 4) & 0xF0F0F0F) * 0x1010101) >> 24
}

/**
 * Checks that subgroup size reported by the shader is consistent.
 *
 * @param data GPUBuffer that stores the builtin value and uniform ballot count.
 * @param min  The device reported minimum subgroup size
 * @param max  The device reported maximum subgroup size
 *
 * @returns an error if either the builtin value or ballot count is outside [min, max],
 * not a a power of 2, or they do not match.
 */
function checkSubgroupSizeConsistency(data: Uint32Array, min: number, max: number): Error | undefined {
  const builtin: number = data[0];
  const ballot: number = data[1];
  if (popcount(builtin) != 1)
    return new Error(`Subgroup size builtin value (${builtin}) is not a power of two`);
  if (builtin < min)
    return new Error(`Subgroup size builtin value (${builtin}) is less than device minimum ${min}`);
  if (max < builtin)
    return new Error(`Subgroup size builtin value (${builtin}) is greater than device maximum ${max}`);

  if (popcount(ballot) != 1)
    return new Error(`Subgroup size ballot value (${builtin}) is not a power of two`);
  if (ballot < min)
    return new Error(`Subgroup size ballot value (${ballot}) is less than device minimum ${min}`);
  if (max < ballot)
    return new Error(`Subgroup size ballot value (${ballot}) is greater than device maximum ${max}`);

  if (builtin != ballot) {
    return new Error(`Subgroup size mismatch:
 - builtin value = ${builtin}
 - ballot = ${ballot}
`);
  }
  return undefined;
}

async function testProgram(t: GPUTest, program: Program) {
  let wgsl = program.genCode();
  console.log(wgsl);

  // TODO: query the device
  const minSubgroupSize = 4;
  const maxSubgroupSize = 128;

  let numLocs = 0;
  const locMap = new Map();
  for (var size = minSubgroupSize; size <= maxSubgroupSize; size *= 2) {
    let num = program.simulate(true, size);
    locMap.set(size, num);
    numLocs = Math.max(num, numLocs);
  }
  // Add 1 to ensure there are no extraneous writes.
  numLocs++;

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
    // Each location stores 16 bytes per invocation.
    size: numLocs * program.invocations * 4 * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  t.trackForCleanup(ballotBuffer);

  const locationBuffer = t.makeBufferWithContents(
    new Uint32Array([...iterRange(program.invocations, x => 0)]),
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  );
  t.trackForCleanup(locationBuffer);

  const sizeBuffer = t.makeBufferWithContents(
    new Uint32Array([...iterRange(2, x => 0)]),
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  );
  t.trackForCleanup(sizeBuffer);

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
      {
        binding: 3,
        resource: {
          buffer: sizeBuffer
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

  const sizeReadback = await t.readGPUBufferRangeTyped(
    sizeBuffer,
    {
      srcByteOffset: 0,
      type: Uint32Array,
      typedLength: 2,
      method: 'copy',
    }
  );
  const sizeData: Uint32Array = sizeReadback.data;
  const actualSize = sizeData[0];
  console.log(`Actual subgroup size = ${actualSize}`);
  t.expectOK(checkSubgroupSizeConsistency(sizeData, minSubgroupSize, maxSubgroupSize));

  //t.expectGPUBufferValuesPassCheck(
  //  sizeBuffer,
  //  a => checkSubgroupSizeConsistency(a, minSubgroupSize, maxSubgroupSize, actualSize),
  //  {
  //    srcByteOffset: 0,
  //    type: Uint32Array,
  //    typedLength: 2,
  //    method: 'copy',
  //    mode: 'fail',
  //  }
  //);

  //for (var i = minSubgroupSize; i <= maxSubgroupSize; i *= 2) {
  //  console.log(` Simulated locs for size ${i} = ${locMap.get(i)}`);
  //}
  //program.sizeRefData(locMap.get(actualSize));
  //console.log(`RefData length = ${program.refData.length}`);
  //let num = program.simulate(false, actualSize);
  //assert(num === locMap.get(actualSize));
}

g.test('predefined_reconvergence')
  .desc(`Test reconvergence using some predefined programs`)
  .params(u =>
    u
      .combine('test', [...iterRange(3, x => x)] as const)
      .beginSubcases()
  )
  //.beforeAllSubcases(t => {
  //  t.selectDeviceOrSkipTestCase({ requiredFeatures: ['chromium-experimental-subgroups'] });
  //})
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
  //.beforeAllSubcases(t => {
  //  t.selectDeviceOrSkipTestCase({requiredFeatures: ['chromium-experimental-subgroups']});
  //})
  .fn(async t => {
    const invocations = 128; // t.device.limits.maxSubgroupSize;

    let program: Program = new Program(t.params.style, t.params.seed, invocations);
    program.generate();

    await testProgram(t, program);
  });
