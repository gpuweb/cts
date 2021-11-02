export const description = `Validation tests for entry point built-in variables`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

import { generateShader } from './util.js';

export const g = makeTestGroup(ShaderValidationTest);

// List of all built-in variables and their stage, in|out usage, and type.
// Taken from table in Section 15:
// https://www.w3.org/TR/2021/WD-WGSL-20211013/#builtin-variables
export const kBuiltins = [
  { name: 'vertex_index', stage: 'vertex', io: 'in', type: 'u32' },
  { name: 'instance_index', stage: 'vertex', io: 'in', type: 'u32' },
  { name: 'position', stage: 'vertex', io: 'out', type: 'vec4<f32>' },
  { name: 'position', stage: 'fragment', io: 'in', type: 'vec4<f32>' },
  { name: 'front_facing', stage: 'fragment', io: 'in', type: 'bool' },
  { name: 'local_invocation_id', stage: 'compute', io: 'in', type: 'vec3<u32>' },
  { name: 'local_invocation_index', stage: 'compute', io: 'in', type: 'u32' },
  { name: 'global_invocation_id', stage: 'compute', io: 'in', type: 'vec3<u32>' },
  { name: 'workgroup_id', stage: 'compute', io: 'in', type: 'vec3<u32>' },
  { name: 'num_workgroups', stage: 'compute', io: 'in', type: 'vec3<u32>' },
  { name: 'sample_index', stage: 'fragment', io: 'in', type: 'u32' },
  { name: 'sample_mask', stage: 'fragment', io: 'in', type: 'u32' },
  { name: 'sample_mask', stage: 'fragment', io: 'out', type: 'u32' },
] as const;

// List of types to test against.
const kTestTypes = [
  'bool',
  'u32',
  'i32',
  'f32',
  'vec2<bool>',
  'vec2<u32>',
  'vec2<i32>',
  'vec2<f32>',
  'vec3<bool>',
  'vec3<u32>',
  'vec3<i32>',
  'vec3<f32>',
  'vec4<bool>',
  'vec4<u32>',
  'vec4<i32>',
  'vec4<f32>',
  'mat2x2<f32>',
  'mat2x3<f32>',
  'mat2x4<f32>',
  'mat3x2<f32>',
  'mat3x3<f32>',
  'mat3x4<f32>',
  'mat4x2<f32>',
  'mat4x3<f32>',
  'mat4x4<f32>',
  'atomic<u32>',
  'atomic<i32>',
  'array<bool,4>',
  'array<u32,4>',
  'array<i32,4>',
  'array<f32,4>',
  'MyStruct',
] as const;

g.test('stage_inout')
  .desc(
    `Test that each [[builtin]] attribute is validated against the required stage and in/out usage for that built-in variable.`
  )
  .params(u =>
    u
      .combineWithParams(kBuiltins)
      .combine('use_struct', [true, false] as const)
      .combine('target_stage', ['vertex', 'fragment', 'compute'] as const)
      .combine('target_io', ['in', 'out'] as const)
      .beginSubcases()
  )
  .fn(t => {
    const code = generateShader({
      attribute: `[[builtin(${t.params.name})]]`,
      type: t.params.type,
      stage: t.params.target_stage,
      io: t.params.target_io,
      use_struct: t.params.use_struct,
    });

    // Expect to pass iff the built-in table contains an entry that matches.
    const expectation = kBuiltins.some(
      x =>
        x.name === t.params.name &&
        x.stage === t.params.target_stage &&
        x.io === t.params.target_io &&
        x.type === t.params.type
    );
    t.expectCompileResult(expectation, code);
  });

g.test('type')
  .desc(
    `Test that each [[builtin]] attribute is validated against the required type of that built-in variable.`
  )
  .params(u =>
    u
      .combineWithParams(kBuiltins)
      .combine('use_struct', [true, false] as const)
      .combine('target_type', kTestTypes)
      .beginSubcases()
  )
  .fn(t => {
    let code = '';

    if (t.params.target_type === 'MyStruct') {
      // Generate a struct that contains the correct built-in type.
      code += 'struct MyStruct {\n';
      code += `  value : ${t.params.type};\n`;
      code += '};\n\n';
    }

    code += generateShader({
      attribute: `[[builtin(${t.params.name})]]`,
      type: t.params.target_type,
      stage: t.params.stage,
      io: t.params.io,
      use_struct: t.params.use_struct,
    });

    // Expect to pass iff the built-in table contains an entry that matches.
    const expectation = kBuiltins.some(
      x =>
        x.name === t.params.name &&
        x.stage === t.params.stage &&
        x.io === t.params.io &&
        x.type === t.params.target_type
    );
    t.expectCompileResult(expectation, code);
  });
