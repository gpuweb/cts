export const description = `
Execution Tests for the AbstractInt bitwise complement operation
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';
import { TypeAbstractInt } from '../../../../util/conversion.js';
import { onlyConstInputSource, run } from '../expression.js';

import { d } from './ai_complement.cache.js';
import { abstractIntUnary } from './unary.js';

export const g = makeTestGroup(GPUTest);

g.test('complement')
  .specURL('https://www.w3.org/TR/WGSL/#bit-expr')
  .desc(
    `
Expression: ~x
`
  )
  .params(u =>
    u
      .combine('inputSource', onlyConstInputSource)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cases = await d.get('complement');
    await run(t, abstractIntUnary('~'), [TypeAbstractInt], TypeAbstractInt, t.params, cases);
  });
