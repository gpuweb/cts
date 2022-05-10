/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution Tests for the f32 arithmetic binary expression operations
`;import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';
import { correctlyRoundedMatch, ulpMatch } from '../../../../util/compare.js';
import { TypeF32 } from '../../../../util/conversion.js';
import { biasedRange, fullF32Range } from '../../../../util/math.js';
import { makeBinaryF32Case, run } from '../expression.js';

import { binary } from './binary.js';

export const g = makeTestGroup(GPUTest);

g.test('addition').
specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation').
desc(
`
Expression: x + y
Accuracy: Correctly rounded
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('vectorize', [undefined, 2, 3, 4])).

fn(async (t) => {
  const cfg = t.params;
  cfg.cmpFloats = correctlyRoundedMatch();

  const makeCase = (lhs, rhs) => {
    return makeBinaryF32Case(lhs, rhs, (l, r) => {
      return l + r;
    });
  };

  const cases = [];
  const numeric_range = fullF32Range();
  numeric_range.forEach((lhs) => {
    numeric_range.forEach((rhs) => {
      cases.push(makeCase(lhs, rhs));
    });
  });

  run(t, binary('+'), [TypeF32, TypeF32], TypeF32, cfg, cases);
});

g.test('subtraction').
specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation').
desc(
`
Expression: x - y
Accuracy: Correctly rounded
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('vectorize', [undefined, 2, 3, 4])).

fn(async (t) => {
  const cfg = t.params;
  cfg.cmpFloats = correctlyRoundedMatch();

  const makeCase = (lhs, rhs) => {
    return makeBinaryF32Case(lhs, rhs, (l, r) => {
      return l - r;
    });
  };

  const cases = [];
  const numeric_range = fullF32Range();
  numeric_range.forEach((lhs) => {
    numeric_range.forEach((rhs) => {
      cases.push(makeCase(lhs, rhs));
    });
  });

  run(t, binary('-'), [TypeF32, TypeF32], TypeF32, cfg, cases);
});

g.test('multiplication').
specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation').
desc(
`
Expression: x * y
Accuracy: Correctly rounded
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('vectorize', [undefined, 2, 3, 4])).

fn(async (t) => {
  const cfg = t.params;
  cfg.cmpFloats = correctlyRoundedMatch();

  const makeCase = (lhs, rhs) => {
    return makeBinaryF32Case(lhs, rhs, (l, r) => {
      return l * r;
    });
  };

  const cases = [];
  const numeric_range = fullF32Range();
  numeric_range.forEach((lhs) => {
    numeric_range.forEach((rhs) => {
      cases.push(makeCase(lhs, rhs));
    });
  });

  run(t, binary('*'), [TypeF32, TypeF32], TypeF32, cfg, cases);
});

g.test('division').
specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation').
desc(
`
Expression: x / y
Accuracy: 2.5 ULP for |y| in the range [2^-126, 2^126]
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('vectorize', [undefined, 2, 3, 4])).

fn(async (t) => {
  const cfg = t.params;
  cfg.cmpFloats = ulpMatch(2.5);

  const makeCase = (lhs, rhs) => {
    return makeBinaryF32Case(
    lhs,
    rhs,
    (l, r) => {
      return l / r;
    },
    true);

  };

  const cases = [];
  const lhs_numeric_range = fullF32Range();
  const rhs_numeric_range = biasedRange(2 ** -126, 2 ** 126, 200).filter((value) => {
    return value !== 0.0;
  });
  lhs_numeric_range.forEach((lhs) => {
    rhs_numeric_range.forEach((rhs) => {
      cases.push(makeCase(lhs, rhs));
    });
  });

  run(t, binary('/'), [TypeF32, TypeF32], TypeF32, cfg, cases);
});

// Will be implemented as part larger derived accuracy task
g.test('modulus').
specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation').
desc(
`
Expression: x % y
Accuracy: Derived from x - y * trunc(x/y)
`).

params((u) => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3'])).
unimplemented();
//# sourceMappingURL=f32_arithmetic.spec.js.map