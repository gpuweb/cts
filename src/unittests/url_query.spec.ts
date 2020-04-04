export const description = `
Unit tests for URL queries.
`;

import { TestGroup } from '../common/framework/test_group.js';
import { makeQueryString } from '../common/framework/url_query.js';

import { UnitTest } from './unit_test.js';

export const g = new TestGroup(UnitTest);

g.test('makeQueryString').fn(t => {
  const s = makeQueryString({ suite: 'a', path: 'b/c' }, { test: 'd/e', params: { f: 'g', h: 3 } });
  t.expect(s === 'a:b/c:d/e={"f":"g","h":3}');
});

g.test('makeQueryString/private').fn(t => {
  const s = makeQueryString({ suite: 'a', path: 'b' }, { test: 'c', params: { pub: 2, _pri: 3 } });
  t.expect(s === 'a:b:c={"pub":2}');
});

g.test('makeQueryString/undefined').fn(t => {
  const s = makeQueryString(
    { suite: 'a', path: 'b' },
    { test: 'c', params: { f: undefined, h: 3 } }
  );
  t.expect(s === 'a:b:c={"h":3}');
});
