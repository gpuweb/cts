export const description = `Experimental reconvergence tests based on the Vulkan reconvergence tests at:
https://github.com/KhronosGroup/VK-GL-CTS/blob/main/external/vulkancts/modules/vulkan/reconvergence/vktReconvergenceTests.cpp`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { iterRange, unreachable } from '../../../../common/util/util.js';
import { GPUTest } from '../../../gpu_test.js';

import { /*hex, */ Style, OpType, Program, generateSeeds } from './util.js';

export const g = makeTestGroup(GPUTest);

/**
 * @returns The population count of input.
 */
function popcount(input: number): number {
  let n = input;
  n = n - ((n >> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
  return (((n + (n >> 4)) & 0xf0f0f0f) * 0x1010101) >> 24;
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
function checkSubgroupSizeConsistency(
  data: Uint32Array,
  min: number,
  max: number
): Error | undefined {
  const builtin: number = data[0];
  const ballot: number = data[1];
  if (popcount(builtin) !== 1)
    return new Error(`Subgroup size builtin value (${builtin}) is not a power of two`);
  if (builtin < min)
    return new Error(`Subgroup size builtin value (${builtin}) is less than device minimum ${min}`);
  if (max < builtin)
    return new Error(
      `Subgroup size builtin value (${builtin}) is greater than device maximum ${max}`
    );

  if (popcount(ballot) !== 1)
    return new Error(`Subgroup size ballot value (${builtin}) is not a power of two`);
  if (ballot < min)
    return new Error(`Subgroup size ballot value (${ballot}) is less than device minimum ${min}`);
  if (max < ballot)
    return new Error(
      `Subgroup size ballot value (${ballot}) is greater than device maximum ${max}`
    );

  if (builtin !== ballot) {
    let msg = `Subgroup size mismatch:\n`;
    msg += `- builtin value = ${builtin}\n`;
    msg += `- ballot = ${ballot}`;
    return Error(msg);
  }
  return undefined;
}

//function dumpBallots(
//  ballots: Uint32Array,
//  totalInvocations: number,
//  invocations: number,
//  locations: number
//) {
//  let dump = `Ballots\n`;
//  for (let id = 0; id < invocations; id++) {
//    dump += `id[${id}]\n`;
//    for (let loc = 0; loc < locations; loc++) {
//      const idx = 4 * (totalInvocations * loc + id);
//      const w = ballots[idx + 3];
//      const z = ballots[idx + 2];
//      const y = ballots[idx + 1];
//      const x = ballots[idx + 0];
//      dump += ` loc[${loc}] = (0x${hex(w)},0x${hex(z)},0x${hex(y)},0x${hex(
//        x
//      )}), (${w},${z},${y},${x})\n`;
//    }
//  }
//  console.log(dump);
//}

/**
 * Checks the mapping of subgroup_invocation_id to local_invocation_index
 */
function checkIds(data: Uint32Array, subgroupSize: number): Error | undefined {
  for (let i = 0; i < data.length; i++) {
    if (data[i] !== i % subgroupSize) {
      let msg = `subgroup_invocation_id does map as assumed to local_invocation_index:\n`;
      msg += `location_invocation_index = ${i}\n`;
      msg += `subgroup_invocation_id = ${data[i]}`;
      return Error(msg);
    }
  }
  return undefined;
}

/**
 * Bitmask for debug information:
 *
 * 0x1  - wgsl
 * 0x2  - stats
 * 0x4  - terminate after wgsl
 * 0x8  - simulation active masks
 * 0x10 - simulation reference data
 * 0x20 - gpu data
 *
 * So setting kDebugLevel to 0x5 would dump WGSL and end the test.
 */
const kDebugLevel = 0x00;

async function testProgram(t: GPUTest, program: Program) {
  const wgsl = program.genCode();
  //if (kDebugLevel & 0x1) {
  //  console.log(wgsl);
  //}
  //if (kDebugLevel & 0x2) {
  //  program.dumpStats(true);
  //}
  if (kDebugLevel & 0x4) {
    return;
  }

  // Query the limits when they are wired up.
  const minSubgroupSize = 4;
  const maxSubgroupSize = 128;

  let numLocs = 0;
  const locMap = new Map();
  for (let size = minSubgroupSize; size <= maxSubgroupSize; size *= 2) {
    const num = program.simulate(true, size);
    locMap.set(size, num);
    numLocs = Math.max(num, numLocs);
  }
  if (numLocs > program.maxLocations) {
    t.expectOK(Error(`Total locations (${numLocs}) truncated to ${program.maxLocations}`), {
      mode: 'warn',
    });
    numLocs = program.maxLocations;
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
    new Uint32Array([...iterRange(129, x => x)]),
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

  //const locationLength = program.invocations;
  //const locationBuffer = t.makeBufferWithContents(
  //  new Uint32Array([...iterRange(locationLength, x => 0)]),
  //    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  //);
  //t.trackForCleanup(locationBuffer);

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
          buffer: inputBuffer,
        },
      },
      {
        binding: 1,
        resource: {
          buffer: ballotBuffer,
        },
      },
      //{
      //  binding: 2,
      //  resource: {
      //    buffer: locationBuffer
      //  },
      //},
      {
        binding: 3,
        resource: {
          buffer: sizeBuffer,
        },
      },
      {
        binding: 4,
        resource: {
          buffer: idBuffer,
        },
      },
    ],
  });

  const encoder = t.device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(1, 1, 1);
  pass.end();
  t.queue.submit([encoder.finish()]);

  // The simulaton assumes subgroup_invocation_id maps directly to local_invocation_index.
  // That is:
  // SID: 0, 1, 2, ..., SGSize-1, 0, ..., SGSize-1, ...
  // LID: 0, 1, 2, ..., 128
  //
  // Generate a warning if this is not true of the device.
  // This mapping is not guaranteed by APIs (Vulkan particularly), but seems reliable
  // (for linear workgroups at least).
  const sizeReadback = await t.readGPUBufferRangeTyped(sizeBuffer, {
    srcByteOffset: 0,
    type: Uint32Array,
    typedLength: sizeLength,
    method: 'copy',
  });
  const sizeData: Uint32Array = sizeReadback.data;
  const actualSize = sizeData[0];
  t.expectOK(checkSubgroupSizeConsistency(sizeData, minSubgroupSize, maxSubgroupSize));

  program.sizeRefData(locMap.get(actualSize));
  const debug = (kDebugLevel & 0x8) !== 0;
  let num = program.simulate(false, actualSize, debug);
  num = Math.min(program.maxLocations, num);

  const idReadback = await t.readGPUBufferRangeTyped(idBuffer, {
    srcByteOffset: 0,
    type: Uint32Array,
    typedLength: idLength,
    method: 'copy',
  });
  const idData = idReadback.data;
  t.expectOK(checkIds(idData, actualSize), { mode: 'warn' });

  //const locationReadback = await t.readGPUBufferRangeTyped(
  //  locationBuffer,
  //  {
  //    srcByteOffset: 0,
  //    type: Uint32Array,
  //    typedLength: locationLength,
  //    method: 'copy',
  //  }
  //);
  //const locationData = locationReadback.data;

  const ballotReadback = await t.readGPUBufferRangeTyped(ballotBuffer, {
    srcByteOffset: 0,
    type: Uint32Array,
    typedLength: ballotLength,
    method: 'copy',
  });
  const ballotData = ballotReadback.data;

  // Only dump a single subgroup
  //if (kDebugLevel & 0x10) {
  //  console.log(`${new Date()}: Reference data`);
  //  dumpBallots(program.refData, program.invocations, actualSize, num);
  //}
  //if (kDebugLevel & 0x20) {
  //  console.log(`${new Date()}: GPU data`);
  //  dumpBallots(ballotData, program.invocations, actualSize, num);
  //}

  t.expectOK(program.checkResults(ballotData, /*locationData,*/ actualSize, num));
}

const kNumInvocations = 128;

async function predefinedTest(t: GPUTest, style: Style, test: number) {
  const invocations = kNumInvocations; // t.device.limits.maxSubgroupSize;

  const program: Program = new Program(style, 1, invocations);
  switch (test) {
    case 0: {
      program.predefinedProgram1();
      break;
    }
    case 1: {
      program.predefinedProgram2();
      break;
    }
    case 2: {
      program.predefinedProgram3();
      break;
    }
    case 3: {
      program.predefinedProgramInf();
      break;
    }
    case 4: {
      program.predefinedProgramForVar();
      break;
    }
    case 5: {
      program.predefinedProgramCall();
      break;
    }
    case 6: {
      program.predefinedProgram1(OpType.LoopUniform, OpType.EndLoopUniform);
      break;
    }
    case 7: {
      program.predefinedProgramInf(OpType.LoopInf, OpType.EndLoopInf);
      break;
    }
    case 8: {
      program.predefinedProgramSwitchUniform();
      break;
    }
    case 9: {
      program.predefinedProgramSwitchVar();
      break;
    }
    case 10: {
      program.predefinedProgramSwitchLoopCount(0);
      break;
    }
    case 11: {
      program.predefinedProgramSwitchLoopCount(1);
      break;
    }
    case 12: {
      program.predefinedProgramSwitchLoopCount(2);
      break;
    }
    case 13: {
      program.predefinedProgramSwitchMulticase();
      break;
    }
    case 14: {
      program.predefinedProgramWGSLv1();
      break;
    }
    case 15: {
      program.predefinedProgramAllUniform();
      break;
    }
    default: {
      unreachable('Unhandled testcase');
    }
  }

  await testProgram(t, program);
}

const kPredefinedTestCases = [...iterRange(16, x => x)];

g.test('predefined_workgroup')
  .desc(`Test workgroup reconvergence using some predefined programs`)
  .params(u => u.combine('test', kPredefinedTestCases).beginSubcases())
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase({
      requiredFeatures: ['chromium-experimental-subgroups' as GPUFeatureName],
    });
  })
  .fn(async t => {
    await predefinedTest(t, Style.Workgroup, t.params.test);
  });

g.test('predefined_subgroup')
  .desc(`Test subgroup reconvergence using some predefined programs`)
  .params(u => u.combine('test', kPredefinedTestCases).beginSubcases())
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase({
      requiredFeatures: ['chromium-experimental-subgroups' as GPUFeatureName],
    });
  })
  .fn(async t => {
    await predefinedTest(t, Style.Subgroup, t.params.test);
  });

g.test('predefined_maximal')
  .desc(`Test maximal reconvergence using some predefined programs`)
  .params(u => u.combine('test', kPredefinedTestCases).beginSubcases())
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase({
      requiredFeatures: ['chromium-experimental-subgroups' as GPUFeatureName],
    });
  })
  .fn(async t => {
    await predefinedTest(t, Style.Maximal, t.params.test);
  });

g.test('predefined_wgslv1')
  .desc(`Test WGSL v1 reconvergence using some predefined programs`)
  .params(u => u.combine('test', kPredefinedTestCases).beginSubcases())
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase({
      requiredFeatures: ['chromium-experimental-subgroups' as GPUFeatureName],
    });
  })
  .fn(async t => {
    await predefinedTest(t, Style.WGSLv1, t.params.test);
  });

const kNumRandomCases = 100;

g.test('random_workgroup')
  .desc(`Test workgroup reconvergence using randomly generated programs`)
  .params(u => u.combine('seed', generateSeeds(kNumRandomCases)).beginSubcases())
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase({
      requiredFeatures: ['chromium-experimental-subgroups' as GPUFeatureName],
    });
  })
  .fn(async t => {
    const invocations = kNumInvocations; // t.device.limits.maxSubgroupSize;

    const program: Program = new Program(Style.Workgroup, t.params.seed, invocations);
    program.generate();

    await testProgram(t, program);
  });

g.test('random_subgroup')
  .desc(`Test subgroup reconvergence using randomly generated programs`)
  .params(u => u.combine('seed', generateSeeds(kNumRandomCases)).beginSubcases())
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase({
      requiredFeatures: ['chromium-experimental-subgroups' as GPUFeatureName],
    });
  })
  .fn(async t => {
    const invocations = kNumInvocations; // t.device.limits.maxSubgroupSize;

    const program: Program = new Program(Style.Subgroup, t.params.seed, invocations);
    program.generate();

    await testProgram(t, program);
  });

g.test('random_maximal')
  .desc(`Test maximal reconvergence using randomly generated programs`)
  .params(u => u.combine('seed', generateSeeds(kNumRandomCases)).beginSubcases())
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase({
      requiredFeatures: ['chromium-experimental-subgroups' as GPUFeatureName],
    });
  })
  .fn(async t => {
    const invocations = kNumInvocations; // t.device.limits.maxSubgroupSize;

    const program: Program = new Program(Style.Maximal, t.params.seed, invocations);
    program.generate();

    await testProgram(t, program);
  });

g.test('random_wgslv1')
  .desc(`Test WGSL v1 reconvergence using randomly generated programs`)
  .params(u => u.combine('seed', generateSeeds(kNumRandomCases)).beginSubcases())
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase({
      requiredFeatures: ['chromium-experimental-subgroups' as GPUFeatureName],
    });
  })
  .fn(async t => {
    const invocations = kNumInvocations; // t.device.limits.maxSubgroupSize;

    const program: Program = new Program(Style.WGSLv1, t.params.seed, invocations);
    program.generate();

    await testProgram(t, program);
  });

g.test('uniform_maximal')
  .desc(`Test workgroup reconvergence with only uniform branches`)
  .params(u => u.combine('seed', generateSeeds(500)).beginSubcases())
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase({
      requiredFeatures: ['chromium-experimental-subgroups' as GPUFeatureName],
    });
  })
  .fn(async t => {
    const invocations = kNumInvocations; // t.device.limits.maxSubgroupSize;

    const onlyUniform: boolean = true;
    const program: Program = new Program(Style.Maximal, t.params.seed, invocations, onlyUniform);
    program.generate();

    await testProgram(t, program);
  });
