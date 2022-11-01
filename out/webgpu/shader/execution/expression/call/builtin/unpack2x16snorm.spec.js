/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Decomposes a 32-bit value into two 16-bit chunks, then reinterprets each chunk
as a signed normalized floating point value.
Component i of the result is max(v ÷ 32767, -1), where v is the interpretation
of bits 16×i through 16×i+15 of e as a twos-complement signed integer.
`;import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { TypeF32, TypeU32, TypeVec } from '../../../../../util/conversion.js';
import { unpack2x16snormInterval } from '../../../../../util/f32_interval.js';
import { fullU32Range } from '../../../../../util/math.js';
import { allInputSources, makeU32ToVectorIntervalCase, run } from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('unpack').
specURL('https://www.w3.org/TR/WGSL/#unpack-builtin-functions').
desc(
`
@const fn unpack2x16snorm(e: u32) -> vec2<f32>
`).

params((u) => u.combine('inputSource', allInputSources)).
fn(async (t) => {
  const makeCase = (n) => {
    return makeU32ToVectorIntervalCase(n, unpack2x16snormInterval);
  };

  const cases = fullU32Range().map(makeCase);

  await run(t, builtin('unpack2x16snorm'), [TypeU32], TypeVec(2, TypeF32), t.params, cases);
});
//# sourceMappingURL=unpack2x16snorm.spec.js.map