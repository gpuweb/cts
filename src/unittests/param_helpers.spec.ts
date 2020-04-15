export const description = `
Unit tests for parameterization helpers.
`;

import { pexclude, pfilter, poptions, params } from '../common/framework/params.js';
import { ParamSpec, ParamSpecIterable, paramsEquals } from '../common/framework/params_utils.js';
import { TestGroup } from '../common/framework/test_group.js';

import { UnitTest } from './unit_test.js';

class ParamsTest extends UnitTest {
  expectSpecEqual(act: ParamSpecIterable, exp: ParamSpec[]): void {
    const a = Array.from(act);
    this.expect(a.length === exp.length && a.every((x, i) => paramsEquals(x, exp[i])));
  }
}

export const g = new TestGroup(ParamsTest);

g.test('options').fn(t => {
  t.expectSpecEqual(poptions('hello', [1, 2, 3]), [{ hello: 1 }, { hello: 2 }, { hello: 3 }]);
});

g.test('params').fn(t => {
  t.expectSpecEqual(params(), [{}]);
});

g.test('combine/zeroes and ones').fn(t => {
  t.expectSpecEqual(params().combine([]).combine([]), []);
  t.expectSpecEqual(params().combine([]).combine([{}]), []);
  t.expectSpecEqual(params().combine([{}]).combine([]), []);
  t.expectSpecEqual(params().combine([{}]).combine([{}]), [{}]);
});

g.test('combine/mixed').fn(t => {
  t.expectSpecEqual(
    params()
      .combine(poptions('x', [1, 2]))
      .combine(poptions('y', ['a', 'b']))
      .combine([{ p: 4 }, { q: 5 }])
      .combine([{}])
      .getParams(),
    [
      { x: 1, y: 'a', p: 4 },
      { x: 1, y: 'a', q: 5 },
      { x: 1, y: 'b', p: 4 },
      { x: 1, y: 'b', q: 5 },
      { x: 2, y: 'a', p: 4 },
      { x: 2, y: 'a', q: 5 },
      { x: 2, y: 'b', p: 4 },
      { x: 2, y: 'b', q: 5 },
    ]
  );
});

g.test('filter').fn(t => {
  t.expectSpecEqual(
    pfilter(
      [
        { a: true, x: 1 },
        { a: false, y: 2 },
      ],
      p => p.a
    ),
    [{ a: true, x: 1 }]
  );
});

g.test('exclude').fn(t => {
  t.expectSpecEqual(
    pexclude(
      [
        { a: true, x: 1 },
        { a: false, y: 2 },
      ],
      [{ a: true }, { a: false, y: 2 }]
    ),
    [{ a: true, x: 1 }]
  );
});

g.test('undefined').fn(t => {
  t.expectSpecEqual([{ a: undefined }], [{}]);
  t.expectSpecEqual([{}], [{ a: undefined }]);
});

g.test('arrays').fn(t => {
  t.expectSpecEqual([{ a: [1, 2] }], [{ a: [1, 2] }]);
});
