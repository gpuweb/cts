import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

export const description = `
Tests for the memory model that do not fall under other categories. Includes tests for
non-atomic memory in the presence of a WebGPU barrier, and a test for the atomicity of atomic
read-modify-write instructions.`;

export const g = makeTestGroup(GPUTest);

g.test("Atomicity")
  .desc(`
Checks whether a store on one thread can interrupt an atomic RMW on a second thread.`)
  .unimplemented();

g.test("Workgroup Barrier Store Load")
  .desc(`
Checks whether the workgroup barrier properly synchronizes a non-atomic write and read on
separate threads`)
  .unimplemented();
