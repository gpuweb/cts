export const description = `
Validation tests for short-circuiting && and || expressions.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { keysOf, objectsToRecord } from '../../../../../common/util/data_tables.js';
import {
  kAllScalarsAndVectors,
  ScalarType,
  scalarTypeOf,
  Type,
} from '../../../../util/conversion.js';
import { ShaderValidationTest } from '../../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

// A list of scalar and vector types.
const kScalarAndVectorTypes = objectsToRecord(kAllScalarsAndVectors);

g.test('scalar_vector')
  .desc(
    `
  Validates that scalar and vector short-circuiting operators are only accepted for scalar booleans.
  `
  )
  .params(u =>
    u
      .combine('op', ['&&', '||'])
      .combine('lhs', keysOf(kScalarAndVectorTypes))
      .combine(
        'rhs',
        // Skip vec3 and vec4 on the RHS to keep the number of subcases down.
        keysOf(kScalarAndVectorTypes).filter(
          value => !(value.startsWith('vec3') || value.startsWith('vec4'))
        )
      )
      .beginSubcases()
  )
  .beforeAllSubcases(t => {
    if (
      scalarTypeOf(kScalarAndVectorTypes[t.params.lhs]) === Type.f16 ||
      scalarTypeOf(kScalarAndVectorTypes[t.params.rhs]) === Type.f16
    ) {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    const lhs = kScalarAndVectorTypes[t.params.lhs];
    const rhs = kScalarAndVectorTypes[t.params.rhs];
    const lhsElement = scalarTypeOf(lhs);
    const rhsElement = scalarTypeOf(rhs);
    const hasF16 = lhsElement === Type.f16 || rhsElement === Type.f16;
    const code = `
${hasF16 ? 'enable f16;' : ''}
const lhs = ${lhs.create(0).wgsl()};
const rhs = ${rhs.create(0).wgsl()};
const foo = lhs ${t.params.op} rhs;
`;

    // Determine if the types are compatible.
    let valid = false;
    if (lhs instanceof ScalarType && rhs instanceof ScalarType) {
      valid = lhsElement === Type.bool && rhsElement === Type.bool;
    }

    t.expectCompileResult(valid, code);
  });

interface InvalidTypeConfig {
  // An expression that produces a value of the target type.
  expr: string;
  // A function that converts an expression of the target type into a valid boolean operand.
  control: (x: string) => string;
}
const kInvalidTypes: Record<string, InvalidTypeConfig> = {
  mat2x2f: {
    expr: 'm',
    control: e => `bool(${e}[0][0])`,
  },

  array: {
    expr: 'arr',
    control: e => `${e}[0]`,
  },

  ptr: {
    expr: '(&b)',
    control: e => `*${e}`,
  },

  atomic: {
    expr: 'a',
    control: e => `bool(atomicLoad(&${e}))`,
  },

  texture: {
    expr: 't',
    control: e => `bool(textureLoad(${e}, vec2(), 0).x)`,
  },

  sampler: {
    expr: 's',
    control: e => `bool(textureSampleLevel(t, ${e}, vec2(), 0).x)`,
  },

  struct: {
    expr: 'str',
    control: e => `${e}.b`,
  },
};

g.test('invalid_types')
  .desc(
    `
  Validates that short-circuiting expressions are never accepted for non-scalar and non-vector types.
  `
  )
  .params(u =>
    u
      .combine('op', ['&&', '||'])
      .combine('type', keysOf(kInvalidTypes))
      .combine('control', [true, false])
      .beginSubcases()
  )
  .fn(t => {
    const type = kInvalidTypes[t.params.type];
    const expr = t.params.control ? type.control(type.expr) : type.expr;
    const code = `
@group(0) @binding(0) var t : texture_2d<f32>;
@group(0) @binding(1) var s : sampler;
@group(0) @binding(2) var<storage, read_write> a : atomic<i32>;

struct S { b : bool }

var<private> b : bool;
var<private> m : mat2x2f;
var<private> arr : array<bool, 4>;
var<private> str : S;

@compute @workgroup_size(1)
fn main() {
  let foo = ${expr} ${t.params.op} ${expr};
}
`;

    t.expectCompileResult(t.params.control, code);
  });

// A list of expressions that are invalid unless guarded by a short-circuiting const-expression.
const kInvalidRhsExpressions: Record<string, string> = {
  overflow: 'i32(1<<31) < 0',
  binary: '(1.0 / 0) == 0',
  builtin: 'sqrt(-1) == 0',
  array_size: 'array<bool, 3 - 4>()[0]',
};

g.test('invalid_rhs')
  .desc(
    `
  Validates that a short-circuiting expression with a const-expression LHS guards the evaluation of its RHS expression.
  `
  )
  .params(u =>
    u
      .combine('op', ['&&', '||'])
      .combine('rhs', keysOf(kInvalidRhsExpressions))
      .combine('skip_rhs', [true, false])
      .beginSubcases()
  )
  .fn(t => {
    const lhs =
      t.params.op === '&&'
        ? t.params.skip_rhs
          ? 'false'
          : 'true'
        : t.params.skip_rhs
        ? 'true'
        : 'false';
    const code = `
@compute @workgroup_size(1)
fn main() {
  let foo = ${lhs} ${t.params.op} ${kInvalidRhsExpressions[t.params.rhs]};
}
`;

    t.expectCompileResult(t.params.skip_rhs, code);
  });
