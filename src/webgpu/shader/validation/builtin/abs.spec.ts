export const description = `
Positive and negative validation tests for abs builtin function.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { getCode } from '../../util/util.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

import { kLargeOpTypes as kOpTypes } from './builtin_types.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('abs')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: float abs:
T is f32 or vecN<f32> abs(e: T ) -> T Returns the absolute value of e (e.g.
e with a positive sign bit).
Component-wise when T is a vector.
(GLSLstd450Fabs) Overload
URL:https://gpuweb.github.io/gpuweb/wgsl/#integer-builtin-functions
Description: signed abs:
T is i32 or vecN<i32> abs(e: T ) -> T The absolute value of e.
Component-wise when T is a vector.
If e evaluates to the largest negative value, then the result is e.
(GLSLstd450SAbs) Overload
URL:https://gpuweb.github.io/gpuweb/wgsl/#integer-builtin-functions
Description: scalar case, unsigned abs:
T is u32 or vecN<u32> abs(e: T ) -> T Result is e.
This is provided for symmetry with abs for signed integers.
Component-wise when T is a vector.
`
  )
  .params(u => u.combine('result', kOpTypes).combine('eT', kOpTypes))
  .fn(t => {
    const { result, eT } = t.params;

    const code = getCode(`var v:${result} = abs(${eT}());`);
    const validT = [
      'f32',
      'i32',
      'u32',
      'vec2<f32>',
      'vec3<f32>',
      'vec4<f32>',
      'vec2<i32>',
      'vec3<i32>',
      'vec4<i32>',
      'vec2<u32>',
      'vec3<u32>',
      'vec4<u32>',
    ];
    const T = eT;

    const expectation = result === T && validT.indexOf(T) > -1;
    t.expectCompileResult(expectation, code);
  });
