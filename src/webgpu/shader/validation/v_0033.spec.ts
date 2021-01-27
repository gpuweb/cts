export const description = `
Tests for validation rule v-0033:
If present, the initializer's type must match the store type of the variable.
`;

import { params, poptions } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';

import { ShaderValidationTest } from './shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

const kScalarType = ['i32', 'f32', 'u32', 'bool'] as const;
const kContainerTypes = [
  undefined,
  'vec2',
  'vec3',
  'vec4',
  'mat2x2',
  'mat2x3',
  'mat2x4',
  'mat3x2',
  'mat3x3',
  'mat3x4',
  'mat4x2',
  'mat4x3',
  'mat4x4',
] as const;

g.test('scalar_vector_matrix')
  .desc(`Tests for v-0033 with scalars, vectors, and matrices of every dimension and type`)
  .params(
    params()
      .combine(poptions('variableOrConstant', ['var', 'const']))
      .combine(poptions('lhsContainerType', kContainerTypes))
      .combine(poptions('lhsScalarType', kScalarType))
      .combine(poptions('rhsContainerType', kContainerTypes))
      .combine(poptions('rhsScalarType', kScalarType))
  )
  .fn(t => {
    const {
      variableOrConstant,
      lhsContainerType,
      lhsScalarType,
      rhsContainerType,
      rhsScalarType,
    } = t.params;

    const lhsType = lhsContainerType ? `${lhsContainerType}<${lhsScalarType}>` : lhsScalarType;
    const rhsType = rhsContainerType ? `${rhsContainerType}<${rhsScalarType}>` : rhsScalarType;

    const code = `
      [[stage(vertex)]]
      fn main() -> void {
        ${variableOrConstant} a : ${lhsType} = ${rhsType}();
      }
    `;

    const expectation =
      (lhsScalarType === rhsScalarType && lhsContainerType === rhsContainerType) || 'v-0033';
    t.expectCompileResult(expectation, code);
  });
