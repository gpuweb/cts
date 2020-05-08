export const description = `
Tests for queries/filtering, loading, and running.
`;

import { TestSuiteListing, TestSuiteListingEntry } from '../common/framework/listing.js';
import { TestFileLoader, TestLoader, TestSpecOrReadme } from '../common/framework/loader.js';
import { Logger } from '../common/framework/logging/logger.js';
import { Status } from '../common/framework/logging/result.js';
import { TestQuery } from '../common/framework/query/query.js';
import { stringifyQuery } from '../common/framework/query/stringifyQuery.js';
import { TestGroup } from '../common/framework/test_group.js';
import { FilterResultTreeLeaf } from '../common/framework/tree.js';
import { assert, objectEquals } from '../common/framework/util/util.js';

import { UnitTest } from './unit_test.js';

const listingData: { [k: string]: TestSuiteListingEntry[] } = {
  suite1: [
    { path: [], readme: 'desc 1a' },
    { path: ['foo'], description: 'desc 1b' },
    { path: ['bar'], readme: 'desc 1c' },
    { path: ['bar', 'buzz', 'buzz'], description: 'desc 1d' },
    { path: ['baz'], description: 'desc 1e' },
  ],
  suite2: [
    { path: [], readme: 'desc 2a' },
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
  'suite1/bar/buzz/buzz.spec.js': {
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
        .params([{}, { x: 1 }])
        .fn(() => {});
      g.test('zed')
        .params([
          { a: 1, b: 2, _c: 0 },
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

g.test('suite').fn(async t => {
  t.shouldReject('Error', t.load('suite1'));
  t.shouldReject('Error', t.load('suite1:'));
});

g.test('group').fn(async t => {
  t.expect((await t.load('suite1:*')).length === 8);
  t.expect((await t.load('suite1:foo,*')).length === 3); // x:foo,* matches x:foo:
  t.expect((await t.load('suite1:bar,*')).length === 1);
  t.expect((await t.load('suite1:bar,buzz,buzz,*')).length === 1);

  t.shouldReject('Error', t.load('suite1:f*'));
});

g.test('test').fn(async t => {
  t.shouldReject('Error', t.load('suite1::'));
  t.shouldReject('Error', t.load('suite1:bar:'));
  t.shouldReject('Error', t.load('suite1:bar,:'));

  t.shouldReject('Error', t.load('suite1::*'));
  t.shouldReject('Error', t.load('suite1:bar,:*'));
  t.shouldReject('Error', t.load('suite1:bar:*'));

  t.expect((await t.load('suite1:foo:*')).length === 3);
  t.expect((await t.load('suite1:bar,buzz,buzz:*')).length === 1);
  t.expect((await t.load('suite1:baz:*')).length === 4);
  t.expect((await t.load('suite1:foo:*')).length === 3);

  t.expect((await t.load('suite2:foof:bluh,*')).length === 1);
  t.expect((await t.load('suite2:foof:bluh,a,*')).length === 1);
});

g.test('case').fn(async t => {
  t.shouldReject('Error', t.load('suite1:foo::'));
  t.shouldReject('Error', t.load('suite1:bar:zed,:'));

  t.shouldReject('Error', t.load('suite1:foo:h*'));

  t.shouldReject('Error', t.load('suite1:foo::*'));
  t.shouldReject('Error', t.load('suite1:baz::*'));
  t.shouldReject('Error', t.load('suite1:baz:zed,:*'));

  t.shouldReject('Error', t.load('suite1:baz:zed:'));
  t.shouldReject('Error', t.load('suite1:baz:zed:a=1,b=2*'));
  t.shouldReject('Error', t.load('suite1:baz:zed:a=1,b=2,'));
  t.shouldReject('Error', t.load('suite1:baz:zed:b=2*'));
  t.shouldReject('Error', t.load('suite1:baz:zed:b=2,*'));
  t.shouldReject('Error', t.load('suite1:baz:zed:b=2,a=1'));
  t.shouldReject('Error', t.load('suite1:baz:zed:b=2,a=1,_c=0'));

  t.expect((await t.load('suite1:baz:zed:*')).length === 2);
  t.expect((await t.load('suite1:baz:zed:a=1,*')).length === 1);
  t.expect((await t.load('suite1:baz:zed:a=1,b=2')).length === 1);
  t.expect((await t.load('suite1:baz:zed:a=1,b=2,*')).length === 1);
  t.expect((await t.load('suite1:baz:zed:b=3,a=1')).length === 1);
  t.expect((await t.load('suite1:foo:hello:')).length === 1);
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

g.test('partial test', 'match').fn(async () => {});

g.test('end2end').fn(async t => {
  const l = await t.load('suite2:foof:*');
  assert(l.length === 3, 'listing length');

  const log = new Logger(true);

  const exp = async (
    i: number,
    query: TestQuery,
    status: Status,
    logs: (s: string[]) => boolean
  ) => {
    t.expect(objectEquals(l[i].query, query));
    const name = stringifyQuery(l[i].query);
    const [rec, res] = log.record(name);
    await l[i].run(rec);

    t.expect(log.results.get(name) === res);
    t.expect(res.status === status);
    t.expect(res.timems > 0);
    assert(res.logs !== undefined); // only undefined while pending
    t.expect(logs(res.logs.map(l => JSON.stringify(l))));
  };

  await exp(
    0,
    { suite: 'suite2', group: ['foof'], test: ['blah'], params: {}, endsWithWildcard: false },
    'pass',
    logs => objectEquals(logs, ['DEBUG: OK'])
  );
  await exp(
    1,
    { suite: 'suite2', group: ['foof'], test: ['bleh'], params: { a: 1 }, endsWithWildcard: false },
    'pass',
    logs => objectEquals(logs, ['DEBUG: OK', 'DEBUG: OK'])
  );
  await exp(
    2,
    { suite: 'suite2', group: ['foof'], test: ['bluh', 'a'], params: {}, endsWithWildcard: false },
    'fail',
    logs =>
      logs.length === 1 &&
      logs[0].startsWith('"FAIL: Error: bye\\n') &&
      logs[0].indexOf('loading.spec.') !== -1
  );
});

async function testIterateCollapsed(
  t: LoadingTest,
  expectations: string[],
  expectedResult: 'throws' | string[]
) {
  const treePromise = LoadingTest.loader.loadTree('suite1:*', expectations);
  if (expectedResult === 'throws') {
    t.shouldReject('Error', treePromise, 'loadTree should have thrown Error');
    return;
  }
  const tree = await treePromise;
  const actual = Array.from(tree.iterateCollapsed(), q => stringifyQuery(q));
  if (!objectEquals(actual, expectedResult)) {
    t.fail(`iterateCollapse failed:\n  got ${actual}\n  exp ${expectedResult}\n${tree.toString()}`);
  }
}

g.test('print').fn(async () => {
  const tree = await LoadingTest.loader.loadTree('suite1:*');
  tree.toString();
});

g.test('iterateCollapsed').fn(async t => {
  // No effect
  await testIterateCollapsed(t, [], ['suite1:foo:*', 'suite1:bar,buzz,buzz:*', 'suite1:baz:*']);
  await testIterateCollapsed(
    t,
    ['suite1:*'],
    ['suite1:foo:*', 'suite1:bar,buzz,buzz:*', 'suite1:baz:*']
  );
  await testIterateCollapsed(
    t,
    ['suite1:foo:*'],
    ['suite1:foo:*', 'suite1:bar,buzz,buzz:*', 'suite1:baz:*']
  );
  await testIterateCollapsed(
    t,
    ['suite1:bar,buzz,buzz:*'],
    ['suite1:foo:*', 'suite1:bar,buzz,buzz:*', 'suite1:baz:*']
  );

  // Some effect
  await testIterateCollapsed(
    t,
    ['suite1:baz:wye:*'],
    ['suite1:foo:*', 'suite1:bar,buzz,buzz:*', 'suite1:baz:wye:*', 'suite1:baz:zed,*']
  );
  await testIterateCollapsed(
    t,
    ['suite1:baz:zed:*'],
    ['suite1:foo:*', 'suite1:bar,buzz,buzz:*', 'suite1:baz:wye,*', 'suite1:baz:zed:*']
  );
  await testIterateCollapsed(
    t,
    ['suite1:baz:wye:*', 'suite1:baz:zed:*'],
    ['suite1:foo:*', 'suite1:bar,buzz,buzz:*', 'suite1:baz:wye:*', 'suite1:baz:zed:*']
  );
  await testIterateCollapsed(
    t,
    ['suite1:baz:wye:'],
    [
      'suite1:foo:*',
      'suite1:bar,buzz,buzz:*',
      'suite1:baz:wye:',
      'suite1:baz:wye:x=1',
      'suite1:baz:zed,*',
    ]
  );
  await testIterateCollapsed(
    t,
    ['suite1:baz:wye:x=1'],
    [
      'suite1:foo:*',
      'suite1:bar,buzz,buzz:*',
      'suite1:baz:wye:',
      'suite1:baz:wye:x=1',
      'suite1:baz:zed,*',
    ]
  );
  await testIterateCollapsed(
    t,
    ['suite1:foo:*', 'suite1:baz:wye:'],
    [
      'suite1:foo:*',
      'suite1:bar,buzz,buzz:*',
      'suite1:baz:wye:',
      'suite1:baz:wye:x=1',
      'suite1:baz:zed,*',
    ]
  );

  // Invalid expectation queries
  await testIterateCollapsed(t, ['garbage'], 'throws');
  await testIterateCollapsed(t, ['garbage*'], 'throws');
  await testIterateCollapsed(t, ['suite1*'], 'throws');
  await testIterateCollapsed(t, ['suite1:foo*'], 'throws');
  await testIterateCollapsed(t, ['suite1:foo:ba*'], 'throws');

  // Valid expectation queries but they don't match anything
  await testIterateCollapsed(t, ['garbage:*'], 'throws');
  await testIterateCollapsed(t, ['suite1:doesntexist:*'], 'throws');
  await testIterateCollapsed(t, ['suite2:foo:*'], 'throws');
  // Doesn't match anything because we collapse this unnecessary node into just 'suite1:foo:*'
  await testIterateCollapsed(t, ['suite1:foo,*'], 'throws');
});
