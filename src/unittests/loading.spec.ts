export const description = `
Tests for queries/filtering, loading, and running.
`;

import { TestSuiteListing, TestSuiteListingEntry } from '../common/framework/listing.js';
import { TestFileLoader, TestLoader, TestSpecOrReadme } from '../common/framework/loader.js';
import { Logger } from '../common/framework/logging/logger.js';
import { paramsEquals } from '../common/framework/params_utils.js';
import { stringifyQuery } from '../common/framework/query/stringifyQuery.js';
import { TestGroup } from '../common/framework/test_group.js';
import { FilterResultTreeLeaf } from '../common/framework/tree.js';
import { assert, objectEquals } from '../common/framework/util/util.js';

import { UnitTest } from './unit_test.js';
import { kBigSeparator } from '../common/framework/query/separators.js';
import { TestQuery } from '../common/framework/query/query.js';
import { Status } from '../common/framework/logging/result.js';

const listingData: { [k: string]: TestSuiteListingEntry[] } = {
  suite1: [
    { path: [''], description: 'desc 1a' },
    { path: ['foo'], description: 'desc 1b' },
    { path: ['bar', ''], description: 'desc 1c' },
    { path: ['bar', 'buzz'], description: 'desc 1d' },
    { path: ['baz'], description: 'desc 1e' },
  ],
  suite2: [
    { path: [''], description: 'desc 2a' },
    { path: ['foof'], description: 'desc 2b' },
  ],
};

const specsData: { [k: string]: TestSpecOrReadme } = {
  'suite1/README.txt': { description: 'desc 1a' },
  'suite1/foo.spec.js': {
    description: 'desc 1b',
    g: (() => {
      const g = new TestGroup(UnitTest);
      g.test('hello').fn(() => {});
      g.test('bonjour').fn(() => {});
      g.test('hola').fn(() => {});
      return g;
    })(),
  },
  'suite1/bar/README.txt': { description: 'desc 1c' },
  'suite1/bar/biz.spec.js': {
    description: 'desc 1f',
    g: new TestGroup(UnitTest),
  },
  'suite1/bar/bez.spec.js': {
    description: 'desc 1g',
    g: new TestGroup(UnitTest),
  },
  'suite1/bar/buzz.spec.js': {
    description: 'desc 1d',
    g: (() => {
      const g = new TestGroup(UnitTest);
      g.test('zap').fn(() => {});
      return g;
    })(),
  },
  'suite1/baz.spec.js': {
    description: 'desc 1e',
    g: (() => {
      const g = new TestGroup(UnitTest);
      g.test('wye')
        .params([
          {}, //
          { x: 1 },
        ])
        .fn(() => {});
      g.test('zed')
        .params([
          { a: 1, b: 2, _c: 0 }, //
          { b: 3, a: 1, _c: 0 },
        ])
        .fn(() => {});
      return g;
    })(),
  },
  'suite2/foof.spec.js': {
    description: 'desc 2b',
    g: (() => {
      const g = new TestGroup(UnitTest);
      g.test('blah').fn(t => {
        t.debug('OK');
      });
      g.test('bleh')
        .params([{ a: 1 }])
        .fn(t => {
          t.debug('OK');
          t.debug('OK');
        });
      g.test('bluh', 'a').fn(t => {
        t.fail('bye');
      });
      return g;
    })(),
  },
};

class FakeTestFileLoader extends TestFileLoader {
  async listing(suite: string): Promise<TestSuiteListing> {
    return listingData[suite];
  }

  async import(path: string): Promise<TestSpecOrReadme> {
    assert(path in specsData, '[test] mock file ' + path + ' does not exist');
    return specsData[path];
  }
}

class LoadingTest extends UnitTest {
  static readonly loader: TestLoader = new TestLoader(new FakeTestFileLoader());

  async load(filter: string): Promise<FilterResultTreeLeaf[]> {
    return Array.from(await LoadingTest.loader.loadTests(filter));
  }

  async loadNames(filter: string): Promise<string[]> {
    return (await this.load(filter)).map(c => stringifyQuery(c.query));
  }
}

export const g = new TestGroup(LoadingTest);

g.test('whole suite').fn(async t => {
  t.shouldReject('Error', t.load('suite1'));
  t.shouldReject('Error', t.load('suite1:'));
  t.expect((await t.load('suite1:*')).length === 5);
});

g.test('partial suite').fn(async t => {
  t.shouldReject('Error', t.load('suite1:f*'));
  t.expect((await t.load('suite1:foo:*')).length === 1);
  t.shouldReject('Error', t.load('suite1:ba*'));
  t.expect((await t.load('suite1:bar;*')).length === 2);
});

g.test('whole group').fn(async t => {
  t.expect((await t.load('suite1::')).length === 0);
  t.expect((await t.load('suite1:bar:')).length === 0);
  t.expect((await t.load('suite1:bar:*')).length === 0);
  t.expect((await t.load('suite1:bar/:')).length === 0);
  t.expect((await t.load('suite1:bar/:*')).length === 0);
  t.expect((await t.load('suite1::*')).length === 0);
  t.expect((await t.load('suite1:bar/buzz:*')).length === 1);
  t.expect((await t.load('suite1:baz:')).length === 0);
  t.expect((await t.load('suite1:baz:*')).length === 4);
  t.expect((await t.load('suite1:foo:*')).length === 3);
});

g.test('partial group').fn(async t => {
  t.expect((await t.load('suite1:foo:h*')).length === 2);
  t.expect((await t.load('suite1:foo:he*')).length === 1);
  t.expect((await t.load('suite1:foo:hello*')).length === 1);
  t.expect((await t.load('suite1:baz:zed*')).length === 2);
});

g.test('partial test', 'exact').fn(async t => {
  t.expect((await t.load('suite1:foo:hello:')).length === 1);
  t.expect((await t.load('suite1:baz:zed:')).length === 0);
  t.expect((await t.load('suite1:baz:zed:a=1;b=2')).length === 1);
  t.expect((await t.load('suite1:baz:zed:a=1;b=2*')).length === 1);
  t.expect((await t.load('suite1:baz:zed:a=1;b=2;*')).length === 0);
  t.expect((await t.load('suite1:baz:zed:b=2;a=1')).length === 0);
  t.expect((await t.load('suite1:baz:zed:b=3;a=1')).length === 1);
  t.expect((await t.load('suite1:baz:zed:a=1;b=2;_c=0')).length === 0);
});

g.test('partial test', 'makeQueryString').fn(async t => {
  const s = stringifyQuery({
    suite: 'suite1',
    group: ['baz'],
    test: ['zed'],
    params: { a: 1, b: 2 },
    endsWithWildcard: false,
  });
  t.expect((await t.load(s)).length === 1);
});

g.test('partial test', 'match').fn(async t => {
  t.expect((await t.load('suite1:baz:zed:*')).length === 2);
  t.expect((await t.load('suite1:baz:zed:*')).length === 2);
  t.expect((await t.load('suite1:baz:zed:a=1;*')).length === 1);
  t.expect((await t.load('suite1:baz:zed:a=1;b=2;*')).length === 0);
  t.expect((await t.load('suite1:baz:zed:a=1;b=2;')).length === 0);
  t.expect((await t.load('suite1:baz:zed:a=1;b=2')).length === 1);
  t.expect((await t.load('suite1:baz:zed:b=2;a=1')).length === 0);
  t.expect((await t.load('suite1:baz:zed:b=2;*')).length === 0);
  t.expect((await t.load('suite1:baz:zed:a=2*')).length === 0);
});

g.test('end2end').fn(async t => {
  const l = await t.load('suite2:foof:*');
  assert(l.length === 3, 'listing length');

  const log = new Logger(true);

  const exp = (i: number, query: TestQuery, status: Status, logs: (s: string) => boolean) => {
    t.expect(objectEquals(l[i].query, query));
    t.expect(l[i].run instanceof Function);
    const name = stringifyQuery(l[i].query);
    const [rec, res] = log.record(name);
    l[i].run(rec);

    t.expect(log.results.get(name) === res);
    t.expect(res.status === status);
    t.expect(res.timems > 0);
    t.expect(logs(JSON.stringify(res.logs)));
  };

  exp(
    0,
    { suite: 'suite2', group: ['foof'], test: ['blah'], params: {}, endsWithWildcard: false },
    'pass',
    s => s === '["DEBUG: OK"]'
  );
  exp(
    1,
    { suite: 'suite2', group: ['foof'], test: ['bleh'], params: { a: 1 }, endsWithWildcard: false },
    'pass',
    s => s === '["DEBUG: OK","DEBUG: OK"]'
  );
  exp(
    2,
    { suite: 'suite2', group: ['foof'], test: ['bluh', 'a'], params: {}, endsWithWildcard: false },
    'pass',
    s => s.startsWith('FAIL: bye\n') && s.indexOf('loading.spec.') !== -1
  );
});

const testGenerateMinimalQueryList = async (
  t: LoadingTest,
  expectations: string[],
  result: string[]
) => {
  const l = await t.load('suite1:*');
  const queries = await generateMinimalQueryList(l, expectations);
  t.expect(objectEquals(queries, result));
};

g.test('generateMinimalQueryList', 'errors').fn(async t => {
  t.shouldReject('Error', testGenerateMinimalQueryList(t, ['garbage'], []));
  t.shouldReject('Error', testGenerateMinimalQueryList(t, ['garbage*'], []));
  t.shouldReject('Error', testGenerateMinimalQueryList(t, ['garbage:*'], []));
  t.shouldReject('Error', testGenerateMinimalQueryList(t, ['suite1:*'], []));
  t.shouldReject('Error', testGenerateMinimalQueryList(t, ['suite1:foo*'], []));
  t.shouldReject('Error', testGenerateMinimalQueryList(t, ['suite1:foo:ba*'], []));
  t.shouldReject('Error', testGenerateMinimalQueryList(t, ['suite2:foo:*'], []));
});

g.test('generateMinimalQueryList').fn(async t => {
  await testGenerateMinimalQueryList(
    t, //
    [],
    [
      'suite1:foo:*', //
      'suite1:bar/buzz:*',
      'suite1:baz:*',
    ]
  );
  await testGenerateMinimalQueryList(
    t, //
    ['suite1:foo:*'],
    [
      'suite1:foo:*', //
      'suite1:bar/buzz:*',
      'suite1:baz:*',
    ]
  );
  await testGenerateMinimalQueryList(
    t, //
    ['suite1:bar/buzz:*'],
    [
      'suite1:foo:*', //
      'suite1:bar/buzz:*',
      'suite1:baz:*',
    ]
  );
  await testGenerateMinimalQueryList(
    t, //
    ['suite1:baz:wye:*'],
    [
      'suite1:foo:*', //
      'suite1:bar/buzz:*',
      'suite1:baz:wye:*',
      'suite1:baz:zed:*',
    ]
  );
  await testGenerateMinimalQueryList(
    t, //
    ['suite1:baz:zed:*'],
    [
      'suite1:foo:*', //
      'suite1:bar/buzz:*',
      'suite1:baz:wye:*',
      'suite1:baz:zed:*',
    ]
  );
  await testGenerateMinimalQueryList(
    t, //
    [
      'suite1:baz:wye:*', //
      'suite1:baz:zed:*',
    ],
    [
      'suite1:foo:*', //
      'suite1:bar/buzz:*',
      'suite1:baz:wye:*',
      'suite1:baz:zed:*',
    ]
  );
  await testGenerateMinimalQueryList(
    t, //
    ['suite1:baz:wye:'],
    [
      'suite1:foo:*',
      'suite1:bar/buzz:*',
      'suite1:baz:wye:',
      'suite1:baz:wye:x=1',
      'suite1:baz:zed:*',
    ]
  );
  await testGenerateMinimalQueryList(
    t, //
    ['suite1:baz:wye:x=1'],
    [
      'suite1:foo:*',
      'suite1:bar/buzz:*',
      'suite1:baz:wye:',
      'suite1:baz:wye:x=1',
      'suite1:baz:zed:*',
    ]
  );
  await testGenerateMinimalQueryList(
    t, //
    [
      'suite1:foo:*', //
      'suite1:baz:wye:',
    ],
    [
      'suite1:foo:*',
      'suite1:bar/buzz:*',
      'suite1:baz:wye:',
      'suite1:baz:wye:x=1',
      'suite1:baz:zed:*',
    ]
  );
});
