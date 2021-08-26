export const description = `
Positive and negative validation tests for pow builtin function.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { getCode } from '../../util/util.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

import { kSmallOpTypes as kOpTypes } from './builtin_types.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('pow')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: pow:
T is f32 or vecN<f32> pow(e1: T ,e2: T ) -> T Returns e1 raised to the power e2.
Component-wise when T is a vector.
(GLSLstd450Pow)
`
  )
  .params(u => u.combine('result', kOpTypes).combine('e1T', kOpTypes).combine('e2T', kOpTypes))
  .fn(t => {
    const { result, e1T, e2T } = t.params;

    const code = getCode(`var v:${result} = pow(${e1T}(), ${e2T}());`);
    const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];
    const T = e1T;
    const expect_e1 = e1T === T;
    const expect_e2 = e2T === T;

    const expectation = expect_e1 && expect_e2 && result === T && validT.indexOf(T) > -1;
    t.expectCompileResult(expectation, code);
  });
