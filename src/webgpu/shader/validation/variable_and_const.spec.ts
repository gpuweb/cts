export const description = `
Positive and negative validation tests for variable and const.
`;

import { params, poptions } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';

import { ShaderValidationTest } from './shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

const kScalarType = ['i32', 'f32', 'u32', 'bool'] as const;
type ScalarType = 'i32' | 'f32' | 'u32' | 'bool';

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
  'array',
] as const;
type ContainerType =
  | undefined
  | 'vec2'
  | 'vec3'
  | 'vec4'
  | 'mat2x2'
  | 'mat2x3'
  | 'mat2x4'
  | 'mat3x2'
  | 'mat3x3'
  | 'mat3x4'
  | 'mat4x2'
  | 'mat4x3'
  | 'mat4x4'
  | 'array';

function getType(scalarType: ScalarType, containerType: ContainerType) {
  let type = '';
  switch (containerType) {
    case undefined: {
      type = scalarType;
      break;
    }
    case 'array': {
      // TODO(sarahM0): 12 is a random number here. find a solution to replace it.
      type = `array<${scalarType}, 12>`;
      break;
    }
    default: {
      type = `${containerType}<${scalarType}>`;
      break;
    }
  }
  return type;
}

g.test('v_0033')
  .desc(
    `Tests for validation rule v-0033:
  If present, the initializer's type must match the store type of the variable.
  Testing scalars, vectors, and matrices of every dimension and type.
  TODO: add test for: structs - arrays bf vectors and matrices - arrays of different length
`
  )
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

    const lhsType = getType(lhsScalarType, lhsContainerType);
    const rhsType = getType(rhsScalarType, rhsContainerType);

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
