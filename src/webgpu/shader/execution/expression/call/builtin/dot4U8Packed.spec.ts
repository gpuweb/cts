export const description = `
Execution tests for the 'dot4U8Packed' builtin function

@const fn dot4U8Packed(e1: u32 ,e2: u32) -> u32
e1 and e2 are interpreted as vectors with four 8-bit unsigned integer components. Return the
unsigned integer dot product of these two vectors.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { TypeU32, u32 } from '../../../../../util/conversion.js';
import { allInputSources, Config, run } from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('basic')
  .specURL('https://www.w3.org/TR/WGSL/#dot4U8Packed-builtin')
  .desc(
    `
@const fn dot4U8Packed(e1: u32, e2: u32) -> u32
  `
  )
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cfg: Config = t.params;
    await run(t, builtin('dot4U8Packed'), [TypeU32, TypeU32], TypeU32, cfg, [
      // dot({0u, 0u, 0u, 0u}, {0u, 0u, 0u, 0u})
      { input: [u32(0), u32(0)], expected: u32(0) },
      // dot({255u, 255u, 255u, 255u}, {255u, 255u, 255u, 255u})
      { input: [u32(0xffffffff), u32(0xffffffff)], expected: u32(260100) },
      // dot({1u, 2u, 3u, 4u}, {5u, 6u, 7u, 8u})
      { input: [u32(0x01020304), u32(0x05060708)], expected: u32(70) },
      // dot({120u, 90u, 60u, 30u}, {50u, 100u, 150u, 200u})
      { input: [u32(0x785a3c1e), u32(0x326496c8)], expected: u32(30000) },
    ]);
  });
