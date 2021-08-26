export const description = `
Positive and negative validation tests for smoothStep builtin function.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { getCode } from '../../util/util.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

import { kSmallOpTypes as kOpTypes } from './builtin_types.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('smoothStep')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: smoothStep:
T is f32 or vecN<f32> smoothStep(e1: T ,e2: T ,e3: T ) -> T Returns the smooth Hermite interpolation between 0 and 1.
Component-wise when T is a vector.
(GLSLstd450SmoothStep)
`
  )
  .params(u =>
    u
      .combine('result', kOpTypes)
      .combine('e1T', kOpTypes)
      .combine('e2T', kOpTypes)
      .combine('e3T', kOpTypes)
  )
  .fn(t => {
    const { result, e1T, e2T, e3T } = t.params;

    const code = getCode(`var v:${result} = smoothStep(${e1T}(), ${e2T}(), ${e3T}());`);
    const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];
    const T = e1T;
    const expect_e1 = e1T === T;
    const expect_e2 = e2T === T;
    const expect_e3 = e3T === T;

    const expectation =
      expect_e1 && expect_e2 && expect_e3 && result === T && validT.indexOf(T) > -1;
    t.expectCompileResult(expectation, code);
  });
