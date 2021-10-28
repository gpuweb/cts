export const description = `
Execution Tests for the 'abs' builtin function
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import {
  F32,
  F32Bits,
  I32Bits,
  TypeF32,
  TypeI32,
  TypeU32,
  U32Bits,
} from '../../../util/conversion.js';

import { anyOf, kBit, kValue, run } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('integer_builtin_functions,abs_unsigned')
  .uniqueId('59ff84968a839124')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#integer-builtin-functions')
  .desc(
    `
scalar case, unsigned abs:
abs(e: T ) -> T
T is u32 or vecN<u32>. Result is e.
This is provided for symmetry with abs for signed integers.
Component-wise when T is a vector.
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    run(t, 'abs', [TypeU32], TypeU32, t.params, [
      // Min and Max u32
      { input: U32Bits(kBit.u32.min), expected: U32Bits(kBit.u32.min) },
      { input: U32Bits(kBit.u32.max), expected: U32Bits(kBit.u32.max) },
      // Powers of 2: -2^i: 0 =< i =< 31
      { input: U32Bits(kBit.powTwo.to0), expected: U32Bits(kBit.powTwo.to0) },
      { input: U32Bits(kBit.powTwo.to1), expected: U32Bits(kBit.powTwo.to1) },
      { input: U32Bits(kBit.powTwo.to2), expected: U32Bits(kBit.powTwo.to2) },
      { input: U32Bits(kBit.powTwo.to3), expected: U32Bits(kBit.powTwo.to3) },
      { input: U32Bits(kBit.powTwo.to4), expected: U32Bits(kBit.powTwo.to4) },
      { input: U32Bits(kBit.powTwo.to5), expected: U32Bits(kBit.powTwo.to5) },
      { input: U32Bits(kBit.powTwo.to6), expected: U32Bits(kBit.powTwo.to6) },
      { input: U32Bits(kBit.powTwo.to7), expected: U32Bits(kBit.powTwo.to7) },
      { input: U32Bits(kBit.powTwo.to8), expected: U32Bits(kBit.powTwo.to8) },
      { input: U32Bits(kBit.powTwo.to9), expected: U32Bits(kBit.powTwo.to9) },
      { input: U32Bits(kBit.powTwo.to10), expected: U32Bits(kBit.powTwo.to10) },
      { input: U32Bits(kBit.powTwo.to11), expected: U32Bits(kBit.powTwo.to11) },
      { input: U32Bits(kBit.powTwo.to12), expected: U32Bits(kBit.powTwo.to12) },
      { input: U32Bits(kBit.powTwo.to13), expected: U32Bits(kBit.powTwo.to13) },
      { input: U32Bits(kBit.powTwo.to14), expected: U32Bits(kBit.powTwo.to14) },
      { input: U32Bits(kBit.powTwo.to15), expected: U32Bits(kBit.powTwo.to15) },
      { input: U32Bits(kBit.powTwo.to16), expected: U32Bits(kBit.powTwo.to16) },
      { input: U32Bits(kBit.powTwo.to17), expected: U32Bits(kBit.powTwo.to17) },
      { input: U32Bits(kBit.powTwo.to18), expected: U32Bits(kBit.powTwo.to18) },
      { input: U32Bits(kBit.powTwo.to19), expected: U32Bits(kBit.powTwo.to19) },
      { input: U32Bits(kBit.powTwo.to20), expected: U32Bits(kBit.powTwo.to20) },
      { input: U32Bits(kBit.powTwo.to21), expected: U32Bits(kBit.powTwo.to21) },
      { input: U32Bits(kBit.powTwo.to22), expected: U32Bits(kBit.powTwo.to22) },
      { input: U32Bits(kBit.powTwo.to23), expected: U32Bits(kBit.powTwo.to23) },
      { input: U32Bits(kBit.powTwo.to24), expected: U32Bits(kBit.powTwo.to24) },
      { input: U32Bits(kBit.powTwo.to25), expected: U32Bits(kBit.powTwo.to25) },
      { input: U32Bits(kBit.powTwo.to26), expected: U32Bits(kBit.powTwo.to26) },
      { input: U32Bits(kBit.powTwo.to27), expected: U32Bits(kBit.powTwo.to27) },
      { input: U32Bits(kBit.powTwo.to28), expected: U32Bits(kBit.powTwo.to28) },
      { input: U32Bits(kBit.powTwo.to29), expected: U32Bits(kBit.powTwo.to29) },
      { input: U32Bits(kBit.powTwo.to30), expected: U32Bits(kBit.powTwo.to30) },
      { input: U32Bits(kBit.powTwo.to31), expected: U32Bits(kBit.powTwo.to31) },
    ]);
  });

g.test('integer_builtin_functions,abs_signed')
  .uniqueId('d8fc581d17db6ae8')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#integer-builtin-functions')
  .desc(
    `
signed abs:
abs(e: T ) -> T
T is i32 or vecN<i32>. The result is the absolute value of e.
Component-wise when T is a vector.
If e evaluates to the largest negative value, then the result is e.
(GLSLstd450SAbs)
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    run(t, 'abs', [TypeI32], TypeI32, t.params, [
      // Min and max i32
      // If e evaluates to the largest negative value, then the result is e.
      { input: I32Bits(kBit.i32.negative.min), expected: I32Bits(kBit.i32.negative.min) },
      { input: I32Bits(kBit.i32.negative.max), expected: I32Bits(kBit.i32.positive.min) },
      { input: I32Bits(kBit.i32.positive.max), expected: I32Bits(kBit.i32.positive.max) },
      { input: I32Bits(kBit.i32.positive.min), expected: I32Bits(kBit.i32.positive.min) },
      // input: -1 * pow(2, n), n = {-31, ..., 0 }, expected: pow(2, n), n = {-31, ..., 0}]
      { input: I32Bits(kBit.negPowTwo.to0), expected: I32Bits(kBit.powTwo.to0) },
      { input: I32Bits(kBit.negPowTwo.to1), expected: I32Bits(kBit.powTwo.to1) },
      { input: I32Bits(kBit.negPowTwo.to2), expected: I32Bits(kBit.powTwo.to2) },
      { input: I32Bits(kBit.negPowTwo.to3), expected: I32Bits(kBit.powTwo.to3) },
      { input: I32Bits(kBit.negPowTwo.to4), expected: I32Bits(kBit.powTwo.to4) },
      { input: I32Bits(kBit.negPowTwo.to5), expected: I32Bits(kBit.powTwo.to5) },
      { input: I32Bits(kBit.negPowTwo.to6), expected: I32Bits(kBit.powTwo.to6) },
      { input: I32Bits(kBit.negPowTwo.to7), expected: I32Bits(kBit.powTwo.to7) },
      { input: I32Bits(kBit.negPowTwo.to8), expected: I32Bits(kBit.powTwo.to8) },
      { input: I32Bits(kBit.negPowTwo.to9), expected: I32Bits(kBit.powTwo.to9) },
      { input: I32Bits(kBit.negPowTwo.to10), expected: I32Bits(kBit.powTwo.to10) },
      { input: I32Bits(kBit.negPowTwo.to11), expected: I32Bits(kBit.powTwo.to11) },
      { input: I32Bits(kBit.negPowTwo.to12), expected: I32Bits(kBit.powTwo.to12) },
      { input: I32Bits(kBit.negPowTwo.to13), expected: I32Bits(kBit.powTwo.to13) },
      { input: I32Bits(kBit.negPowTwo.to14), expected: I32Bits(kBit.powTwo.to14) },
      { input: I32Bits(kBit.negPowTwo.to15), expected: I32Bits(kBit.powTwo.to15) },
      { input: I32Bits(kBit.negPowTwo.to16), expected: I32Bits(kBit.powTwo.to16) },
      { input: I32Bits(kBit.negPowTwo.to17), expected: I32Bits(kBit.powTwo.to17) },
      { input: I32Bits(kBit.negPowTwo.to18), expected: I32Bits(kBit.powTwo.to18) },
      { input: I32Bits(kBit.negPowTwo.to19), expected: I32Bits(kBit.powTwo.to19) },
      { input: I32Bits(kBit.negPowTwo.to20), expected: I32Bits(kBit.powTwo.to20) },
      { input: I32Bits(kBit.negPowTwo.to21), expected: I32Bits(kBit.powTwo.to21) },
      { input: I32Bits(kBit.negPowTwo.to22), expected: I32Bits(kBit.powTwo.to22) },
      { input: I32Bits(kBit.negPowTwo.to23), expected: I32Bits(kBit.powTwo.to23) },
      { input: I32Bits(kBit.negPowTwo.to24), expected: I32Bits(kBit.powTwo.to24) },
      { input: I32Bits(kBit.negPowTwo.to25), expected: I32Bits(kBit.powTwo.to25) },
      { input: I32Bits(kBit.negPowTwo.to26), expected: I32Bits(kBit.powTwo.to26) },
      { input: I32Bits(kBit.negPowTwo.to27), expected: I32Bits(kBit.powTwo.to27) },
      { input: I32Bits(kBit.negPowTwo.to28), expected: I32Bits(kBit.powTwo.to28) },
      { input: I32Bits(kBit.negPowTwo.to29), expected: I32Bits(kBit.powTwo.to29) },
      { input: I32Bits(kBit.negPowTwo.to30), expected: I32Bits(kBit.powTwo.to30) },
      { input: I32Bits(kBit.negPowTwo.to31), expected: I32Bits(kBit.powTwo.to31) },
    ]);
  });

g.test('float_builtin_functions,abs_float')
  .uniqueId('2c1782b6a8dec8cb')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
float abs:
abs(e: T ) -> T
T is f32 or vecN<f32>
Returns the absolute value of e (e.g. e with a positive sign bit).
Component-wise when T is a vector. (GLSLstd450Fabs)
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    run(t, 'abs', [TypeF32], TypeF32, t.params, [
      // Min and Max f32
      { input: F32Bits(kBit.f32.negative.max), expected: F32Bits(0x0080_0000) },
      { input: F32Bits(kBit.f32.negative.min), expected: F32Bits(0x7f7f_ffff) },
      { input: F32Bits(kBit.f32.positive.min), expected: F32Bits(kBit.f32.positive.min) },
      { input: F32Bits(kBit.f32.positive.max), expected: F32Bits(kBit.f32.positive.max) },

      // Subnormal f32
      // TODO(sarahM0): Check if this is needed (or if it has to fail). If yes add other values.
      {
        input: F32Bits(kBit.f32.subnormal.positive.max),
        expected: anyOf(F32Bits(kBit.f32.subnormal.positive.max), F32(0)),
      },
      {
        input: F32Bits(kBit.f32.subnormal.positive.min),
        expected: anyOf(F32Bits(kBit.f32.subnormal.positive.min), F32(0)),
      },

      // Infinity f32
      { input: F32Bits(kBit.f32.infinity.negative), expected: F32Bits(kBit.f32.infinity.positive) },
      { input: F32Bits(kBit.f32.infinity.positive), expected: F32Bits(kBit.f32.infinity.positive) },

      // Powers of 2.0: -2.0^i: -1 >= i >= -31
      { input: F32(kValue.negPowTwo.toMinus1), expected: F32(kValue.powTwo.toMinus1) },
      { input: F32(kValue.negPowTwo.toMinus2), expected: F32(kValue.powTwo.toMinus2) },
      { input: F32(kValue.negPowTwo.toMinus3), expected: F32(kValue.powTwo.toMinus3) },
      { input: F32(kValue.negPowTwo.toMinus4), expected: F32(kValue.powTwo.toMinus4) },
      { input: F32(kValue.negPowTwo.toMinus5), expected: F32(kValue.powTwo.toMinus5) },
      { input: F32(kValue.negPowTwo.toMinus6), expected: F32(kValue.powTwo.toMinus6) },
      { input: F32(kValue.negPowTwo.toMinus7), expected: F32(kValue.powTwo.toMinus7) },
      { input: F32(kValue.negPowTwo.toMinus8), expected: F32(kValue.powTwo.toMinus8) },
      { input: F32(kValue.negPowTwo.toMinus9), expected: F32(kValue.powTwo.toMinus9) },
      { input: F32(kValue.negPowTwo.toMinus10), expected: F32(kValue.powTwo.toMinus10) },
      { input: F32(kValue.negPowTwo.toMinus11), expected: F32(kValue.powTwo.toMinus11) },
      { input: F32(kValue.negPowTwo.toMinus12), expected: F32(kValue.powTwo.toMinus12) },
      { input: F32(kValue.negPowTwo.toMinus13), expected: F32(kValue.powTwo.toMinus13) },
      { input: F32(kValue.negPowTwo.toMinus14), expected: F32(kValue.powTwo.toMinus14) },
      { input: F32(kValue.negPowTwo.toMinus15), expected: F32(kValue.powTwo.toMinus15) },
      { input: F32(kValue.negPowTwo.toMinus16), expected: F32(kValue.powTwo.toMinus16) },
      { input: F32(kValue.negPowTwo.toMinus17), expected: F32(kValue.powTwo.toMinus17) },
      { input: F32(kValue.negPowTwo.toMinus18), expected: F32(kValue.powTwo.toMinus18) },
      { input: F32(kValue.negPowTwo.toMinus19), expected: F32(kValue.powTwo.toMinus19) },
      { input: F32(kValue.negPowTwo.toMinus20), expected: F32(kValue.powTwo.toMinus20) },
      { input: F32(kValue.negPowTwo.toMinus21), expected: F32(kValue.powTwo.toMinus21) },
      { input: F32(kValue.negPowTwo.toMinus22), expected: F32(kValue.powTwo.toMinus22) },
      { input: F32(kValue.negPowTwo.toMinus23), expected: F32(kValue.powTwo.toMinus23) },
      { input: F32(kValue.negPowTwo.toMinus24), expected: F32(kValue.powTwo.toMinus24) },
      { input: F32(kValue.negPowTwo.toMinus25), expected: F32(kValue.powTwo.toMinus25) },
      { input: F32(kValue.negPowTwo.toMinus26), expected: F32(kValue.powTwo.toMinus26) },
      { input: F32(kValue.negPowTwo.toMinus27), expected: F32(kValue.powTwo.toMinus27) },
      { input: F32(kValue.negPowTwo.toMinus28), expected: F32(kValue.powTwo.toMinus28) },
      { input: F32(kValue.negPowTwo.toMinus29), expected: F32(kValue.powTwo.toMinus29) },
      { input: F32(kValue.negPowTwo.toMinus30), expected: F32(kValue.powTwo.toMinus30) },
      { input: F32(kValue.negPowTwo.toMinus31), expected: F32(kValue.powTwo.toMinus31) },

      // Powers of 2.0: -2.0^i: 1 <= i <= 31
      { input: F32(kValue.negPowTwo.to1), expected: F32(kValue.powTwo.to1) },
      { input: F32(kValue.negPowTwo.to2), expected: F32(kValue.powTwo.to2) },
      { input: F32(kValue.negPowTwo.to3), expected: F32(kValue.powTwo.to3) },
      { input: F32(kValue.negPowTwo.to4), expected: F32(kValue.powTwo.to4) },
      { input: F32(kValue.negPowTwo.to5), expected: F32(kValue.powTwo.to5) },
      { input: F32(kValue.negPowTwo.to6), expected: F32(kValue.powTwo.to6) },
      { input: F32(kValue.negPowTwo.to7), expected: F32(kValue.powTwo.to7) },
      { input: F32(kValue.negPowTwo.to8), expected: F32(kValue.powTwo.to8) },
      { input: F32(kValue.negPowTwo.to9), expected: F32(kValue.powTwo.to9) },
      { input: F32(kValue.negPowTwo.to10), expected: F32(kValue.powTwo.to10) },
      { input: F32(kValue.negPowTwo.to11), expected: F32(kValue.powTwo.to11) },
      { input: F32(kValue.negPowTwo.to12), expected: F32(kValue.powTwo.to12) },
      { input: F32(kValue.negPowTwo.to13), expected: F32(kValue.powTwo.to13) },
      { input: F32(kValue.negPowTwo.to14), expected: F32(kValue.powTwo.to14) },
      { input: F32(kValue.negPowTwo.to15), expected: F32(kValue.powTwo.to15) },
      { input: F32(kValue.negPowTwo.to16), expected: F32(kValue.powTwo.to16) },
      { input: F32(kValue.negPowTwo.to17), expected: F32(kValue.powTwo.to17) },
      { input: F32(kValue.negPowTwo.to18), expected: F32(kValue.powTwo.to18) },
      { input: F32(kValue.negPowTwo.to19), expected: F32(kValue.powTwo.to19) },
      { input: F32(kValue.negPowTwo.to20), expected: F32(kValue.powTwo.to20) },
      { input: F32(kValue.negPowTwo.to21), expected: F32(kValue.powTwo.to21) },
      { input: F32(kValue.negPowTwo.to22), expected: F32(kValue.powTwo.to22) },
      { input: F32(kValue.negPowTwo.to23), expected: F32(kValue.powTwo.to23) },
      { input: F32(kValue.negPowTwo.to24), expected: F32(kValue.powTwo.to24) },
      { input: F32(kValue.negPowTwo.to25), expected: F32(kValue.powTwo.to25) },
      { input: F32(kValue.negPowTwo.to26), expected: F32(kValue.powTwo.to26) },
      { input: F32(kValue.negPowTwo.to27), expected: F32(kValue.powTwo.to27) },
      { input: F32(kValue.negPowTwo.to28), expected: F32(kValue.powTwo.to28) },
      { input: F32(kValue.negPowTwo.to29), expected: F32(kValue.powTwo.to29) },
      { input: F32(kValue.negPowTwo.to30), expected: F32(kValue.powTwo.to30) },
      { input: F32(kValue.negPowTwo.to31), expected: F32(kValue.powTwo.to31) },
    ]);
  });
