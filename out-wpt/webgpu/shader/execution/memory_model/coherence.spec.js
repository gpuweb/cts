/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ export const description = `
Tests that all threads see a sequentially consistent view of the order of memory
accesses to a single memory location. Uses a parallel testing strategy along with stressing
threads to increase coverage of possible bugs.`;
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

import {
  MemoryModelTester,
  buildInterWorkgroupTestShader,
  buildFourResultShader,
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
  permuteSecond: 1,
  memStride: 4,
  aliasedMemory: true,
  numMemLocations: 1,
  numReadOutputs: 2,
  numBehaviors: 4,
};

g.test('corr')
  .desc(
    `Ensures two reads on one thread cannot observe an inconsistent view of a write on a second thread.
     The first thread writes the value 1 some location x, and the second thread reads x twice in a row.
     If the first read returns 1 but the second read returns 0, then there has been a coherence violation.
    `
  )
  .fn(async t => {
    const testCode = `
        let total_ids = u32(workgroupXSize) * stress_params.testing_workgroups;
        let id_0 = shuffled_workgroup * u32(workgroupXSize) + local_invocation_id[0];
        let new_workgroup = stripe_workgroup(shuffled_workgroup, local_invocation_id[0]);
        let id_1 = new_workgroup * u32(workgroupXSize) + permute_id(local_invocation_id[0], stress_params.permute_first, u32(workgroupXSize));
        let x_0 = (id_0) * stress_params.mem_stride * 2u;
        let x_1 = (id_1) * stress_params.mem_stride * 2u;
        let y_1 = (permute_id(id_1, stress_params.permute_second, total_ids)) * stress_params.mem_stride * 2u + stress_params.location_offset;
        if (stress_params.pre_stress == 1u) {
          do_stress(stress_params.pre_stress_iterations, stress_params.pre_stress_pattern, shuffled_workgroup);
        }
        if (stress_params.do_barrier == 1u) {
          spin(u32(workgroupXSize) * stress_params.testing_workgroups);
        }
        atomicStore(&test_locations.value[x_0], 1u);
        let r0 = atomicLoad(&test_locations.value[x_1]);
        let r1 = atomicLoad(&test_locations.value[y_1]);
        workgroupBarrier();
        atomicStore(&results.value[id_1].r0, r0);
        atomicStore(&results.value[id_1].r1, r1);
    `;
    const resultCode = `
      let id_0 = workgroup_id[0] * u32(workgroupXSize) + local_invocation_id[0];
      let r0 = atomicLoad(&read_results.value[id_0].r0);
      let r1 = atomicLoad(&read_results.value[id_0].r1);
      if ((r0 == 0u && r1 == 0u)) {
        atomicAdd(&test_results.seq0, 1u);
      } else if ((r0 == 1u && r1 == 1u)) {
        atomicAdd(&test_results.seq1, 1u);
      } else if ((r0 == 0u && r1 == 1u)) {
        atomicAdd(&test_results.interleaved, 1u);
      } else if ((r0 == 1u && r1 == 0u)) {
        atomicAdd(&test_results.weak, 1u);
      }
    `;

    const testShader = buildInterWorkgroupTestShader(testCode);
    const resultShader = buildFourResultShader(resultCode);
    const memModelTester = new MemoryModelTester(
      t,
      memoryModelTestParams,
      testShader,
      resultShader
    );

    await memModelTester.run(20, 3);
  });
