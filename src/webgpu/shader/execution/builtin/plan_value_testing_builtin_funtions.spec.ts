export const description = `WGSL value testing builtin function execution test plan`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('isNan,value_testing_builtin_functions')
  .uniqueId(0xd77ce8845806badf)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#value-testing-builtin-functions
e: T T is f32 or vecN<f32> TR is bool if T is a scalar, or vecN<bool> if T is a vector isNan(e) ->TR Test for NaN according to IEEE-754. Component-wise when T is a vector. (OpIsNan)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('isInf,value_testing_builtin_functions')
  .uniqueId(0x6dd828b9022c168f)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#value-testing-builtin-functions
isInf(e) ->TR Test for infinity according to IEEE-754. Component-wise when T is a vector. (OpIsInf)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('isFinite,value_testing_builtin_functions')
  .uniqueId(0x94688509661b18d7)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#value-testing-builtin-functions
isFinite(e) ->TR Test a finite value according to IEEE-754. Component-wise when T is a vector.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('isNormal,value_testing_builtin_functions')
  .uniqueId(0xa2565b15516d4ab0)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#value-testing-builtin-functions
isNormal(e) ->TR Test a normal value according to IEEE-754. Component-wise when T is a vector.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('runtime_sized_array_length,value_testing_builtin_functions')
  .uniqueId(0x5005c0e88fb0a5a6)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#value-testing-builtin-functions
runtime-sized array length:
e: ptr<storage,array<T>> arrayLength(e): u32
Returns the number of elements in the runtime-sized array. (OpArrayLength, but the implementation has to trace back to get the pointer to the enclosing struct.)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();
