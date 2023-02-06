export const description = `Validation tests for attributes`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

const kPossibleValues = {
  val: '32',
  expr: '30 + 2',
  override: 'a_override',
  user_func: 'a_func()',
  const_func: 'min(4, 8)',
  const: 'a_const',
};
const kAllowedUsages = {
  align: ['val', 'expr', 'const', 'const_func'],
  binding: ['val', 'expr', 'const', 'const_func'],
  group: ['val', 'expr', 'const', 'const_func'],
  id: ['val', 'expr', 'const', 'const_func'],
  location: ['val', 'expr', 'const', 'const_func'],
  size: ['val', 'expr', 'const', 'const_func'],
  workgroup_size: ['val', 'expr', 'const', 'const_func', 'override'],
};

g.test('expressions')
  .desc(`Tests attributes which allow expressions`)
  .params(u =>
    u
      .combine('value', Object.keys(kPossibleValues) as Array<keyof typeof kPossibleValues>)
      .combine('attribute', Object.keys(kAllowedUsages) as Array<keyof typeof kAllowedUsages>)
  )
  .fn(t => {
    let align = '';
    let b_and_g = '@binding(0) @group(0)';
    let id = '@id(2)';
    let loc = '@location(0)';
    let size = '';
    let wg_size = '@workgroup_size(1)';

    const val = kPossibleValues[t.params.value];
    if (t.params.attribute === 'align') {
      align = `@align(${val})`;
    } else if (t.params.attribute === 'binding') {
      b_and_g = `@binding(${val}) @group(0)`;
    } else if (t.params.attribute === 'group') {
      b_and_g = `@binding(0) @group(${val})`;
    } else if (t.params.attribute === 'id') {
      id = `@id(${val})`;
    } else if (t.params.attribute === 'location') {
      loc = `@location(${val})`;
    } else if (t.params.attribute === 'size') {
      size = `@size(${val})`;
    } else if (t.params.attribute === 'workgroup_size') {
      wg_size = `@workgroup_size(${val}, ${val}, ${val})`;
    }

    const code = `
fn a_func() -> i32 {
    return 4;
}

const a_const = -2 + 10;
override a_override: i32 = 2;

${id} override my_id: i32 = 4;

struct B {
  ${align} ${size} a: i32,
}

${b_and_g}
var<uniform> uniform_buffer: B;

@fragment
fn main() -> ${loc} vec4<f32> {
  return vec4<f32>(.4, .2, .3, .1);
}

@compute
${wg_size}
fn compute_main() {}
`;

    const pass = kAllowedUsages[t.params.attribute].includes(t.params.value);
    t.expectCompileResult(pass, code);
  });
