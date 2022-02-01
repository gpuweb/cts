import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

export const description = `
A suite of tests for properties of the WebGPU memory model involving two memory locations.
Specifically, we can use the acquire/release ordering provided by WebGPU's barriers to disallow
weak behaviors in several classic memory model litmus tests.`;

export const g = makeTestGroup(GPUTest);

g.test("message passing, workgroup memory")
  .desc(`
Checks whether two reads on one thread can observe two writes in another thread in a way
that is inconsistent with sequential consistency.`)
  .unimplemented();
