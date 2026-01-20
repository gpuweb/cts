/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Validation tests for assignment statements.
`;import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { keysOf } from '../../../../common/util/data_tables.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('scalar_assignment').
desc('Test simple scalar assignments.').
fn((t) => {
  const code = `
      @fragment
      fn main() {
        var a: i32 = 0;
        a = 1;
        let b: f32 = 0.0;
        var c: f32;
        c = b;
      }
    `;
  t.expectCompileResult(true, code);
});

g.test('vector_full_assignment').
desc('Test full vector assignments.').
fn((t) => {
  const code = `
      @fragment
      fn main() {
        var v1: vec3<f32> = vec3(0.0, 0.0, 0.0);
        var v2: vec3<f32>;
        v2 = v1;
        v2 = vec3(1.0, 2.0, 3.0);
      }
    `;
  t.expectCompileResult(true, code);
});

g.test('vector_indexed_assignment').
desc('Test vector indexed assignments.').
fn((t) => {
  const code = `
      @fragment
      fn main() {
        var v: vec3<i32> = vec3(0, 0, 0);
        v[0] = 1;
        v[2] = 5;
      }
    `;
  t.expectCompileResult(true, code);
});

const kSwizzleTests = {
  single: {
    src: 'v.x = 1.0',
    pass: true
  },
  multi: {
    src: 'v.xy = vec2(1.0, 2.0)',
    pass: false
  },
  swizzleswizzle: {
    src: 'v.xy.x = 1.0',
    pass: false
  }
};

g.test('vector_swizzle_assignment').
desc('Test vector swizzle assignments.').
params((u) => u.combine('case', keysOf(kSwizzleTests))).
fn((t) => {
  const wgsl = `
      @fragment
      fn main() {
        var v: vec4<f32> = vec4(0.0, 0.0, 0.0, 0.0);
        ${kSwizzleTests[t.params.case].src};
      }`;
  t.expectCompileResult(kSwizzleTests[t.params.case].pass, wgsl);
});
//# sourceMappingURL=assignment_statement.spec.js.map