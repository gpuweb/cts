export const description = `Validation tests for group and binding`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('storage')
  .desc(`Test validation of group and binding on storage resources`)
  .fn(t => {
    const code = `
@group(1) @binding(1)
var<storage> a: i32;

@workgroup_size(1, 1, 1)
@compute fn main() {
  _ = a;
}`;
    t.expectCompileResult(true, code);
  });

g.test('uniform')
  .desc(`Test validation of group and binding on uniform resources`)
  .fn(t => {
    const code = `
@group(1) @binding(1)
var<uniform> a: i32;

@workgroup_size(1, 1, 1)
@compute fn main() {
  _ = a;
}`;
    t.expectCompileResult(true, code);
  });

g.test('texture')
  .desc(`Test validation of group and binding on texture resources`)
  .fn(t => {
    const code = `
@group(1) @binding(1)
var a: texture_2d<f32>;

@workgroup_size(1, 1, 1)
@compute fn main() {
  _ = a;
}`;
    t.expectCompileResult(true, code);
  });

g.test('sampler')
  .desc(`Test validation of group and binding on sampler resources`)
  .fn(t => {
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

g.test('private_module_scope')
  .desc(`Test validation of group and binding on private resources`)
  .fn(t => {
    const code = `
@group(1) @binding(1)
var<private> a: i32;

@workgroup_size(1, 1, 1)
@compute fn main() {
  _ = a;
}`;
    t.expectCompileResult(false, code);
  });

g.test('private_function_scope')
  .desc(`Test validation of group and binding on function-scope private resources`)
  .fn(t => {
    const code = `
@workgroup_size(1, 1, 1)
@compute fn main() {
  @group(1) @binding(1)
  var<private> a: i32;
}`;
    t.expectCompileResult(false, code);
  });

g.test('function_scope')
  .desc(`Test validation of group and binding on function-scope private resources`)
  .fn(t => {
    const code = `
@workgroup_size(1, 1, 1)
@compute fn main() {
  @group(1) @binding(1)
  var a: i32;
}`;
    t.expectCompileResult(false, code);
  });

g.test('function_scope_texture')
  .desc(`Test validation of group and binding on function-scope private resources`)
  .fn(t => {
    const code = `
@workgroup_size(1, 1, 1)
@compute fn main() {
  @group(1) @binding(1)
  var a: texture_2d<f32>;
}`;
    t.expectCompileResult(false, code);
  });
