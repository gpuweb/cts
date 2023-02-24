/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ export const description = `
Flow control tests for for-loops.
`;
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

import { runFlowControlTest } from './harness.js';

export const g = makeTestGroup(GPUTest);

g.test('for_basic')
  .desc('Test that flow control executes a for-loop body the correct number of times')
  .fn(t => {
    runFlowControlTest(
      t,
      f =>
        `
  ${f.expect_order(0)}
  for (var i = ${f.value(0)}; i < ${f.value(3)}; i++) {
    ${f.expect_order(1, 2, 3)}
  }
  ${f.expect_order(4)}
`
    );
  });

g.test('for_break')
  .desc('Test that flow control exits a for-loop when reaching a break statement')
  .fn(t => {
    runFlowControlTest(
      t,
      f =>
        `
  ${f.expect_order(0)}
  for (var i = ${f.value(0)}; i < ${f.value(5)}; i++) {
    ${f.expect_order(1, 3, 5, 7)}
    if (i == 3) {
      break;
      ${f.expect_not_reached()}
    }
    ${f.expect_order(2, 4, 6)}
  }
  ${f.expect_order(8)}
`
    );
  });

g.test('for_continue')
  .desc('Test flow control for a for-loop continue statement')
  .fn(t => {
    runFlowControlTest(
      t,
      f =>
        `
  ${f.expect_order(0)}
  for (var i = ${f.value(0)}; i < ${f.value(5)}; i++) {
    ${f.expect_order(1, 3, 5, 7, 8)}
    if (i == 3) {
      continue;
      ${f.expect_not_reached()}
    }
    ${f.expect_order(2, 4, 6, 9)}
  }
  ${f.expect_order(10)}
`
    );
  });

g.test('for_initalizer')
  .desc('Test flow control for a for-loop initializer')
  .fn(t => {
    runFlowControlTest(t, f => ({
      entrypoint: `
  ${f.expect_order(0)}
  for (var i = initializer(); i < ${f.value(3)}; i++) {
    ${f.expect_order(2, 3, 4)}
  }
  ${f.expect_order(5)}
`,
      extra: `
fn initializer() -> u32 {
  ${f.expect_order(1)}
  return ${f.value(0)};
}
      `,
    }));
  });

g.test('for_condition')
  .desc('Test flow control for a for-loop condition')
  .fn(t => {
    runFlowControlTest(t, f => ({
      entrypoint: `
  ${f.expect_order(0)}
  for (var i = ${f.value(0)}; condition(i); i++) {
    ${f.expect_order(2, 4, 6)}
  }
  ${f.expect_order(8)}
`,
      extra: `
fn condition(i : u32) -> bool {
  ${f.expect_order(1, 3, 5, 7)}
  return i < ${f.value(3)};
}
      `,
    }));
  });

g.test('for_continuing')
  .desc('Test flow control for a for-loop continuing statement')
  .fn(t => {
    runFlowControlTest(t, f => ({
      entrypoint: `
  ${f.expect_order(0)}
  for (var i = ${f.value(0)}; i < ${f.value(3)}; i = cont(i)) {
    ${f.expect_order(1, 3, 5)}
  }
  ${f.expect_order(7)}
`,
      extra: `
fn cont(i : u32) -> u32 {
  ${f.expect_order(2, 4, 6)}
  return i + 1;
}
      `,
    }));
  });
