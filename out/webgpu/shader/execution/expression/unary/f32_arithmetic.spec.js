/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution Tests for the f32 arithmetic unary expression operations
`;import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';
import { correctlyRoundedMatch } from '../../../../util/compare.js';
import { TypeF32 } from '../../../../util/conversion.js';
import { fullF32Range } from '../../../../util/math.js';
import { makeUnaryF32Case, run } from '../expression.js';

import { unary } from './unary.js';

export const g = makeTestGroup(GPUTest);

g.test('negation').
specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation').
desc(
`
Expression: -x
Accuracy: Correctly rounded
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('vectorize', [undefined, 2, 3, 4])).

fn(async (t) => {
  const cfg = t.params;
  cfg.cmpFloats = correctlyRoundedMatch();

  const makeCase = (x) => {
    return makeUnaryF32Case(x, (p) => {
      return -p;
    });
  };

  const cases = fullF32Range({ neg_norm: 250, neg_sub: 20, pos_sub: 20, pos_norm: 250 }).map((x) =>
  makeCase(x));


  run(t, unary('-'), [TypeF32], TypeF32, cfg, cases);
});
//# sourceMappingURL=f32_arithmetic.spec.js.map