export const description = 'Demos of how log levels show up in log outputs';

import { makeTestGroup } from '../common/framework/test_group.js';
import { unreachable } from '../common/util/util.js';
import { UnitTest } from '../unittests/unit_test.js';

export const g = makeTestGroup(UnitTest);

g.test('statuses,debug').fn(t => {
  t.debug('debug');
});

g.test('statuses,skip').fn(t => {
  t.skip('skip');
});

g.test('statuses,warn').fn(t => {
  t.warn('warn');
});

g.test('statuses,fail').fn(t => {
  t.fail('fail');
});

g.test('statuses,throw').fn(() => {
  unreachable('unreachable');
});

g.test('multiple_same_level').fn(t => {
  t.fail('this should print a stack');
  t.fail('this should print a stack');
  t.fail('this should not print a stack');
});

g.test('multiple_lower_level').fn(t => {
  t.fail('this should print a stack');
  t.fail('this should print a stack');
  t.fail('this should not print a stack');
  t.warn('this should not print a stack');
  t.warn('this should not print a stack');
  t.warn('this should not print a stack');
});

g.test('lower_levels_hidden,before').fn(t => {
  t.warn('warn - this should not print a stack');
  t.fail('fail');
});

g.test('lower_levels_hidden,after').fn(t => {
  t.fail('fail');
  t.warn('warn - this should not print a stack');
});

g.test('exception_over_validation').fn(t => {
  t.rec.validationFailed(new Error('first, but lower priority - stack should be elided'));
  t.rec.threw(new Error('second, but higher priority - stack should be shown'));
  t.rec.validationFailed(new Error('third, lower priority - stack should be elided'));
});

g.test('validation_over_expectation').fn(t => {
  t.rec.expectationFailed(new Error('first, but lower priority - stack should be elided'));
  t.rec.validationFailed(new Error('second, but higher priority - stack should be shown'));
  t.rec.expectationFailed(new Error('third, lower priority - stack should be elided'));
});

g.test('expectation_over_warn').fn(t => {
  t.rec.warn(new Error('first, but lower priority - stack should be elided'));
  t.rec.expectationFailed(new Error('second, but higher priority - stack should be shown'));
  t.rec.warn(new Error('third, lower priority - stack should be elided'));
});

g.test('warn_over_skip').fn(t => {
  t.rec.skipped(new Error('stacks are never shown for this level'));
  t.rec.warn(new Error('second, but higher priority - stack should be shown'));
  t.rec.skipped(new Error('stacks are never shown for this level'));
});

g.test('skip_over_info').fn(t => {
  t.rec.info(new Error('stacks are never shown for this level'));
  t.rec.skipped(new Error('stacks are never shown for this level'));
  t.rec.info(new Error('stacks are never shown for this level'));
});
