export const description = `
Basic unit tests for test framework.
`;

import { TestGroup } from '../common/framework/test_group.js';

import { UnitTest } from './unit_test.js';

export const g = new TestGroup(UnitTest);

/* eslint-disable-next-line  @typescript-eslint/no-unused-vars */
g.test('test/sync').fn(t => {});

/* eslint-disable-next-line  @typescript-eslint/no-unused-vars */
g.test('test/async').fn(async t => {});

g.test('testp/sync')
  .params([{}])
  .fn(t => {
    t.debug(JSON.stringify(t.params));
  });

g.test('testp/async')
  .params([{}])
  .fn(async t => {
    t.debug(JSON.stringify(t.params));
  });

g.test('testp/private')
  .params([
    { a: 1, b: 2, _result: 3 }, //
    { a: 4, b: -3, _result: 1 },
  ])
  .fn(t => {
    const { a, b, _result } = t.params;
    t.expect(a + b === _result);
  });
