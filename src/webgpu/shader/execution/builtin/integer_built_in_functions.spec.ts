export const description = `WGSL execution test. Section: Integer built-in functions`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('unsigned_clamp,integer_builtin_functions')
  .uniqueId('386458e12e52645b')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#integer-builtin-functions')
  .desc(
    `
unsigned clamp:
T is u32 or vecN<u32> clamp(e1: T ,e2: T,e3: T) -> T Returns min(max(e1,e2),e3). Component-wise when T is a vector. (GLSLstd450UClamp)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('signed_clamp,integer_builtin_functions')
  .uniqueId('da51d3c8cc902ab2')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#integer-builtin-functions')
  .desc(
    `
signed clamp:
T is i32 or vecN<i32> clamp(e1: T ,e2: T,e3: T) -> T Returns min(max(e1,e2),e3). Component-wise when T is a vector. (GLSLstd450SClamp)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('count_1_bits,integer_builtin_functions')
  .uniqueId('259605bdcc180a4b')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#integer-builtin-functions')
  .desc(
    `
count 1 bits:
T is i32, u32, vecN<i32>, or vecN<u32> countOneBits(e: T ) -> T The number of 1 bits in the representation of e. Also known as "population count". Component-wise when T is a vector. (SPIR-V OpBitCount)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('unsigned_max,integer_builtin_functions')
  .uniqueId('2cce54f65e71b3a3')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#integer-builtin-functions')
  .desc(
    `
unsigned max:
T is u32 or vecN<u32> max(e1: T ,e2: T) -> T Returns e2 if e1 is less than e2, and e1 otherwise. Component-wise when T is a vector. (GLSLstd450UMax)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('signed_max,integer_builtin_functions')
  .uniqueId('ef8c37107946a69e')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#integer-builtin-functions')
  .desc(
    `
signed max:
T is i32 or vecN<i32> max(e1: T ,e2: T) -> T Returns e2 if e1 is less than e2, and e1 otherwise. Component-wise when T is a vector. (GLSLstd450SMax)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('unsigned_min,integer_builtin_functions')
  .uniqueId('29aba7ede5b93cdd')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#integer-builtin-functions')
  .desc(
    `
unsigned min:
T is u32 or vecN<u32> min(e1: T ,e2: T) -> T Returns e1 if e1 is less than e2, and e2 otherwise. Component-wise when T is a vector. (GLSLstd450UMin)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('signed_min,integer_builtin_functions')
  .uniqueId('60c8ecdf409b45fc')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#integer-builtin-functions')
  .desc(
    `
signed min:
T is i32 or vecN<i32> min(e1: T ,e2: T) -> T Returns e1 if e1 is less than e2, and e2 otherwise. Component-wise when T is a vector. (GLSLstd45SUMin)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('bit_reversal,integer_builtin_functions')
  .uniqueId('8a7550f1097993f8')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#integer-builtin-functions')
  .desc(
    `
bit reversal:
T is i32, u32, vecN<i32>, or vecN<u32> reverseBits(e: T ) -> T Reverses the bits in e: The bit at position k of the result equals the bit at position 31-k of e. Component-wise when T is a vector. (SPIR-V OpBitReverse)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();
