export const description = `
Positive and negative validation tests for log builtin function.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { getCode } from '../../util/util.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

import { kLargeOpTypes as kOpTypes } from './builtin_types.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('log')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: log:
T is f32 or vecN<f32> log(e: T ) -> T Returns the natural logaritm of e.
Component-wise when T is a vector.
(GLSLstd450Log)
`
  )
  .params(u => u.combine('result', kOpTypes).combine('eT', kOpTypes))
  .fn(t => {
    const { result, eT } = t.params;

    const code = getCode(`var v:${result} = log(${eT}());`);
    const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];
    const T = eT;

    const expectation = result === T && validT.indexOf(T) > -1;
    t.expectCompileResult(expectation, code);
  });
