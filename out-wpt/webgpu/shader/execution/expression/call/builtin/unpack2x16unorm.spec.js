/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ export const description = `
Decomposes a 32-bit value into two 16-bit chunks, then reinterprets each chunk
as an unsigned normalized floating point value.
Component i of the result is v ÷ 65535, where v is the interpretation of bits
16×i through 16×i+15 of e as an unsigned integer.
`;
import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { anyOf } from '../../../../../util/compare.js';
import {
  f32,
  TypeF32,
  TypeU32,
  TypeVec,
  u32,
  unpack2x16unorm,
  vec2,
} from '../../../../../util/conversion.js';
import { fullU32Range, quantizeToF32 } from '../../../../../util/math.js';
import { allInputSources, run } from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('unpack')
  .specURL('https://www.w3.org/TR/WGSL/#unpack-builtin-functions')
  .desc(
    `
@const fn unpack2x16unorm(e: u32) -> vec2<f32>
`
  )
  .params(u => u.combine('inputSource', [allInputSources[1]]))
  .fn(async t => {
    const makeCase = n => {
      n = quantizeToF32(n);
      const results = unpack2x16unorm(n);
      return {
        input: [u32(n)],
        expected: anyOf(...results.map(r => vec2(f32(r[0]), f32(r[1])))),
      };
    };

    const cases = fullU32Range().map(makeCase);

    await run(t, builtin('unpack2x16unorm'), [TypeU32], TypeVec(2, TypeF32), t.params, cases);
  });
