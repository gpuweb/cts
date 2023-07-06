/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `Validation tests for group and binding`;import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { keysOf } from '../../../../common/util/data_tables.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('storage').
desc(`Test validation of group and binding on storage resources`).
fn((t) => {
  const code = `
@group(1) @binding(1)
var<storage> a: i32;

@workgroup_size(1, 1, 1)
@compute fn main() {
  _ = a;
}`;
  t.expectCompileResult(true, code);
});

g.test('uniform').
desc(`Test validation of group and binding on uniform resources`).
fn((t) => {
  const code = `
@group(1) @binding(1)
var<uniform> a: i32;

@workgroup_size(1, 1, 1)
@compute fn main() {
  _ = a;
}`;
  t.expectCompileResult(true, code);
});

g.test('texture').
desc(`Test validation of group and binding on texture resources`).
fn((t) => {
  const code = `
@group(1) @binding(1)
var a: texture_2d<f32>;

@workgroup_size(1, 1, 1)
@compute fn main() {
  _ = a;
}`;
  t.expectCompileResult(true, code);
});

g.test('sampler').
desc(`Test validation of group and binding on sampler resources`).
fn((t) => {
  const code = `
@group(1) @binding(1)
var a: sampler;

@group(0) @binding(2)
var b: sampler_comparison;

@workgroup_size(1, 1, 1)
@compute fn main() {
  _ = a;
  _ = b;
}`;
  t.expectCompileResult(true, code);
});

const kRequiredSettingTests = {
  storage: {
    space: '<storage>',
    kind: 'i32',
    pass: false
  },
  uniform: {
    space: '<uniform>',
    kind: 'i32',
    pass: false
  },
  handle_tex: {
    space: '',
    kind: 'texture_2d<f32>',
    pass: false
  },
  handle_sampler: {
    space: '',
    kind: 'sampler',
    pass: false
  },
  none: {
    space: '<private>',
    kind: 'i32',
    pass: true
  }
};

g.test('required_group_and_binding').
desc(`Test validation of group and binding missing on required address spaces`).
params((u) => u.combine('attr', keysOf(kRequiredSettingTests))).
fn((t) => {
  const data = kRequiredSettingTests[t.params.attr];

  const code = `
var${data.space} a: ${data.kind};

@workgroup_size(1, 1, 1)
@compute fn main() {
  _ = a;
}`;
  t.expectCompileResult(data.pass, code);
});

g.test('private_module_scope').
desc(`Test validation of group and binding on private resources`).
fn((t) => {
  const code = `
@group(1) @binding(1)
var<private> a: i32;

@workgroup_size(1, 1, 1)
@compute fn main() {
  _ = a;
}`;
  t.expectCompileResult(false, code);
});

g.test('private_function_scope').
desc(`Test validation of group and binding on function-scope private resources`).
fn((t) => {
  const code = `
@workgroup_size(1, 1, 1)
@compute fn main() {
  @group(1) @binding(1)
  var<private> a: i32;
}`;
  t.expectCompileResult(false, code);
});

g.test('function_scope').
desc(`Test validation of group and binding on function-scope private resources`).
fn((t) => {
  const code = `
@workgroup_size(1, 1, 1)
@compute fn main() {
  @group(1) @binding(1)
  var a: i32;
}`;
  t.expectCompileResult(false, code);
});

g.test('function_scope_texture').
desc(`Test validation of group and binding on function-scope private resources`).
fn((t) => {
  const code = `
@workgroup_size(1, 1, 1)
@compute fn main() {
  @group(1) @binding(1)
  var a: texture_2d<f32>;
}`;
  t.expectCompileResult(false, code);
});

g.test('duplicate_group_binding_same_entry_point').
desc(
`Test validation of group and binding when same values set on a var used in the same entry point`).

params((u) => u.combine('group', [1, 2])).
fn((t) => {
  const code = `
@group(${t.params.group}) @binding(1) var a: texture_2d<f32>;
@group(1) @binding(1) var<storage> b: i32;

@workgroup_size(1, 1, 1)
@compute fn main() {
  _ = a;
  _ = b;
}`;
  t.expectCompileResult(`${t.params.group}` === '2', code);
});

g.test('duplicate_group_binding_different_entry_point').
desc(
`Test validation of group and binding when same values set on a var used in different entry points`).

fn((t) => {
  const code = `
@group(1) @binding(1) var a: texture_2d<f32>;
@group(1) @binding(1) var b: sampler;

@workgroup_size(1, 1, 1)
@compute fn main_a() {
  _ = a;
}

@workgroup_size(1, 1, 1)
@compute fn main_b() {
  _ = b;
}`;
  t.expectCompileResult(true, code);
});
//# sourceMappingURL=group_and_binding.spec.js.map