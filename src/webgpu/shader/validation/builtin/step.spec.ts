export const description = `
Positive and negative validation tests for step builtin function.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { getCode } from '../../util/util.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

import { kLargeOpTypes as kOpTypes } from './builtin_types.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('step')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: step:
T is f32 or vecN<f32> step(e1: T ,e2: T ) -> T Returns 0.0 if e1 is less than e2, and 1.0 otherwise.
Component-wise when T is a vector.
(GLSLstd450Step)
`
  )
  .params(u => u.combine('result', kOpTypes).combine('e1T', kOpTypes).combine('e2T', kOpTypes))
  .fn(t => {
    const { result, e1T, e2T } = t.params;

    const code = getCode(`var v:${result} = step(${e1T}(), ${e2T}());`);
    const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];
    const T = e1T;
    const expect_e1 = e1T === T;
    const expect_e2 = e2T === T;

    const expectation = expect_e1 && expect_e2 && result === T && validT.indexOf(T) > -1;
    t.expectCompileResult(expectation, code);
  });
