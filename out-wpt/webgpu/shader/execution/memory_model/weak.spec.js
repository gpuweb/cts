/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ export const description = `
Tests for properties of the WebGPU memory model involving two memory locations.
Specifically, the acquire/release ordering provided by WebGPU's barriers can be used to disallow
weak behaviors in several classic memory model litmus tests.`;
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

import {
  MemoryModelTester,
  buildIntraWorkgroupTestShader,
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
  permuteSecond: 419,
  memStride: 4,
  aliasedMemory: false,
  numMemLocations: 2,
  numReadOutputs: 2,
  numBehaviors: 4,
};

g.test('message_passing_workgroup_memory')
  .desc(
    `Checks whether two reads on one thread can observe two writes in another thread in a way
    that is inconsistent with sequential consistency. In the message passing litmus test, one
    thread writes the value 1 to some location x and then 1 to some location y. The second thread
    reads y and then x. If the second thread reads y == 1 and x == 0, then sequential consistency
    has not been respected. The acquire/release semantics of WebGPU's workgroupBarrier() should disallow
    this behavior within a workgroup.
    `
  )
  .fn(async t => {
    const testCode = `
        let total_ids = workgroupXSize;
        let id_0 = local_invocation_id[0];
        let id_1 = permute_id(local_invocation_id[0], stress_params.permute_first, workgroupXSize);
        let x_0 = (id_0) * stress_params.mem_stride * 2u;
        let y_0 = (permute_id(id_0, stress_params.permute_second, total_ids)) * stress_params.mem_stride * 2u + stress_params.location_offset;
        let y_1 = (permute_id(id_1, stress_params.permute_second, total_ids)) * stress_params.mem_stride * 2u + stress_params.location_offset;
        let x_1 = (id_1) * stress_params.mem_stride * 2u;
        if (stress_params.pre_stress == 1u) {
          do_stress(stress_params.pre_stress_iterations, stress_params.pre_stress_pattern, shuffled_workgroup);
        }
        if (stress_params.do_barrier == 1u) {
          spin(workgroupXSize);
        }
        atomicStore(&wg_test_locations[x_0], 1u);
        workgroupBarrier();
        atomicStore(&wg_test_locations[y_0], 1u);
        let r0 = atomicLoad(&wg_test_locations[y_1]);
        workgroupBarrier();
        let r1 = atomicLoad(&wg_test_locations[x_1]);
        workgroupBarrier();
        atomicStore(&results.value[shuffled_workgroup * workgroupXSize + id_1].r0, r0);
        atomicStore(&results.value[shuffled_workgroup * workgroupXSize + id_1].r1, r1);
    `;
    const resultCode = `
      let id_0 = workgroup_id[0] * workgroupXSize + local_invocation_id[0];
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

    const testShader = buildIntraWorkgroupTestShader(testCode);
    const resultShader = buildFourResultShader(resultCode);
    const memModelTester = new MemoryModelTester(
      t,
      memoryModelTestParams,
      testShader,
      resultShader
    );

    await memModelTester.run(20, 3);
  });
