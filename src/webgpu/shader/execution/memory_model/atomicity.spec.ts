export const description = `Tests for the atomicity of atomic read-modify-write instructions.`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

import {
  MemoryModelTestParams,
  MemoryModelTester,
  buildTestShader,
  MemoryType,
  TestType,
  buildResultShader,
  ResultType,
} from './memory_model_setup.js';

export const g = makeTestGroup(GPUTest);

// A reasonable parameter set, determined heuristically.
const memoryModelTestParams: MemoryModelTestParams = {
  workgroupSize: 256,
  testingWorkgroups: 512,
  maxWorkgroups: 1024,
  shufflePct: 100,
  barrierPct: 100,
  memStressPct: 100,
  memStressIterations: 1024,
  memStressStoreFirstPct: 50,
  memStressStoreSecondPct: 50,
  preStressPct: 100,
  preStressIterations: 1024,
  preStressStoreFirstPct: 50,
  preStressStoreSecondPct: 50,
  scratchMemorySize: 2048,
  stressLineSize: 64,
  stressTargetLines: 2,
  stressStrategyBalancePct: 50,
  permuteFirst: 109,
  permuteSecond: 419,
  memStride: 4,
  aliasedMemory: false,
  numMemLocations: 1,
  numReadOutputs: 1,
  numBehaviors: 4,
};

g.test('atomicity')
  .desc(
    `Checks whether a store on one thread can interrupt an atomic RMW on a second thread. If the read returned by
    the RMW instruction is the initial value of memory (0), but the final value in memory is 1, then the atomic write
    in the second thread occurred in between the read and the write of the RMW.
    `
  )
  .fn(async t => {
    const testCode = `
      let r0 = atomicAdd(&test_locations.value[x_0], 0u);
      atomicStore(&test_locations.value[x_1], 2u);
      workgroupBarrier();
      atomicStore(&results.value[id_0].r0, r0);
    `;
    const resultCode = `
      if ((r0 == 0u && mem_x_0 == 2u)) {
        atomicAdd(&test_results.seq0, 1u);
      } else if ((r0 == 2u && mem_x_0 == 1u)) {
        atomicAdd(&test_results.seq1, 1u);
      } else if ((r0 == 0u && mem_x_0 == 1u)) {
        atomicAdd(&test_results.weak, 1u);
      }
    `;

    const testShader = buildTestShader(
      testCode,
      MemoryType.AtomicStorageClass,
      TestType.InterWorkgroup
    );
    const resultShader = buildResultShader(
      resultCode,
      TestType.InterWorkgroup,
      ResultType.FourBehavior
    );
    const memModelTester = new MemoryModelTester(
      t,
      memoryModelTestParams,
      testShader,
      resultShader
    );
    await memModelTester.run(20, 3);
  });
