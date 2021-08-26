export const description = `
Positive and negative validation tests for max builtin function.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { getCode } from '../../util/util.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

import { kLargeOpTypes as kOpTypes } from './builtin_types.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('max')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: max:
T is f32 or vecN<f32> max(e1: T ,e2: T ) -> T Returns e2 if e1 is less than e2, and e1 otherwise.
If one operand is a NaN, the other is returned.
If both operands are NaNs, a NaN is returned.
Component-wise when T is a vector.
(GLSLstd450NMax) Overload
URL:https://gpuweb.github.io/gpuweb/wgsl/#integer-builtin-functions
Description: unsigned max:
T is u32 or vecN<u32> max(e1: T ,e2: T) -> T Returns e2 if e1 is less than e2, and e1 otherwise.
Component-wise when T is a vector.
(GLSLstd450UMax) Overload
URL:https://gpuweb.github.io/gpuweb/wgsl/#integer-builtin-functions
Description: signed max:
T is i32 or vecN<i32> max(e1: T ,e2: T) -> T Returns e2 if e1 is less than e2, and e1 otherwise.
Component-wise when T is a vector.
(GLSLstd450SMax)
`
  )
  .params(u => u.combine('result', kOpTypes).combine('e1T', kOpTypes).combine('e2T', kOpTypes))
  .fn(t => {
    const { result, e1T, e2T } = t.params;

    const code = getCode(`var v:${result} = max(${e1T}(), ${e2T}());`);
    const validT = [
      'f32',
      'u32',
      'i32',
      'vec2<f32>',
      'vec3<f32>',
      'vec4<f32>',
      'vec2<u32>',
      'vec3<u32>',
      'vec4<u32>',
      'vec2<i32>',
      'vec3<i32>',
      'vec4<i32>',
    ];
    const T = e1T;
    const expect_e1 = e1T === T;
    const expect_e2 = e2T === T;

    const expectation = expect_e1 && expect_e2 && result === T && validT.indexOf(T) > -1;
    t.expectCompileResult(expectation, code);
  });
