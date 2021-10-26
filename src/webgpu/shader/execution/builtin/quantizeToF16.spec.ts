export const description = `
Execution Tests for the 'quantizeToF16' builtin function
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { f32, f32Bits, TypeF32 } from '../../../util/conversion.js';

import { anyOf, run } from './builtin.js';

export const g = makeTestGroup(GPUTest);

const PositiveInf = f32Bits(0x7f800000);
const NegativeInf = f32Bits(0xff800000);

g.test('float_builtin_functions,quantize_to_f16')
  .uniqueId('ec899bfcd46a6316')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
quantize to f16:
T is f32 or vecN<f32> quantizeToF16(e: T ) -> T Quantizes a 32-bit floating point value e as if e were converted to a IEEE 754 binary16 value, and then converted back to a IEEE 754 binary32 value. See section 12.5.2 Floating point conversion. Component-wise when T is a vector. Note: The vec2<f32> case is the same as unpack2x16float(pack2x16float(e)). (OpQuantizeToF16)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    run(t, 'quantizeToF16', [TypeF32], TypeF32, t.params, [
      // Numbers representable as a f16.
      { input: f32(0.0), expected: f32(0.0) },
      { input: f32(1.0), expected: f32(1.0) },
      { input: f32(2.0), expected: f32(2.0) },
      { input: f32(4.0), expected: f32(4.0) },
      { input: f32(8.0), expected: f32(8.0) },
      { input: f32(16.0), expected: f32(16.0) },
      { input: f32(32.0), expected: f32(32.0) },
      { input: f32(64.0), expected: f32(64.0) },
      { input: f32(128.0), expected: f32(128.0) },
      { input: f32(256.0), expected: f32(256.0) },
      { input: f32(512.0), expected: f32(512.0) },
      { input: f32(1024.0), expected: f32(1024.0) },
      { input: f32(2048.0), expected: f32(2048.0) },
      { input: f32(4096.0), expected: f32(4096.0) },
      { input: f32(8192.0), expected: f32(8192.0) },
      { input: f32(16384.0), expected: f32(16384.0) },
      { input: f32(32768.0), expected: f32(32768.0) },
      { input: f32(-1.0), expected: f32(-1.0) },
      { input: f32(-2.0), expected: f32(-2.0) },
      { input: f32(-4.0), expected: f32(-4.0) },
      { input: f32(-8.0), expected: f32(-8.0) },
      { input: f32(-16.0), expected: f32(-16.0) },
      { input: f32(-32.0), expected: f32(-32.0) },
      { input: f32(-64.0), expected: f32(-64.0) },
      { input: f32(-128.0), expected: f32(-128.0) },
      { input: f32(-256.0), expected: f32(-256.0) },
      { input: f32(-512.0), expected: f32(-512.0) },
      { input: f32(-1024.0), expected: f32(-1024.0) },
      { input: f32(-2048.0), expected: f32(-2048.0) },
      { input: f32(-4096.0), expected: f32(-4096.0) },
      { input: f32(-8192.0), expected: f32(-8192.0) },
      { input: f32(-16384.0), expected: f32(-16384.0) },
      { input: f32(-32768.0), expected: f32(-32768.0) },

      { input: f32Bits(0x38802000), expected: f32Bits(0x38802000) }, // the next representable f16 number greater than 1.0
      { input: f32Bits(0xb8802000), expected: f32Bits(0xb8802000) }, // the next representable f16 number less than -1.0

      // limits
      { input: f32Bits(0x477fe000), expected: f32Bits(0x477fe000) }, // 65504 - largest positive f16
      { input: f32Bits(0xc77fe000), expected: f32Bits(0xc77fe000) }, // -65504 - largest negative f16
      { input: f32Bits(0x38800000), expected: f32Bits(0x38800000) }, // 0.00006103515625 - smallest positive f16
      { input: f32Bits(0xb8800000), expected: f32Bits(0xb8800000) }, // -0.00006103515625 - smallest positive f16

      // quantizing
      { input: f32Bits(0x477fe011), expected: anyOf(f32Bits(0x477fe000), PositiveInf) }, // slightly larger than largest positive f16
      { input: f32Bits(0xc77fe001), expected: anyOf(f32Bits(0xc77fe000), NegativeInf) }, // slightly larger than largest negative f16

      { input: f32Bits(0x387fe000), expected: anyOf(f32(0), f32Bits(0x38800000)) }, // slightly smaller than smallest positive f16
      { input: f32Bits(0xb87fe000), expected: anyOf(f32(0), f32Bits(0xb8800000)) }, // slightly smaller than smallest negative f16

      { input: f32Bits(0x38802001), expected: anyOf(f32Bits(0x38802000), f32Bits(0x38806000)) }, // slightly larger than the next representable f16 number > 1.0
      { input: f32Bits(0xb8802001), expected: anyOf(f32Bits(0xb8802000), f32Bits(0x38806000)) }, // slightly larger than the next representable f16 number > 1.0

      { input: f32Bits(0x38800001), expected: anyOf(f32Bits(0x38800000), f32Bits(0x38802000)) }, // slightly larger than smallest positive f16
      { input: f32Bits(0xb8800001), expected: anyOf(f32Bits(0xb8800000), f32Bits(0xb8802000)) }, // slightly larger than smallest negative f16
    ]);
  });
