export const description = 'Description for a.spec.ts';

import { makeTestGroup } from '../common/framework/test_group.js';
import { UnitTest } from '../unittests/unit_test.js';
import { checkElementsEqual } from '../webgpu/util/check_contents.js';

export const g = makeTestGroup(UnitTest);

g.test('not_implemented_yet').unimplemented();

g.test('checkContents').fn(t => {
  {
    t.expectOK(checkElementsEqual(new Uint8Array([]), new Uint8Array([])));
    t.expectOK(checkElementsEqual(new Uint8Array([0]), new Uint8Array([1])));
    t.expectOK(checkElementsEqual(new Uint8Array([1, 1, 1]), new Uint8Array([1, 2, 1])));
  }
  {
    const actual = new Uint8Array(280);
    const exp = new Uint8Array(280);
    for (let i = 2; i < 20; ++i) actual[i] = i - 4;
    t.expectOK(checkElementsEqual(actual, exp));
    for (let i = 2; i < 280; ++i) actual[i] = i - 4;
    t.expectOK(checkElementsEqual(actual, exp));
    for (let i = 0; i < 2; ++i) actual[i] = i - 4;
    t.expectOK(checkElementsEqual(actual, exp));
  }
  {
    const actual = new Int32Array(30);
    const exp = new Int32Array(30);
    for (let i = 2; i < 7; ++i) actual[i] = i - 3;
    t.expectOK(checkElementsEqual(actual, exp));
    for (let i = 2; i < 30; ++i) actual[i] = i - 3;
    t.expectOK(checkElementsEqual(actual, exp));
  }
  {
    const actual = new Float64Array(30);
    const exp = new Float64Array(30);
    for (let i = 2; i < 7; ++i) actual[i] = (i - 4) * 1e100;
    t.expectOK(checkElementsEqual(actual, exp));
    for (let i = 2; i < 280; ++i) actual[i] = (i - 4) * 1e100;
    t.expectOK(checkElementsEqual(actual, exp));
  }
  {
    t.expectOK(checkElementsEqual(new Uint8Array([]), new Uint8Array([])));
    t.expectOK(checkElementsEqual(new Uint8Array([0]), new Uint8Array([1])));
    t.expectOK(checkElementsEqual(new Uint8Array([1, 1, 1]), new Uint8Array([1, 2, 1])));
  }
});
