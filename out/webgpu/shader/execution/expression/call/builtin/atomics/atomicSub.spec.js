/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Atomically read, subtract and store value.

* Load the original value pointed to by atomic_ptr.
* Obtains a new value by subtracting with the value v.
* Store the new value using atomic_ptr.

Returns the original value stored in the atomic object.
`;import { makeTestGroup } from '../../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../../gpu_test.js';

import { dispatchSizes, workgroupSizes, runTest } from './harness.js';

export const g = makeTestGroup(GPUTest);

g.test('sub').
specURL('https://www.w3.org/TR/WGSL/#atomic-rmw').
desc(
`
AS is storage or workgroup
T is i32 or u32

fn atomicSub(atomic_ptr: ptr<AS, atomic<T>, read_write>, v: T) -> T
`).

params((u) => u.combine('workgroupSize', workgroupSizes).combine('dispatchSize', dispatchSizes)).
fn((t) => {
  const numInvocations = t.params.workgroupSize * t.params.dispatchSize;
  const bufferNumElements = 2;

  const initValue = 0;
  const op = `atomicSub(&output[0], 1)`;
  const expected = new Uint32Array(bufferNumElements);
  expected[0] = -1 * numInvocations;

  runTest({
    t,
    workgroupSize: t.params.workgroupSize,
    dispatchSize: t.params.dispatchSize,
    bufferNumElements,
    initValue,
    op,
    expected
  });
});
//# sourceMappingURL=atomicSub.spec.js.map