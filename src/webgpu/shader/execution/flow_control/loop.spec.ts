export const description = `
Flow control tests for loops.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

import { runFlowControlTest } from './harness.js';

export const g = makeTestGroup(GPUTest);

g.test('loop_break')
  .desc('Test that flow control exits a loop when reaching a break statement')
  .fn(t => {
    runFlowControlTest(
      t,
      f =>
        `
  ${f.expect_order(0)}
  var i = ${f.value(0)};
  loop {
    ${f.expect_order(1, 3, 5, 7)}
    if i == 3 {
      break;
    }
    ${f.expect_order(2, 4, 6)}
    i++;
  }
  ${f.expect_order(8)}
`
    );
  });

g.test('loop_continue')
  .desc('Test flow control for a loop continue statement')
  .fn(t => {
    runFlowControlTest(
      t,
      f =>
        `
  ${f.expect_order(0)}
  var i = ${f.value(0)};
  loop {
    ${f.expect_order(1, 3, 5, 7, 8)}
    if i == 3 {
      i++;
      continue;
      ${f.expect_not_reached()}
    }
    ${f.expect_order(2, 4, 6, 9)}
    if i == 4 {
      break;
    }
    i++;
  }
  ${f.expect_order(10)}
`
    );
  });

g.test('loop_continuing_basic')
  .desc('Test basic flow control for a loop continuing block')
  .fn(t => {
    runFlowControlTest(
      t,
      f =>
        `
  ${f.expect_order(0)}
  var i = ${f.value(0)};
  loop {
    ${f.expect_order(1, 3, 5)}
    i++;

    continuing {
      ${f.expect_order(2, 4, 6)}
      break if i == 3;
    }
  }
  ${f.expect_order(7)}
`
    );
  });
