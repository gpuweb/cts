export const description = `
Unit tests for TestGroup.
`;

import { Fixture } from '../common/framework/fixture.js';
import { poptions } from '../common/framework/params.js';
import { TestGroup } from '../common/framework/test_group.js';
import { assert } from '../common/framework/util/util.js';

import { TestGroupTest } from './test_group_test.js';
import { UnitTest } from './unit_test.js';

export const g = new TestGroup(TestGroupTest);

g.test('UnitTest fixture').fn(async t0 => {
  let seen = 0;
  /* eslint-disable-next-line  @typescript-eslint/no-unused-vars */
  function count(t: Fixture): void {
    seen++;
  }

  const g = new TestGroup(UnitTest);

  g.test('test').fn(count);
  g.test('testp')
    .params([{ a: 1 }])
    .fn(count);

  await t0.run(g);
  t0.expect(seen === 2);
});

g.test('custom fixture').fn(async t0 => {
  let seen = 0;
  class Counter extends UnitTest {
    count(): void {
      seen++;
    }
  }

  const g = new TestGroup(Counter);

  g.test('test').fn(t => {
    t.count();
  });
  g.test('testp')
    .params([{ a: 1 }])
    .fn(t => {
      t.count();
    });

  await t0.run(g);
  t0.expect(seen === 2);
});

g.test('stack').fn(async t0 => {
  const g = new TestGroup(UnitTest);

  const doNestedThrow1 = () => {
    throw new Error('goodbye');
  };

  const doNestedThrow2 = () => doNestedThrow1();

  g.test('fail').fn(t => {
    t.fail();
  });
  /* eslint-disable-next-line  @typescript-eslint/no-unused-vars */
  g.test('throw').fn(t => {
    throw new Error('hello');
  });
  /* eslint-disable-next-line  @typescript-eslint/no-unused-vars */
  g.test('throw nested').fn(t => {
    doNestedThrow2();
  });

  const res = await t0.run(g);

  const search = /unittests[/\\]test_group\.spec\.[tj]s|suites[/\\]unittests[/\\]unit_test\.[tj]s/;
  for (const { logs } of res.cases) {
    assert(logs !== undefined, 'expected logs');
    const l = logs[0].toJSON();
    t0.expect(search.test(l));
    const st = l.split('\n');
    t0.expect(search.test(st[st.length - 1]));
  }
});

g.test('duplicate test name').fn(t => {
  const g = new TestGroup(UnitTest);
  g.test('abc').fn(() => {});

  t.shouldThrow('Error', () => {
    g.test('abc').fn(() => {});
  });
});

g.test('duplicate test params').fn(t => {
  const g = new TestGroup(UnitTest);

  t.shouldThrow('Error', () => {
    g.test('abc')
      .params([
        { a: 1 }, //
        { a: 1 },
      ])
      .fn(() => {
        //
      });
  });
});

g.test('duplicate test params/with different private params').fn(t => {
  const g = new TestGroup(UnitTest);

  t.shouldThrow('Error', () => {
    g.test('abc')
      .params([
        { a: 1, _b: 1 }, //
        { a: 1, _b: 2 },
      ])
      .fn(() => {
        //
      });
  });
});

const badChars = Array.from('"`~@#$+=\\|!^&*[]<>{}-\'.,');
g.test('invalid test name')
  .params(poptions('char', badChars))
  .fn(t => {
    const g = new TestGroup(UnitTest);

    t.shouldThrow('Error', () => {
      g.test('a' + t.params.char + 'b').fn(() => {});
    });
  });

g.test('throws').fn(async t0 => {
  const g = new TestGroup(UnitTest);

  /* eslint-disable-next-line  @typescript-eslint/no-unused-vars */
  g.test('a').fn(t => {
    throw new Error();
  });

  const result = await t0.run(g);
  t0.expect(result.cases[0].status === 'fail');
});

g.test('shouldThrow').fn(async t0 => {
  t0.shouldThrow('TypeError', () => {
    throw new TypeError();
  });

  const g = new TestGroup(UnitTest);

  g.test('a').fn(t => {
    t.shouldThrow('Error', () => {
      throw new TypeError();
    });
  });

  const result = await t0.run(g);
  t0.expect(result.cases[0].status === 'fail');
});

g.test('shouldReject').fn(async t0 => {
  t0.shouldReject(
    'TypeError',
    (async () => {
      throw new TypeError();
    })()
  );

  const g = new TestGroup(UnitTest);

  g.test('a').fn(async t => {
    t.shouldReject(
      'Error',
      (async () => {
        throw new TypeError();
      })()
    );
  });

  const result = await t0.run(g);
  // Fails even though shouldReject doesn't fail until after the test function ends
  t0.expect(result.cases[0].status === 'fail');
});
