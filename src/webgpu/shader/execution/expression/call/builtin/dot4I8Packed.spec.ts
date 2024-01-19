export const description = `
Execution tests for the 'dot4I8Packed' builtin function

@const fn dot4I8Packed(e1: u32 ,e2: u32) -> i32
e1 and e2 are interpreted as vectors with four 8-bit signed integer components. Return the signed
integer dot product of these two vectors. Each component is sign-extended to i32 before performing
the multiply, and then the add operations are done in WGSL i32 with wrapping behaviour.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { TypeI32, TypeU32, i32, u32 } from '../../../../../util/conversion.js';
import { allInputSources, Config, run } from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('basic')
  .specURL('https://www.w3.org/TR/WGSL/#dot4I8Packed-builtin')
  .desc(
    `
@const fn dot4I8Packed(e1: u32, e2: u32) -> i32
  `
  )
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cfg: Config = t.params;
    await run(t, builtin('dot4I8Packed'), [TypeU32, TypeU32], TypeI32, cfg, [
      // dot({0, 0, 0, 0}, {0, 0, 0, 0})
      { input: [u32(0), u32(0)], expected: i32(0) },
      // dot({127, 127, 127, 127}, {127, 127, 127, 127})
      { input: [u32(0x7f7f7f7f), u32(0x7f7f7f7f)], expected: i32(64516) },
      // dot({-128, -128, -128, -128}, {-128, -128, -128, -128})
      { input: [u32(0x80808080), u32(0x80808080)], expected: i32(65536) },
      // dot({127, 127, 127, 127}, {-128, -128, -128, -128})
      { input: [u32(0x7f7f7f7f), u32(0x80808080)], expected: i32(-65024) },
      // dot({1, 2, 3, 4}, {5, 6, 7, 8})
      { input: [u32(0x01020304), u32(0x05060708)], expected: i32(70) },
      // dot({1, 2, 3, 4}, {-1, -2, -3, -4})
      { input: [u32(0x01020304), u32(0xfffefdfc)], expected: i32(-30) },
      // dot({-5, -6, -7, -8}, {5, 6, 7, 8})
      { input: [u32(0xfbfaf9f8), u32(0x05060708)], expected: i32(-174) },
      // dot({-9, -10, -11, -12}, {-13, -14, -15, -16})
      { input: [u32(0xf7f6f5f4), u32(0xf3f2f1f0)], expected: i32(614) },
    ]);
  });
