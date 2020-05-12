export const description = `
Unit tests for URL queries.
`;

import { TestQuery } from '../common/framework/query/query.js';
import { stringifyQuery } from '../common/framework/query/stringifyQuery.js';
import { TestGroup } from '../common/framework/test_group.js';

import { UnitTest } from './unit_test.js';

class T extends UnitTest {
  expectQueryString(q: TestQuery, exp: string): void {
    const s = stringifyQuery(q);
    this.expect(s === exp, `got ${s} expected ${exp}`);
  }
}

export const g = new TestGroup(T);

g.test('stringifyQuery,single_case').fn(t => {
  t.expectQueryString(
    {
      suite: 'a',
      file: ['b_1', '2_c'],
      test: ['d_3', '4_e'],
      params: { f: 'g', _pri1: 0, h: 3, _pri2: 1 },
      endsWithWildcard: false,
    },
    'a:b_1,2_c:d_3,4_e:f="g",h=3'
  );
});

g.test('stringifyQuery,multi_case').fn(t => {
  t.expectQueryString(
    {
      suite: 'a',
      file: ['b_1', '2_c'],
      test: ['d_3', '4_e'],
      params: { f: 'g', _pri1: 0, h: 3, _pri2: 1 },
      endsWithWildcard: true,
    },
    'a:b_1,2_c:d_3,4_e:f="g",h=3,*'
  );

  t.expectQueryString(
    {
      suite: 'a',
      file: ['b_1', '2_c'],
      test: ['d_3', '4_e'],
      params: {},
      endsWithWildcard: true,
    },
    'a:b_1,2_c:d_3,4_e:*'
  );
});

g.test('stringifyQuery,multi_test').fn(t => {
  t.expectQueryString(
    {
      suite: 'a',
      file: ['b_1', '2_c'],
      test: ['d_3', '4_e'],
    },
    'a:b_1,2_c:d_3,4_e,*'
  );

  t.expectQueryString(
    {
      suite: 'a',
      file: ['b_1', '2_c'],
      test: [],
    },
    'a:b_1,2_c:*'
  );
});

g.test('stringifyQuery,multi_group').fn(t => {
  t.expectQueryString(
    {
      suite: 'a',
      file: ['b_1', '2_c'],
    },
    'a:b_1,2_c,*'
  );

  t.expectQueryString(
    {
      suite: 'a',
      file: [],
    },
    'a:*'
  );
});
