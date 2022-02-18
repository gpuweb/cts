/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ export const description = `
Tests for non-atomic memory synchronization within a workgroup in the presence of a WebGPU barrier`;
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

import {
  MemoryModelTester,
  buildIntraWorkgroupTestShader,
  buildTwoResultShader,
} from './memory_model_setup.js';

export const g = makeTestGroup(GPUTest);

// A reasonable parameter set, determined heuristically.
const memoryModelTestParams = {
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
  numBehaviors: 2,
};

g.test('workgroup_barrier_store_load')
  .desc(
    `Checks whether the workgroup barrier properly synchronizes a non-atomic write and read on
    separate threads in the same workgroup. Within a workgroup, the barrier should force an invocation
    after the barrier to read a write from an invocation before the barrier.
    `
  )
  .fn(async t => {
    const testCode = `
        let total_ids = u32(workgroupXSize);
        let id_0 = local_invocation_id[0];
        let id_1 = permute_id(local_invocation_id[0], stress_params.permute_first, u32(workgroupXSize));
        let x_0 = (id_0) * stress_params.mem_stride * 2u;
        let x_1 = (id_1) * stress_params.mem_stride * 2u;
        if (stress_params.pre_stress == 1u) {
          do_stress(stress_params.pre_stress_iterations, stress_params.pre_stress_pattern, shuffled_workgroup);
        }
        if (stress_params.do_barrier == 1u) {
          spin(u32(workgroupXSize));
        }
        wg_test_locations[x_0] = 1u;
        workgroupBarrier();
        let r0 = wg_test_locations[x_1];
        workgroupBarrier();
        atomicStore(&results.value[shuffled_workgroup * u32(workgroupXSize) + id_1].r0, r0);
    `;

    const resultCode = `
      let id_0 = workgroup_id[0] * u32(workgroupXSize) + local_invocation_id[0];
      let r0 = atomicLoad(&read_results.value[id_0].r0);
      if (r0 == 1u) {
        atomicAdd(&test_results.seq, 1u);
      } else if (r0 == 0u) {
        atomicAdd(&test_results.weak, 1u);
      }
    `;
    const testShader = buildIntraWorkgroupTestShader(testCode, false);
    const resultShader = buildTwoResultShader(resultCode);
    const memModelTester = new MemoryModelTester(
      t,
      memoryModelTestParams,
      testShader,
      resultShader
    );

    await memModelTester.run(20, 1);
  });
