export const description = `
Execution tests for the 'pack4xU8' builtin function

@const fn pack4xU8(e: vec4<u32>) -> u32
Pack the lower 8 bits of each component of e into a u32 value and drop all the unused bits.
Component e[i] of the input is mapped to bits (8 * i) through (8 * (i + 7)) of the result.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { TypeU32, TypeVec, u32, toVector } from '../../../../../util/conversion.js';
import { Case } from '../../case.js';
import { allInputSources, Config, run } from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('basic')
  .specURL('https://www.w3.org/TR/WGSL/#pack4xU8-builtin')
  .desc(
    `
@const fn pack4xU8(e: vec4<u32>) -> u32
  `
  )
  .params(u => u.combine('inputSource', allInputSources))
  .fn(async t => {
    const cfg: Config = t.params;

    const pack4xU8 = (vals: readonly [number, number, number, number]) => {
      let result = 0;
      for (let i = 0; i < 4; ++i) {
        result |= (vals[i] & 0xff) << (i * 8);
      }
      return result;
    };

    const testInputs = [
      [0, 0, 0, 0],
      [1, 2, 3, 4],
      [255, 255, 255, 255],
      [254, 255, 256, 257],
      [65535, 65536, 255, 254],
    ] as const;

    const makeCase = (vals: readonly [number, number, number, number]): Case => {
      return { input: [toVector(vals, u32)], expected: u32(pack4xU8(vals)) };
    };
    const cases: Array<Case> = testInputs.flatMap(v => {
      return [makeCase(v)];
    });

    await run(t, builtin('pack4xU8'), [TypeVec(4, TypeU32)], TypeU32, cfg, cases);
  });
