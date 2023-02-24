/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Flow control tests for while-loops.
`;import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

import { runFlowControlTest } from './harness.js';

export const g = makeTestGroup(GPUTest);

g.test('while_basic').
desc('Test that flow control executes a while-loop body the correct number of times').
fn((t) => {
  runFlowControlTest(
  t,
  (f) =>
  `
  ${f.expect_order(0)}
  var i = ${f.value(0)};
  while (i < ${f.value(5)}) {
    ${f.expect_order(1, 2, 3, 4, 5)}
    i++;
  }
  ${f.expect_order(6)}
`);

});

g.test('while_break').
desc('Test that flow control exits a while-loop when reaching a break statement').
fn((t) => {
  runFlowControlTest(
  t,
  (f) =>
  `
  ${f.expect_order(0)}
  var i = ${f.value(0)};
  while (i < ${f.value(5)}) {
    ${f.expect_order(1, 3, 5, 7)}
    if (i == 3) {
      break;
      ${f.expect_not_reached()}
    }
    ${f.expect_order(2, 4, 6)}
    i++;
  }
  ${f.expect_order(8)}
`);

});

g.test('while_continue').
desc('Test flow control for a while-loop continue statement').
fn((t) => {
  runFlowControlTest(
  t,
  (f) =>
  `
  ${f.expect_order(0)}
  var i = ${f.value(0)};
  while (i < ${f.value(5)}) {
    ${f.expect_order(1, 3, 5, 7, 8)}
    if (i == 3) {
      i++;
      continue;
      ${f.expect_not_reached()}
    }
    ${f.expect_order(2, 4, 6, 9)}
    i++;
  }
  ${f.expect_order(10)}
`);

});
//# sourceMappingURL=while.spec.js.map