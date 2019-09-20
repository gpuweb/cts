export const description = `
Unit tests for namespaced logging system.

Also serves as a larger test of async test functions, and of the logging system.
`;

import { TestGroup } from '../../framework/index.js';
import { Logger } from '../../framework/logger.js';

import { UnitTest } from './unit_test.js';

export const g = new TestGroup(UnitTest);

g.test('construct', t => {
  const mylog = new Logger();
  const [testrec, testres] = mylog.record({ suite: 'a', path: 'foo/bar' });
  const [, res1] = testrec.record('baz', null);
  const params2 = {};
  const [, res2] = testrec.record('qux', params2);

  t.expect(testres.spec === 'a:foo/bar:');
  t.expect(testres.cases.length === 2);
  t.expect(testres.cases[0] === res1);
  t.expect(testres.cases[1] === res2);
  t.expect(res1.test === 'baz');
  t.expect(res1.params === null);
  t.expect(res1.logs === undefined);
  t.expect(res1.status === 'running');
  t.expect(res1.timems < 0);
  t.expect(res2.test === 'qux');
  t.expect(res2.params === params2);
  t.expect(res2.logs === undefined);
  t.expect(res2.status === 'running');
  t.expect(res2.timems < 0);
});

g.test('empty', t => {
  const mylog = new Logger();
  const [testrec] = mylog.record({ suite: '', path: '' });
  const [rec, res] = testrec.record('baz', null);

  rec.start();
  t.expect(res.status === 'running');
  rec.finish();
  t.expect(res.status === 'pass');
  t.expect(res.timems >= 0);
});

g.test('pass', t => {
  const mylog = new Logger();
  const [testrec] = mylog.record({ suite: '', path: '' });
  const [rec, res] = testrec.record('baz', null);

  rec.start();
  rec.log('hello');
  t.expect(res.status === 'running');
  rec.finish();
  t.expect(res.status === 'pass');
  t.expect(res.timems >= 0);
});

g.test('warn', t => {
  const mylog = new Logger();
  const [testrec] = mylog.record({ suite: '', path: '' });
  const [rec, res] = testrec.record('baz', null);

  rec.start();
  rec.warn();
  t.expect(res.status === 'running');
  rec.finish();
  t.expect(res.status === 'warn');
  t.expect(res.timems >= 0);
});

g.test('fail', t => {
  const mylog = new Logger();
  const [testrec] = mylog.record({ suite: '', path: '' });
  const [rec, res] = testrec.record('baz', null);

  rec.start();
  rec.fail('bye');
  t.expect(res.status === 'running');
  rec.finish();
  t.expect(res.status === 'fail');
  t.expect(res.timems >= 0);
});

g.test('debug', t => {
  const { debug, logsCount } = t.params;

  const mylog = new Logger();
  const [testrec] = mylog.record({ suite: '', path: '' });
  const [rec, res] = testrec.record('baz', null);

  rec.start(debug);
  rec.debug('hello');
  rec.finish();
  t.expect(res.status === 'pass');
  t.expect(res.timems >= 0);
  t.expect(res.logs!.length === logsCount);
}).params([
  { debug: true, logsCount: 1 }, // ()
  { debug: false, logsCount: 0 },
]);
