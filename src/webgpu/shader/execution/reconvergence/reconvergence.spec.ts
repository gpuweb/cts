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
import {
  hex,
  Style,
  Program,
  generateSeeds
} from './util.js'

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

/**
 * Checks the mapping of subgroup_invocation_id to local_invocation_index
 */
function checkIds(data: Uint32Array, subgroupSize: number): Error | undefined {
  for (let i = 0; i < data.length; i++) {
    if (data[i] !== (i % subgroupSize)) {
      return Error(`subgroup_invocation_id does not map as assumed to local_invocation_index:
location_invocation_index = ${i}
subgroup_invocation_id = ${data[i]}`);
    }
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
  for (let size = minSubgroupSize; size <= maxSubgroupSize; size *= 2) {
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

  // Inputs have a value equal to their index.
  const inputBuffer = t.makeBufferWithContents(
    new Uint32Array([...iterRange(128, x => x)]),
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  );
  t.trackForCleanup(inputBuffer);

  // Each location stores 4 uint32s per invocation.
  const ballotLength = numLocs * program.invocations * 4;
  const ballotBuffer = t.makeBufferWithContents(
    new Uint32Array([...iterRange(ballotLength, x => 0)]),
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  );
  t.trackForCleanup(ballotBuffer);

  const locationLength = program.invocations;
  const locationBuffer = t.makeBufferWithContents(
    new Uint32Array([...iterRange(locationLength, x => 0)]),
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  );
  t.trackForCleanup(locationBuffer);

  const sizeLength = 2;
  const sizeBuffer = t.makeBufferWithContents(
    new Uint32Array([...iterRange(sizeLength, x => 0)]),
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  );
  t.trackForCleanup(sizeBuffer);

  const idLength = program.invocations;
  const idBuffer = t.makeBufferWithContents(
    new Uint32Array([...iterRange(idLength, x => 0)]),
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  );
  t.trackForCleanup(idBuffer);

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
      {
        binding: 4,
        resource: {
          buffer: idBuffer
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

  // The simulaton assumes subgroup_invocation_id maps directly to local_invocation_index.
  // That is:
  // SID: 0, 1, 2, ..., SGSize-1, 0, ..., SGSize-1, ...
  // LID: 0, 1, 2, ..., 128
  // Generate a warning if this is not true of the device.
  // This mapping is not guaranteed by APIs (Vulkan particularly), but seems reliable
  // (for linear workgroups at least).
  const sizeReadback = await t.readGPUBufferRangeTyped(
    sizeBuffer,
    {
      srcByteOffset: 0,
      type: Uint32Array,
      typedLength: sizeLength,
      method: 'copy',
    }
  );
  const sizeData: Uint32Array = sizeReadback.data;
  const actualSize = sizeData[0];
  t.expectOK(checkSubgroupSizeConsistency(sizeData, minSubgroupSize, maxSubgroupSize));

  program.sizeRefData(locMap.get(actualSize));
  let num = program.simulate(false, actualSize);

  const idReadback = await t.readGPUBufferRangeTyped(
    idBuffer,
    {
      srcByteOffset: 0,
      type: Uint32Array,
      typedLength: idLength,
      method: 'copy',
    }
  );
  const idData = idReadback.data;
  t.expectOK(checkIds(idData, actualSize), { mode: 'warn' });

  const locationReadback = await t.readGPUBufferRangeTyped(
    locationBuffer,
    {
      srcByteOffset: 0,
      type: Uint32Array,
      typedLength: locationLength,
      method: 'copy',
    }
  );
  const locationData = locationReadback.data;

  const ballotReadback = await t.readGPUBufferRangeTyped(
    ballotBuffer,
    {
      srcByteOffset: 0,
      type: Uint32Array,
      typedLength: ballotLength,
      method: 'copy',
    }
  );
  const ballotData = ballotReadback.data;

  console.log(`Ballots`);
  for (let id = 0; id < program.invocations; id++) {
    console.log(` id[${id}]:`);
    for (let loc = 0; loc < numLocs; loc++) {
      const idx = 4 * (program.invocations * loc + id);
      console.log(`  loc[${loc}] = (${hex(ballotData[idx+3])},${hex(ballotData[idx+2])},${hex(ballotData[idx+1])},${hex(ballotData[idx])}), (${ballotData[idx+3]},${ballotData[idx+2]},${ballotData[idx+1]},${ballotData[idx]})`);
    }
  }

  t.expectOK(program.checkResults(ballotData, locationData, actualSize, num));
}

g.test('predefined_reconvergence')
  .desc(`Test reconvergence using some predefined programs`)
  .params(u =>
    u
      .combine('test', [...iterRange(4, x => x)] as const)
      .beginSubcases()
  )
  //.beforeAllSubcases(t => {
  //  t.selectDeviceOrSkipTestCase({ requiredFeatures: ['chromium-experimental-subgroups'] });
  //})
  .fn(async t => {
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
      case 3: {
        program = new Program(Style.Maximal, 1, invocations);
        program.predefinedProgram3();
        break;
      }
      default: {
        program = new Program();
        unreachable('Unhandled testcase');
      }
    }

    await testProgram(t, program);
  });

g.test('random_reconvergence')
  .desc(`Test reconvergence using randomly generated programs`)
  .params(u =>
    u
      .combine('style', [Style.Workgroup, Style.Subgroup, Style.Maximal] as const)
      .combine('seed', generateSeeds(5))
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
