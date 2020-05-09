export const description = `
Tests for TestQuery comparison
`;

import { compareQueries, Ordering } from '../common/framework/query/compare.js';
import { parseQuery } from '../common/framework/query/parseQuery.js';
import { TestGroup } from '../common/framework/test_group.js';

import { UnitTest } from './unit_test.js';

export const g = new TestGroup(UnitTest);

g.test('one').fn(t => {
  const q1 = parseQuery('suite1:bar,buzz,buzz:zap:');
  const q2 = parseQuery('suite1:bar:*');

  console.log('one:', compareQueries(q1, q2), Ordering.Unordered);
  t.expect(compareQueries(q1, q2) === Ordering.Unordered);
});
