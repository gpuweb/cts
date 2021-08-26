export const description = `
Positive and negative validation tests for reflect builtin function.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { getCode } from '../../util/util.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

import { kLargeOpTypes as kOpTypes } from './builtin_types.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('reflect')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: reflect:
T is vecN<f32> reflect(e1: T ,e2: T ) -> T For the incident vector e1 and surface orientation e2, returns the reflection direction e1-2*dot(e2,e1)*e2.
(GLSLstd450Reflect)
`
  )
  .params(u => u.combine('result', kOpTypes).combine('e1T', kOpTypes).combine('e2T', kOpTypes))
  .fn(t => {
    const { result, e1T, e2T } = t.params;

    const code = getCode(`var v:${result} = reflect(${e1T}(), ${e2T}());`);
    const validT = ['vec2<f32>', 'vec3<f32>', 'vec4<f32>'];
    const T = e1T;
    const expect_e1 = e1T === T;
    const expect_e2 = e2T === T;

    const expectation = expect_e1 && expect_e2 && result === T && validT.indexOf(T) > -1;
    t.expectCompileResult(expectation, code);
  });
