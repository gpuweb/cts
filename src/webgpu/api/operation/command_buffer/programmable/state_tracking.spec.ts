export const description = `
Ensure state is set correctly. Tries to stress state caching (setting different states multiple
times in different orders) for setBindGroup and setPipeline.

TODO: for each programmable pass encoder {compute pass, render pass, render bundle encoder}
- try setting states multiple times in different orders, check state is correct in draw/dispatch.
    - Changing from pipeline A to B where both have the same layout except for {first,mid,last}
      bind group index.
    - Try with a pipeline that e.g. only uses bind group 1, or bind groups 0 and 2.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { ProgrammableStateTest } from './programmable_state_test.js';

export const g = makeTestGroup(ProgrammableStateTest);

g.test('bind_group_indices')
  .desc(`
    Test that bind group indices can be declared in any order, regardless of their order in the shader.
    - Test places the value of buffer a - buffer b into the out buffer, then reads the result.
  `)
  .paramsSubcasesOnly(u =>
    u //
      .combine('groupIndices', [
        {a: 0, b: 1, out: 2},
        {a: 1, b: 2, out: 0},
        {a: 2, b: 0, out: 1},
        {a: 0, b: 2, out: 1},
        {a: 2, b: 1, out: 0},
        {a: 1, b: 0, out: 2},
      ])
  )
  .fn(async t => {
    const { groupIndices } = t.params;

    const pipeline = t.createBindingStateComputePipeline(groupIndices);

    const out = t.createBufferWithValue(0);
    const bindGroups = {
      a: t.createBindGroup(t.createBufferWithValue(3)),
      b: t.createBindGroup(t.createBufferWithValue(2)),
      out: t.createBindGroup(out)
    };

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(groupIndices.a, bindGroups.a);
    pass.setBindGroup(groupIndices.b, bindGroups.b);
    pass.setBindGroup(groupIndices.out, bindGroups.out);
    pass.dispatch(1);
    pass.endPass();
    t.device.queue.submit([encoder.finish()]);

    t.verifyData(out, 1);
  });

g.test('bind_group_order')
  .desc(`
    Test that the order in which you set the bind groups doesn't matter.
  `)
  .paramsSubcasesOnly(u =>
    u //
      .combine('setOrder', [
        ['a', 'b', 'out'],
        ['b', 'out', 'a'],
        ['out', 'a', 'b'],
        ['b', 'a', 'out'],
        ['a', 'out', 'b'],
        ['out', 'b', 'a'],
      ] as const)
  )
  .fn(async t => {
    const { setOrder } = t.params;

    const groupIndices = {a: 0, b: 1, out: 2};
    const pipeline = t.createBindingStateComputePipeline(groupIndices);

    const out = t.createBufferWithValue(0);
    const bindGroups = {
      a: t.createBindGroup(t.createBufferWithValue(3)),
      b: t.createBindGroup(t.createBufferWithValue(2)),
      out: t.createBindGroup(out)
    };

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);

    for (const group of setOrder) {
      pass.setBindGroup(groupIndices[group], bindGroups[group]);
    }

    pass.dispatch(1);
    pass.endPass();
    t.device.queue.submit([encoder.finish()]);

    t.verifyData(out, 1);
  });
