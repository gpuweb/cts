/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Flow control tests for if-statements.
`;import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

import { runFlowControlTest } from './harness.js';

export const g = makeTestGroup(GPUTest);

g.test('if_true').
desc(
"Test that flow control executes the 'true' block of an if statement and not the 'false' block").

fn((t) => {
  runFlowControlTest(
  t,
  (f) => `
  ${f.expect_order(0)}
  if (${f.value(true)}) {
    ${f.expect_order(1)}
  } else {
    ${f.expect_not_reached()}
  }
  ${f.expect_order(2)}
`);

});

g.test('if_false').
desc(
"Test that flow control executes the 'false' block of an if statement and not the 'true' block").

fn((t) => {
  runFlowControlTest(
  t,
  (f) => `
  ${f.expect_order(0)}
  if (${f.value(false)}) {
    ${f.expect_not_reached()}
  } else {
    ${f.expect_order(1)}
  }
  ${f.expect_order(2)}
`);

});

g.test('else_if').
desc("Test that flow control executes the correct 'else if' block of an if statement").
fn((t) => {
  runFlowControlTest(
  t,
  (f) => `
  ${f.expect_order(0)}
  if (${f.value(false)}) {
    ${f.expect_not_reached()}
  } else if (${f.value(false)}) {
    ${f.expect_not_reached()}
  } else if (${f.value(true)}) {
    ${f.expect_order(1)}
  } else if (${f.value(false)}) {
    ${f.expect_not_reached()}
  }
  ${f.expect_order(2)}
`);

});
//# sourceMappingURL=if.spec.js.map