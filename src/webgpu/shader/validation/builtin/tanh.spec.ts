export const description = `
Positive and negative validation tests for tanh builtin function.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { getCode } from '../../util/util.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

import { kLargeOpTypes as kOpTypes } from './builtin_types.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('tanh')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: tanh:
T is f32 or vecN<f32> tanh(e: T ) -> T Returns the hyperbolic tangent of e.
Component-wise when T is a vector.
(GLSLstd450Tanh)
`
  )
  .params(u => u.combine('result', kOpTypes).combine('eT', kOpTypes))
  .fn(t => {
    const { result, eT } = t.params;

    const code = getCode(`var v:${result} = tanh(${eT}());`);
    const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];
    const T = eT;

    const expectation = result === T && validT.indexOf(T) > -1;
    t.expectCompileResult(expectation, code);
  });
