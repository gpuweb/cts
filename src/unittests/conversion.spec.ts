export const description = `Unit tests for conversion`;

import { makeTestGroup } from '../common/internal/test_group.js';
import { float16BitsToFloat32, float32ToFloat16Bits } from '../webgpu/util/conversion.js';

import { UnitTest } from './unit_test.js';

export const g = makeTestGroup(UnitTest);

const cases = [
  [0b0011110000000000, 1],
  [0b0000010000000000, 0.00006103515625],
  [0b0011010101010101, 0.33325195],
  [0b0111101111111111, 65504],
  [0b0, 0],
  [14336, 0.5],
  [12902, 0.1999512],
  [22080, 100],
];

g.test('conversion,float16BitsToFloat32').fn(t => {
  cases.forEach(value => {
    // some loose check
    t.expect(Math.abs(float16BitsToFloat32(value[0]) - value[1]) <= 0.00001, value[0].toString(2));
  });
});

g.test('conversion,float32ToFloat16Bits').fn(t => {
  cases.forEach(value => {
    // some loose check
    // Does not handle clamping, underflow, overflow, or denormalized numbers.
    t.expect(Math.abs(float32ToFloat16Bits(value[1]) - value[0]) <= 3, value[1].toString());
  });
});
