import { params, poptions } from '../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const description = `
WGSL validation tests to test variables.
`;

export const g = makeTestGroup(ShaderValidationTest);

const kSclarType = ['i32', 'f32', 'u32', 'bool'] as const;

// TODO(sarahM0): randomaize rhs_value
const kTypeConstructorExpression = [
  { rhs_type: 'i32', rhs_value: '0' },
  { rhs_type: 'f32', rhs_value: '0.0' },
  { rhs_type: 'u32', rhs_value: '0u' },
  { rhs_type: 'bool', rhs_value: 'false' },
] as const;

g.test('v_0033_scalar')
  .params(params().combine(kTypeConstructorExpression).combine(poptions('lhs_type', kSclarType)))
  .fn(async t => {
    const { lhs_type, rhs_type, rhs_value } = t.params;
    const code = `

    [[stage(vertex)]]
    fn main() -> void {
      var v : ${lhs_type} = ${rhs_type}(${rhs_value});
    }`;
    if (lhs_type === rhs_type) {
      t.expectCompileResult(true, code);
    } else {
      t.expectCompileResult('v-0033', code);
    }
  });

g.test('v_0033_vec2_e1_e2')
  .params(
    params()
      .combine(poptions('lhs_type', kSclarType))
      .combine(poptions('rhs_type', kSclarType))
      .combine(poptions('e1_type', kSclarType))
      .combine(poptions('e2_type', kSclarType))
  )
  .fn(async t => {
    const { lhs_type, rhs_type, e1_type, e2_type } = t.params;
    const code = `

    [[stage(vertex)]]
    fn main() -> void {
      var e1: ${e1_type} = ${e1_type}();
      var e2: ${e2_type} = ${e2_type}();
      var v : vec2<${lhs_type}> = vec2<${rhs_type}>(e1, e2);
    }`;
    if (lhs_type === rhs_type && rhs_type === e1_type && e1_type === e2_type) {
      t.expectCompileResult(true, code);
    } else {
      t.expectCompileResult('v-0033', code);
    }
  });

g.test('v_0033_vec2_e')
  .params(
    params().combine(poptions('lhs_type', kSclarType)).combine(poptions('rhs_type', kSclarType))
  )
  .fn(async t => {
    const { lhs_type, rhs_type } = t.params;
    const code = `

    [[stage(vertex)]]
    fn main() -> void {
      var e : vec2<${rhs_type}> = vec2<${rhs_type}>();
      var v : vec2<${lhs_type}> = e;
    }`;
    if (lhs_type === rhs_type) {
      t.expectCompileResult(true, code);
    } else {
      t.expectCompileResult('v-0033', code);
    }
  });

g.test('v_0033_vec3_e1_e2_e3')
  .params(
    params()
      .combine(poptions('lhs_type', kSclarType))
      .combine(poptions('rhs_type', kSclarType))
      .combine(poptions('e1_type', kSclarType))
      .combine(poptions('e2_type', kSclarType))
      .combine(poptions('e3_type', kSclarType))
  )
  .fn(async t => {
    const { lhs_type, rhs_type, e1_type, e2_type, e3_type } = t.params;
    const code = `

    [[stage(vertex)]]
    fn main() -> void {
      var e1: ${e1_type} = ${e1_type}();
      var e2: ${e2_type} = ${e2_type}();
      var e3: ${e3_type} = ${e3_type}();
      var v : vec3<${lhs_type}> = vec3<${rhs_type}>(e1, e2, e3);
    }`;
    if (
      lhs_type === rhs_type &&
      rhs_type === e1_type &&
      e1_type === e2_type &&
      e2_type === e3_type
    ) {
      t.expectCompileResult(true, code);
    } else {
      t.expectCompileResult('v-0033', code);
    }
  });

g.test('v_0033_vec3_e1_e2')
  .params(
    params()
      .combine(poptions('lhs_type', kSclarType))
      .combine(poptions('rhs_type', kSclarType))
      .combine(poptions('e1_type', kSclarType))
      .combine(poptions('e2_type', kSclarType))
  )
  .fn(async t => {
    const { lhs_type, rhs_type, e1_type, e2_type } = t.params;
    const code = `

    [[stage(vertex)]]
    fn main() -> void {
      var e1: ${e1_type} = ${e1_type}();
      var e2 : vec2<${e2_type}> = vec2<${e2_type}>();
      var v : vec3<${lhs_type}> = vec3<${rhs_type}>(e1, e2);
    }`;
    if (lhs_type === rhs_type && rhs_type === e1_type && e1_type === e2_type) {
      t.expectCompileResult(true, code);
    } else {
      t.expectCompileResult('v-0033', code);
    }
  });

g.test('v_0033_vec3_e2_e1')
  .params(
    params()
      .combine(poptions('lhs_type', kSclarType))
      .combine(poptions('rhs_type', kSclarType))
      .combine(poptions('e1_type', kSclarType))
      .combine(poptions('e2_type', kSclarType))
  )
  .fn(async t => {
    const { lhs_type, rhs_type, e1_type, e2_type } = t.params;
    const code = `

    [[stage(vertex)]]
    fn main() -> void {
      var e1: ${e1_type} = ${e1_type}();
      var e2 : vec2<${e2_type}> = vec2<${e2_type}>();
      var v : vec3<${lhs_type}> = vec3<${rhs_type}>(e2, e1);
    }`;
    if (lhs_type === rhs_type && rhs_type === e1_type && e1_type === e2_type) {
      t.expectCompileResult(true, code);
    } else {
      t.expectCompileResult('v-0033', code);
    }
  });

g.test('v_0033_vec4_e1_e2_e3_e4')
  .params(
    params()
      .combine(poptions('lhs_type', kSclarType))
      .combine(poptions('rhs_type', kSclarType))
      .combine(poptions('e1_type', kSclarType))
      .combine(poptions('e2_type', kSclarType))
      .combine(poptions('e3_type', kSclarType))
      .combine(poptions('e4_type', kSclarType))
  )
  .fn(async t => {
    const { lhs_type, rhs_type, e1_type, e2_type, e3_type, e4_type } = t.params;
    const code = `

    [[stage(vertex)]]
    fn main() -> void {
      var e1: ${e1_type} = ${e1_type}();
      var e2: ${e2_type} = ${e2_type}();
      var e3: ${e3_type} = ${e3_type}();
      var e4: ${e4_type} = ${e4_type}();
      var v : vec4<${lhs_type}> = vec4<${rhs_type}>(e1, e2, e3, e4);
    }`;
    if (
      lhs_type === rhs_type &&
      rhs_type === e1_type &&
      e1_type === e2_type &&
      e2_type === e3_type &&
      e3_type === e4_type
    ) {
      t.expectCompileResult(true, code);
    } else {
      t.expectCompileResult('v-0033', code);
    }
  });
