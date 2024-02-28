export const description = `
Execution Tests for the i32 bitwise complement operation
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';
import { i32, TypeI32 } from '../../../../util/conversion.js';
import { fullI32Range } from '../../../../util/math.js';
import { allInputSources, run } from '../expression.js';

import { unary } from './unary.js';

export const g = makeTestGroup(GPUTest);

g.test('i32_complement')
  .specURL('https://www.w3.org/TR/WGSL/#bit-expr')
  .desc(
    `
Expression: ~x
`
  )
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cases = fullI32Range().map(e => {
      return { input: i32(e), expected: i32(~e) };
    });
    await run(t, unary('~'), [TypeI32], TypeI32, t.params, cases);
  });
