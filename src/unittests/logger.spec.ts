export const description = `
Unit tests for namespaced logging system.

Also serves as a larger test of async test functions, and of the logging system.
`;

import { SkipTestCase } from '../common/framework/fixture.js';
import { Logger } from '../common/framework/logging/logger.js';
import { TestGroup } from '../common/framework/test_group.js';

import { UnitTest } from './unit_test.js';

export const g = new TestGroup(UnitTest);

g.test('construct').fn(t => {
  const mylog = new Logger(true);
  const [, res1] = mylog.record('one');
  const [, res2] = mylog.record('two');

  t.expect(mylog.results.get('one') === res1);
  t.expect(mylog.results.get('two') === res2);
  t.expect(res1.logs === undefined);
  t.expect(res1.status === 'running');
  t.expect(res1.timems < 0);
  t.expect(res2.logs === undefined);
  t.expect(res2.status === 'running');
  t.expect(res2.timems < 0);
});

g.test('empty').fn(t => {
  const mylog = new Logger(true);
  const [rec, res] = mylog.record('one');

  rec.start();
  t.expect(res.status === 'running');
  rec.finish();

  t.expect(res.status === 'pass');
  t.expect(res.timems >= 0);
});

g.test('pass').fn(t => {
  const mylog = new Logger(true);
  const [rec, res] = mylog.record('one');

  rec.start();
  rec.debug(new Error('hello'));
  t.expect(res.status === 'running');
  rec.finish();

  t.expect(res.status === 'pass');
  t.expect(res.timems >= 0);
});

g.test('skip').fn(t => {
  const mylog = new Logger(true);
  const [rec, res] = mylog.record('one');

  rec.start();
  rec.skipped(new SkipTestCase());
  rec.debug(new Error('hello'));
  rec.finish();

  t.expect(res.status === 'skip');
  t.expect(res.timems >= 0);
});

g.test('warn').fn(t => {
  const mylog = new Logger(true);
  const [rec, res] = mylog.record('one');

  rec.start();
  rec.warn(new Error('hello'));
  rec.skipped(new SkipTestCase());
  rec.finish();

  t.expect(res.status === 'skip');
  t.expect(res.timems >= 0);
});

g.test('fail').fn(t => {
  const mylog = new Logger(true);
  const [rec, res] = mylog.record('one');

  rec.start();
  rec.fail(new Error('bye'));
  rec.warn(new Error());
  rec.skipped(new SkipTestCase());
  rec.finish();

  t.expect(res.status === 'skip');
  t.expect(res.timems >= 0);
});

g.test('debug')
  .params([
    { debug: true, _logsCount: 1 }, //
    { debug: false, _logsCount: 0 },
  ])
  .fn(t => {
    const { debug, _logsCount } = t.params;

    const mylog = new Logger(debug);
    const [rec, res] = mylog.record('one');

    rec.start();
    rec.fail(new Error('bye'));
    rec.warn(new Error());
    rec.skipped(new SkipTestCase());
    rec.finish();

    t.expect(res.status === 'skip');
    t.expect(res.timems >= 0);
    t.expect(res.logs!.length === _logsCount);
  });
