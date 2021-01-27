export const description = `
Tests for validation rule v-0033:
If present, the initializer’s type must match the store type of the variable.
`;

import { params, poptions } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import { assert } from '../../../common/framework/util/util.js';

import { ShaderValidationTest } from './shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

type ScalarType = 'f32' | 'i32' | 'u32' | 'bool';
const kScalarType = ['i32', 'f32', 'u32', 'bool'] as const;

function getTypeInfo(scalarType: ScalarType, x: number, y: number) {
  assert(x === 1 || x === 2 || x === 3 || x === 4, 'invalid x');
  assert(y === 1 || y === 2 || y === 3 || y === 4, 'invalid y');

  let type: string = '';
  if (y === 1) {
    if (x === 1) {
      type = scalarType;
    } else {
      type = `vec${x}<${scalarType}>`;
    }
  } else {
    type = `mat${x}x${y}<${scalarType}>`;
  }

  assert(type.length !== 0, 'type is not set');
  return type;
}

g.test('wgsl-v-0033')
  .desc(`v-033: If present, the initializer’s type must match the store type of the variable.`)
  .params(
    params()
      .combine(poptions('variable_or_constant', ['var', 'const']))
      .combine(poptions('lhsScalarType', kScalarType))
      .combine(poptions('rhsScalarType', kScalarType))
      .combine(poptions('lhs_x', [1, 2, 3, 4] as const))
      .combine(poptions('lhs_y', [1, 2, 3, 4] as const))
      .combine(poptions('rhs_x', [1, 2, 3, 4] as const))
      .combine(poptions('rhs_y', [1, 2, 3, 4] as const))
  )
  .fn(t => {
    const {
      variable_or_constant,
      lhsScalarType,
      rhsScalarType,
      lhs_x,
      lhs_y,
      rhs_x,
      rhs_y,
    } = t.params;

    const lhsType = getTypeInfo(lhsScalarType, lhs_x, lhs_y);
    const rhsType = getTypeInfo(rhsScalarType, rhs_x, rhs_y);

    const code = `
      [[stage(vertex)]]
      fn main() -> void {
        ${variable_or_constant} a : ${lhsType} = ${rhsType}();
      }
    `;

    const expectation =
      (lhsScalarType === rhsScalarType && lhs_x === rhs_x && lhs_y === rhs_y) || 'v-0033';
    t.expectCompileResult(expectation, code);
  });
