export const description = `
Execution Tests for the abstract int arithmetic binary expression operations
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';
import { TypeAbstractInt, TypeVec } from '../../../../util/conversion.js';
import { onlyConstInputSource, run } from '../expression.js';

import { d } from './ai_arithmetic.cache.js';
import { abstractIntBinary } from './binary.js';

export const g = makeTestGroup(GPUTest);

g.test('addition')
  .specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation')
  .desc(
    `
Expression: x + y
`
  )
  .params(u =>
    u
      .combine('inputSource', onlyConstInputSource)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cases = await d.get('addition');
    await run(
      t,
      abstractIntBinary('+'),
      [TypeAbstractInt, TypeAbstractInt],
      TypeAbstractInt,
      t.params,
      cases
    );
  });

g.test('addition_scalar_vector')
  .specURL('https://www.w3.org/TR/WGSL/#arithmetic-expr')
  .desc(
    `
Expression: x + y
`
  )
  .params(u =>
    u.combine('inputSource', onlyConstInputSource).combine('vectorize_rhs', [2, 3, 4] as const)
  )
  .fn(async t => {
    const vec_size = t.params.vectorize_rhs;
    const vec_type = TypeVec(vec_size, TypeAbstractInt);
    const cases = await d.get(`addition_scalar_vector${vec_size}`);
    await run(t, abstractIntBinary('+'), [TypeAbstractInt, vec_type], vec_type, t.params, cases);
  });

g.test('addition_vector_scalar')
  .specURL('https://www.w3.org/TR/WGSL/#arithmetic-expr')
  .desc(
    `
Expression: x + y
`
  )
  .params(u =>
    u.combine('inputSource', onlyConstInputSource).combine('vectorize_lhs', [2, 3, 4] as const)
  )
  .fn(async t => {
    const vec_size = t.params.vectorize_lhs;
    const vec_type = TypeVec(vec_size, TypeAbstractInt);
    const cases = await d.get(`addition_vector${vec_size}_scalar`);
    await run(t, abstractIntBinary('+'), [vec_type, TypeAbstractInt], vec_type, t.params, cases);
  });
