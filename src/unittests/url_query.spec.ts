export const description = `
Unit tests for URL queries.
`;

import {
  TestQuery,
  TestQuerySingleCase,
  TestQueryMultiCase,
  TestQueryMultiTest,
  TestQueryMultiFile,
} from '../common/framework/query/query.js';
import { TestGroup } from '../common/framework/test_group.js';

import { UnitTest } from './unit_test.js';

class T extends UnitTest {
  expectQueryString(q: TestQuery, exp: string): void {
    const s = q.toString();
    this.expect(s === exp, `got ${s} expected ${exp}`);
  }
}

export const g = new TestGroup(T);

g.test('stringifyQuery,single_case').fn(t => {
  t.expectQueryString(
    new TestQuerySingleCase('a', ['b_1', '2_c'], ['d_3', '4_e'], {
      f: 'g',
      _pri1: 0,
      a: 3,
      _pri2: 1,
    }),
    'a:b_1,2_c:d_3,4_e:f="g";a=3'
  );
});

g.test('stringifyQuery,multi_case').fn(t => {
  t.expectQueryString(
    new TestQueryMultiCase('a', ['b_1', '2_c'], ['d_3', '4_e'], {
      f: 'g',
      _pri1: 0,
      a: 3,
      _pri2: 1,
    }),
    'a:b_1,2_c:d_3,4_e:f="g";a=3;*'
  );

  t.expectQueryString(
    new TestQueryMultiCase('a', ['b_1', '2_c'], ['d_3', '4_e'], {}),
    'a:b_1,2_c:d_3,4_e:*'
  );
});

g.test('stringifyQuery,multi_test').fn(t => {
  t.expectQueryString(
    new TestQueryMultiTest('a', ['b_1', '2_c'], ['d_3', '4_e']),
    'a:b_1,2_c:d_3,4_e,*'
  );

  t.expectQueryString(
    new TestQueryMultiTest('a', ['b_1', '2_c'], []), //
    'a:b_1,2_c:*'
  );
});

g.test('stringifyQuery,multi_file').fn(t => {
  t.expectQueryString(
    new TestQueryMultiFile('a', ['b_1', '2_c']), //
    'a:b_1,2_c,*'
  );

  t.expectQueryString(
    new TestQueryMultiFile('a', []), //
    'a:*'
  );
});
