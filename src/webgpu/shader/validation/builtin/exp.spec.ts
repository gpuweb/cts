export const description = `
Positive and negative validation tests for exp builtin function.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { getCode } from '../../util/util.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

import { kLargeOpTypes as kOpTypes } from './builtin_types.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('exp')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: exp:
T is f32 or vecN<f32> exp(e1: T ) -> T Returns the natural exponentiation of e1 (e.g.
ee1).
Component-wise when T is a vector.
(GLSLstd450Exp)
`
  )
  .params(u => u.combine('result', kOpTypes).combine('e1T', kOpTypes))
  .fn(t => {
    const { result, e1T } = t.params;

    const code = getCode(`var v:${result} = exp(${e1T}());`);
    const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];
    const T = e1T;
    const expect_e1 = e1T === T;

    const expectation = expect_e1 && result === T && validT.indexOf(T) > -1;
    t.expectCompileResult(expectation, code);
  });
