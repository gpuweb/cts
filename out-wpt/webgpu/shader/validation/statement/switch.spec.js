/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `Validation tests for 'switch' statements'`;import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { scalarTypeOf, Type } from '../../../util/conversion.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

const kTestTypes = [
'bool',
'i32',
'u32',
'f32',
'f16',
'vec2f',
'vec3h',
'vec4u',
'vec3b',
'mat2x3f',
'mat4x2h',
'abstract-int',
'abstract-float'];


g.test('condition_type').
desc(`Tests that a 'switch' condition must be of an integer type`).
params((u) => u.combine('type', kTestTypes)).
beforeAllSubcases((t) => {
  if (scalarTypeOf(Type[t.params.type]).kind === 'f16') {
    t.selectDeviceOrSkipTestCase('shader-f16');
  }
}).
fn((t) => {
  const type = Type[t.params.type];
  const code = `
${scalarTypeOf(type).kind === 'f16' ? 'enable f16;' : ''}

fn f() -> bool {
  switch ${type.create(1).wgsl()} {
    case 1: {
      return true;
    }
    default: {
      return false;
    }
  }
}
`;

  const pass =
  t.params.type === 'i32' || t.params.type === 'u32' || t.params.type === 'abstract-int';
  t.expectCompileResult(pass, code);
});

g.test('condition_type_match_case_type').
desc(`Tests that a 'switch' condition must have a common type with its case values`).
params((u) =>
u.
combine('cond_type', ['i32', 'u32', 'abstract-int']).
combine('case_type', ['i32', 'u32', 'abstract-int'])
).
fn((t) => {
  const code = `
fn f() -> bool {
switch ${Type[t.params.cond_type].create(1).wgsl()} {
  case ${Type[t.params.case_type].create(2).wgsl()}: {
    return true;
  }
  default: {
    return false;
  }
}
}
`;

  const pass =
  t.params.cond_type === t.params.case_type ||
  t.params.cond_type === 'abstract-int' ||
  t.params.case_type === 'abstract-int';
  t.expectCompileResult(pass, code);
});

g.test('case_types_match').
desc(`Tests that switch case types must have a common type`).
params((u) =>
u.
combine('case_a_type', ['i32', 'u32', 'abstract-int']).
combine('case_b_type', ['i32', 'u32', 'abstract-int'])
).
fn((t) => {
  const code = `
fn f() -> bool {
switch 1 {
  case ${Type[t.params.case_a_type].create(1).wgsl()}: {
    return true;
  }
  case ${Type[t.params.case_b_type].create(2).wgsl()}: {
    return true;
  }
  default: {
    return false;
  }
}
}
`;

  const pass =
  t.params.case_a_type === t.params.case_b_type ||
  t.params.case_a_type === 'abstract-int' ||
  t.params.case_b_type === 'abstract-int';
  t.expectCompileResult(pass, code);
});