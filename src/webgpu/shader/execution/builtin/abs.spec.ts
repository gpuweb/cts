export const description = `
Execution Tests for the 'all' builtin function
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { assert } from '../../../../common/util/util.js';
import { GPUTest } from '../../../gpu_test.js';
import { generateTypes } from '../../types.js';

import { kValue, NumberType, runShaderTest } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('abs_int')
  .uniqueId(0xfab878e682c16d42)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210831#integer-builtin-functions
signed abs:
T is i32 or vecN<i32> abs(e: T ) -> T The absolute value of e.
Component-wise when T is a vector.
If e evaluates to the largest negative value, then the result is e.
`
  )
  .params(u =>
    u
      .combineWithParams([
        { storageClass: 'storage', storageMode: 'read_write', access: 'read' },
      ] as const)
      .combine('containerType', ['scalar', 'vector'] as const)
      .combine('isAtomic', [false])
      .combine('baseType', ['i32'] as const)
      .beginSubcases()
      .expandWithParams(generateTypes)
  )
  .fn(async t => {
    assert(t.params._kTypeInfo !== undefined, 'generated type is undefined');
    runShaderTest(
      t,
      t.params.storageClass,
      t.params.storageMode,
      t.params.baseType,
      t.params.type,
      t.params._kTypeInfo.arrayLength,
      'abs',
      [
        /* eslint-disable */
        // Min and max i32 
        // If e evaluates to the largest negative value, then the result is e.
        {numberType:NumberType.Hex, input: kValue.i32.negative.min, expected: [kValue.i32.negative.min] },
        {numberType:NumberType.Hex, input: kValue.i32.negative.max, expected: [kValue.i32.positive.min] },
        {numberType:NumberType.Hex, input: kValue.i32.positive.max, expected: [kValue.i32.positive.max] },
        {numberType:NumberType.Hex, input: kValue.i32.positive.min, expected: [kValue.i32.positive.min] },

        // Powers of 2
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to0, expected: [kValue.pow2.positive.to0] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to1, expected: [kValue.pow2.positive.to1] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to2, expected: [kValue.pow2.positive.to2] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to3, expected: [kValue.pow2.positive.to3] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to4, expected: [kValue.pow2.positive.to4] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to5, expected: [kValue.pow2.positive.to5] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to6, expected: [kValue.pow2.positive.to6] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to7, expected: [kValue.pow2.positive.to7] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to8, expected: [kValue.pow2.positive.to8] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to9, expected: [kValue.pow2.positive.to9] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to10, expected: [kValue.pow2.positive.to10] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to11, expected: [kValue.pow2.positive.to11] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to12, expected: [kValue.pow2.positive.to12] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to13, expected: [kValue.pow2.positive.to13] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to14, expected: [kValue.pow2.positive.to14] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to15, expected: [kValue.pow2.positive.to15] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to16, expected: [kValue.pow2.positive.to16] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to17, expected: [kValue.pow2.positive.to17] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to18, expected: [kValue.pow2.positive.to18] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to19, expected: [kValue.pow2.positive.to19] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to20, expected: [kValue.pow2.positive.to20] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to21, expected: [kValue.pow2.positive.to21] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to22, expected: [kValue.pow2.positive.to22] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to23, expected: [kValue.pow2.positive.to23] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to24, expected: [kValue.pow2.positive.to24] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to25, expected: [kValue.pow2.positive.to25] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to26, expected: [kValue.pow2.positive.to26] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to27, expected: [kValue.pow2.positive.to27] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to28, expected: [kValue.pow2.positive.to28] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to29, expected: [kValue.pow2.positive.to29] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to30, expected: [kValue.pow2.positive.to30] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.to31, expected: [kValue.pow2.positive.to31] },
        /* eslint-enable */
      ]
    );
  });

g.test('abs_uint')
  .uniqueId(0x59ff84968a839124)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210831#integer-builtin-function
scalar case, unsigned abs:
T is u32 or vecN<u32> abs(e: T ) -> T Result is e.
This is provided for symmetry with abs for signed integers.
Component-wise when T is a vector.
`
  )
  .params(u =>
    u
      .combineWithParams([
        { storageClass: 'storage', storageMode: 'read_write', access: 'read' },
      ] as const)
      .combine('containerType', ['scalar', 'vector'] as const)
      .combine('isAtomic', [false])
      .combine('baseType', ['u32'] as const)
      .beginSubcases()
      .expandWithParams(generateTypes)
  )
  .fn(async t => {
    assert(t.params._kTypeInfo !== undefined, 'generated type is undefined');
    runShaderTest(
      t,
      t.params.storageClass,
      t.params.storageMode,
      t.params.baseType,
      t.params.type,
      t.params._kTypeInfo.arrayLength,
      'abs',
      [
        /* eslint-disable */
        // Min and Max u32
        { numberType:NumberType.Hex, input: kValue.u32.min, expected: [kValue.u32.min] },
        { numberType:NumberType.Hex, input: kValue.u32.max, expected: [kValue.u32.max] },
        // Other random values
        {numberType:NumberType.Uint, input: 0, expected: [0] },
        {numberType:NumberType.Uint, input: 1, expected: [1] },
        {numberType:NumberType.Uint, input: 2, expected: [2] },
        {numberType:NumberType.Uint, input: 4, expected: [4] },
        {numberType:NumberType.Uint, input: 8, expected: [8] },
        {numberType:NumberType.Uint, input: 16, expected: [16] },
        {numberType:NumberType.Uint, input: 32, expected: [32] },
        {numberType:NumberType.Uint, input: 64, expected: [64] },
        {numberType:NumberType.Uint, input: 128, expected: [128] },
        {numberType:NumberType.Uint, input: 256, expected: [256] },
        {numberType:NumberType.Uint, input: 512, expected: [512] },
        {numberType:NumberType.Uint, input: 1024, expected: [1024] },
        {numberType:NumberType.Uint, input: 2048, expected: [2048] },
        {numberType:NumberType.Uint, input: 4096, expected: [4096] },
        {numberType:NumberType.Uint, input: 8192, expected: [8192] },
        {numberType:NumberType.Uint, input: 16384, expected: [16384] },
        {numberType:NumberType.Uint, input: 32768, expected: [32768] },
        {numberType:NumberType.Uint, input: 65536, expected: [65536] },
        {numberType:NumberType.Uint, input: 131072, expected: [131072] },
        {numberType:NumberType.Uint, input: 262144, expected: [262144] },
        {numberType:NumberType.Uint, input: 524288, expected: [524288] },
        {numberType:NumberType.Uint, input: 1048576, expected: [1048576] },
        {numberType:NumberType.Uint, input: 8388607, expected: [8388607] }, //2^23 - 1
        {numberType:NumberType.Uint, input: 16777215, expected: [16777215] }, //2^24 - 1
        {numberType:NumberType.Uint, input: 16777216, expected: [16777216] }, //2^24
        {numberType:NumberType.Uint, input: 134217727, expected: [134217727] }, //2^27 - 1
        {numberType:NumberType.Uint, input: 2147483647, expected: [2147483647] }, //2^31 - 1
        /* eslint-enable */
      ]
    );
  });

g.test('abs_float')
  .uniqueId(0x1f3fc889e2b1727f)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210831#float-builtin-functions
float abs:
T is f32 or vecN<f32> abs(e: T ) -> T
Returns the absolute value of e (e.g. e with a positive sign bit).
Component-wise when T is a vector.
(GLSLstd450Fabs)
`
  )
  .params(u =>
    u
      .combineWithParams([
        { storageClass: 'storage', storageMode: 'read_write', access: 'read' },
      ] as const)
      .combine('containerType', ['scalar', 'vector'] as const)
      .combine('isAtomic', [false])
      .combine('baseType', ['f32'] as const)
      .beginSubcases()
      .expandWithParams(generateTypes)
  )
  .fn(async t => {
    assert(t.params._kTypeInfo !== undefined, 'generated type is undefined');
    runShaderTest(
      t,
      t.params.storageClass,
      t.params.storageMode,
      t.params.baseType,
      t.params.type,
      t.params._kTypeInfo.arrayLength,
      'abs',
      [
        /* eslint-disable */
        // Powers of 2: -2^i: -1 >= i >= -31
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus1, expected: [kValue.pow2.positive.toMinus1] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus2, expected: [kValue.pow2.positive.toMinus2] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus3, expected: [kValue.pow2.positive.toMinus3] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus4, expected: [kValue.pow2.positive.toMinus4] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus5, expected: [kValue.pow2.positive.toMinus5] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus6, expected: [kValue.pow2.positive.toMinus6] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus7, expected: [kValue.pow2.positive.toMinus7] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus8, expected: [kValue.pow2.positive.toMinus8] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus9, expected: [kValue.pow2.positive.toMinus9] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus10, expected: [kValue.pow2.positive.toMinus10] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus11, expected: [kValue.pow2.positive.toMinus11] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus12, expected: [kValue.pow2.positive.toMinus12] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus13, expected: [kValue.pow2.positive.toMinus13] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus14, expected: [kValue.pow2.positive.toMinus14] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus15, expected: [kValue.pow2.positive.toMinus15] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus16, expected: [kValue.pow2.positive.toMinus16] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus17, expected: [kValue.pow2.positive.toMinus17] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus18, expected: [kValue.pow2.positive.toMinus18] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus19, expected: [kValue.pow2.positive.toMinus19] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus20, expected: [kValue.pow2.positive.toMinus20] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus21, expected: [kValue.pow2.positive.toMinus21] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus22, expected: [kValue.pow2.positive.toMinus22] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus23, expected: [kValue.pow2.positive.toMinus23] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus24, expected: [kValue.pow2.positive.toMinus24] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus25, expected: [kValue.pow2.positive.toMinus25] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus26, expected: [kValue.pow2.positive.toMinus26] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus27, expected: [kValue.pow2.positive.toMinus27] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus28, expected: [kValue.pow2.positive.toMinus28] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus29, expected: [kValue.pow2.positive.toMinus29] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus30, expected: [kValue.pow2.positive.toMinus30] },
        {numberType:NumberType.Hex, input: kValue.pow2.negative.toMinus31, expected: [kValue.pow2.positive.toMinus31] },

        // Min and Max f32
        // TODO(sarahM0): This is not in spec. Double check this.
        // If e evaluates to the largest negative value, then the result is e.
        {numberType:NumberType.Hex, input: kValue.f32.negative.max, expected: [0x800000] },
        {numberType:NumberType.Hex, input: kValue.f32.negative.min, expected: [0x7f7f_ffff] },
        {numberType:NumberType.Hex, input: kValue.f32.positive.min, expected: [kValue.f32.positive.min] },
        {numberType:NumberType.Hex, input: kValue.f32.positive.max, expected: [kValue.f32.positive.max] },

        // Subnormal f32
        // TODO(sarahM0): Check if this is needed (or if it has to fail). If yes add other values.
        {numberType:NumberType.Hex, input: kValue.f32.subnormal.positive.max, expected: [kValue.f32.subnormal.positive.max] },
        {numberType:NumberType.Hex, input: kValue.f32.subnormal.positive.min, expected: [kValue.f32.subnormal.positive.min] },

        // Nan f32
        // TODO(sarahM0): expect failure
        // { input: kValue.f32.nan.negative.s, expected: [kValue.f32.nan.positive.s] },
        // { input: kValue.f32.nan.negative.q, expected: [kValue.f32.nan.positive.q] },

        // Infinity f32
        {numberType:NumberType.Hex, input: kValue.f32.infinity.negative, expected: [kValue.f32.infinity.positive] },
        {numberType:NumberType.Hex, input: kValue.f32.infinity.positive, expected: [kValue.f32.infinity.positive] },

        //Other values
        {numberType: NumberType.Float, input: 0.0, expected: [0.0] },
        {numberType: NumberType.Float, input: 1.0, expected: [1.0] },
        {numberType: NumberType.Float, input: 2.0, expected: [2.0] },
        {numberType: NumberType.Float, input: 4.0, expected: [4.0] },
        {numberType: NumberType.Float, input: 8.0, expected: [8.0] },
        {numberType: NumberType.Float, input: 16.0, expected: [16.0] },
        {numberType: NumberType.Float, input: 32.0, expected: [32.0] },
        {numberType: NumberType.Float, input: 64.0, expected: [64.0] },
        {numberType: NumberType.Float, input: 128.0, expected: [128.0] },
        {numberType: NumberType.Float, input: 256.0, expected: [256.0] },
        {numberType: NumberType.Float, input: 512.0, expected: [512.0] },
        {numberType: NumberType.Float, input: 1024.0, expected: [1024.0] },
        {numberType: NumberType.Float, input: 2048.0, expected: [2048.0] },
        {numberType: NumberType.Float, input: 4096.0, expected: [4096.0] },
        {numberType: NumberType.Float, input: 8192.0, expected: [8192.0] },
        {numberType: NumberType.Float, input: 16384.0, expected: [16384.0] },
        {numberType: NumberType.Float, input: 32768.0, expected: [32768.0] },
        {numberType: NumberType.Float, input: 65536.0, expected: [65536.0] },
        {numberType: NumberType.Float, input: 131072.0, expected: [131072.0] },
        {numberType: NumberType.Float, input: 262144.0, expected: [262144.0] },
        {numberType: NumberType.Float, input: 524288.0, expected: [524288.0] },
        {numberType: NumberType.Float, input: 1048576.0, expected: [1048576.0] },
        {numberType: NumberType.Float, input: 8388607.0, expected: [8388607.0] }, //2^23 - 1
        {numberType: NumberType.Float, input: 16777215.0, expected: [16777215.0] }, //2^24 - 1
        {numberType: NumberType.Float, input: 16777216.0, expected: [16777216.0] }, //2^24
        {numberType: NumberType.Float, input: 0.0, expected: [0.0] },
        {numberType: NumberType.Float, input: -1.0, expected: [1.0] },
        {numberType: NumberType.Float, input: -2.0, expected: [2.0] },
        {numberType: NumberType.Float, input: -4.0, expected: [4.0] },
        {numberType: NumberType.Float, input: -8.0, expected: [8.0] },
        {numberType: NumberType.Float, input: -16.0, expected: [16.0] },
        {numberType: NumberType.Float, input: -32.0, expected: [32.0] },
        {numberType: NumberType.Float, input: -64.0, expected: [64.0] },
        {numberType: NumberType.Float, input: -128.0, expected: [128.0] },
        {numberType: NumberType.Float, input: -256.0, expected: [256.0] },
        {numberType: NumberType.Float, input: -512.0, expected: [512.0] },
        {numberType: NumberType.Float, input: -1024.0, expected: [1024.0] },
        {numberType: NumberType.Float, input: -2048.0, expected: [2048.0] },
        {numberType: NumberType.Float, input: -4096.0, expected: [4096.0] },
        {numberType: NumberType.Float, input: -8192.0, expected: [8192.0] },
        {numberType: NumberType.Float, input: -16384.0, expected: [16384.0] },
        {numberType: NumberType.Float, input: -32768.0, expected: [32768.0] },
        {numberType: NumberType.Float, input: -65536.0, expected: [65536.0] },
        {numberType: NumberType.Float, input: -131072.0, expected: [131072.0] },
        {numberType: NumberType.Float, input: -262144.0, expected: [262144.0] },
        {numberType: NumberType.Float, input: -524288.0, expected: [524288.0] },
        {numberType: NumberType.Float, input: -1048576.0, expected: [1048576.0] },
        {numberType: NumberType.Float, input: -8388607.0, expected: [8388607.0] }, //2^23 - 1
        {numberType: NumberType.Float, input: -16777215.0, expected: [16777215.0] }, //2^24 - 1
        {numberType: NumberType.Float, input: -16777216.0, expected: [16777216.0] }, //2^24
        /* eslint-enable */
      ]
    );
  });
