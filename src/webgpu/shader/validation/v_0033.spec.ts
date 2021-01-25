export const description = `
Tests for validation rule v-0033.
`;

import { params, poptions } from '../../../common/framework/params_builder.js';
import { assert, repeat } from '../../../common/framework/util/util.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import { ShaderValidationTest } from './shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

type ScalarType = 'f32' | 'i32' | 'u32' | 'bool';
const kScalarType = ['i32', 'f32', 'u32', 'bool'] as const;

const kScalarTypeInfo = {
  f32: { zero: '0.0' },
  i32: { zero: '0' },
  u32: { zero: '0u' },
  bool: { zero: 'false' },
} as const;

function getVecTypeInfo(scalarType: ScalarType, length: number) {
  const scalarZero = kScalarTypeInfo[scalarType].zero;
  assert(length === 1 || length === 2 || length === 3 || length === 4, 'invalid vector length');
  const type = length === 1 ? scalarType : `vec${length}<${scalarType}>`;
  const zero = `${type}(${repeat(length, scalarZero).join(', ')})`;
  return { type, zero };
}

g.test('scalar_and_vector')
  .desc(
    `Test the left and right hand sides of a var expression have the same type, for
    scalar and vector types.`
  )
  .params(
    params()
      .combine(poptions('lhsScalarType', kScalarType))
      .combine(poptions('rhsScalarType', kScalarType))
      .combine(poptions('lhsLength', [1, 2, 3, 4] as const))
      .combine(poptions('rhsLength', [1, 2, 3, 4] as const))
  )
  .fn(t => {
    const { lhsScalarType, rhsScalarType, lhsLength, rhsLength } = t.params;

    const lhsType = getVecTypeInfo(lhsScalarType, lhsLength);
    const rhsType = getVecTypeInfo(rhsScalarType, rhsLength);

    t.debug(`var v : ${lhsType.type} = ${rhsType.zero};`);

    const code = `
      [[stage(vertex)]]
      fn main() -> void {
        var v : ${lhsType.type} = ${rhsType.zero};
      }
    `;

    const expectation = (lhsScalarType === rhsScalarType && lhsLength === rhsLength) || 'v-0033';
    t.expectCompileResult(expectation, code);
  });
