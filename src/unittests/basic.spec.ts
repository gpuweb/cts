export const description = `
Basic unit tests for test framework.
`;

import { TestGroup } from '../common/framework/test_group.js';

import { UnitTest } from './unit_test.js';

export const g = new TestGroup(UnitTest);

g.test('test/sync').fn(t => {});

g.test('test/async').fn(async t => {});

g.test('testp/sync')
  .fn(t => {
    t.debug(JSON.stringify(t.params));
  })
  .params([{}]);

g.test('testp/async')
  .fn(async t => {
    t.debug(JSON.stringify(t.params));
  })
  .params([{}]);

g.test('testp/private')
  .fn(t => {
    const { a, b, _result } = t.params;
    t.expect(a + b === _result);
  })
  .params([
    { a: 1, b: 2, _result: 3 }, //
    { a: 4, b: -3, _result: 1 },
  ]);
