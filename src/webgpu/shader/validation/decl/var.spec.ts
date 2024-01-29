export const description = `
Validation tests for host-shareable types.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { keysOf } from '../../../../common/util/data_tables.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

// The set of types and their properties.
const kTypes = {
  // Scalars.
  bool: {
    isHostShareable: false,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: false,
  },
  i32: {
    isHostShareable: true,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: false,
  },
  u32: {
    isHostShareable: true,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: false,
  },
  f32: {
    isHostShareable: true,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: false,
  },
  f16: {
    isHostShareable: true,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: true,
  },

  // Vectors.
  'vec2<bool>': {
    isHostShareable: false,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: false,
  },
  vec3i: {
    isHostShareable: true,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: false,
  },
  vec4u: {
    isHostShareable: true,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: false,
  },
  vec2f: {
    isHostShareable: true,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: false,
  },
  vec3h: {
    isHostShareable: true,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: true,
  },

  // Matrices.
  mat2x2f: {
    isHostShareable: true,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: false,
  },
  mat3x4h: {
    isHostShareable: true,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: true,
  },

  // Atomics.
  'atomic<i32>': {
    isHostShareable: true,
    isConstructible: false,
    isFixedFootprint: true,
    requiresF16: false,
  },
  'atomic<u32>': {
    isHostShareable: true,
    isConstructible: false,
    isFixedFootprint: true,
    requiresF16: false,
  },

  // Arrays.
  'array<vec4<bool>>': {
    isHostShareable: false,
    isConstructible: false,
    isFixedFootprint: false,
    requiresF16: false,
  },
  'array<vec4<bool>, 4>': {
    isHostShareable: false,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: false,
  },
  'array<vec4u>': {
    isHostShareable: true,
    isConstructible: false,
    isFixedFootprint: false,
    requiresF16: false,
  },
  'array<vec4u, 4>': {
    isHostShareable: true,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: false,
  },
  'array<vec4u, array_size_const>': {
    isHostShareable: true,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: false,
  },
  'array<vec4u, array_size_override>': {
    isHostShareable: false,
    isConstructible: false,
    isFixedFootprint: true,
    requiresF16: false,
  },

  // Structures.
  S_u32: {
    isHostShareable: true,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: false,
  },
  S_bool: {
    isHostShareable: false,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: false,
  },
  S_S_bool: {
    isHostShareable: false,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: false,
  },
  S_array_vec4u: {
    isHostShareable: true,
    isConstructible: false,
    isFixedFootprint: false,
    requiresF16: false,
  },
  S_array_vec4u_4: {
    isHostShareable: true,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: false,
  },
  S_array_bool_4: {
    isHostShareable: false,
    isConstructible: true,
    isFixedFootprint: true,
    requiresF16: false,
  },

  // Misc.
  'ptr<function, u32>': {
    isHostShareable: false,
    isConstructible: false,
    isFixedFootprint: false,
    requiresF16: false,
  },
  sampler: {
    isHostShareable: false,
    isConstructible: false,
    isFixedFootprint: false,
    requiresF16: false,
  },
  'texture_2d<f32>': {
    isHostShareable: false,
    isConstructible: false,
    isFixedFootprint: false,
    requiresF16: false,
  },
};

g.test('module_scope_types')
  .desc('Test that only types that are allowed for a given address space are accepted.')
  .params(u =>
    u
      .combine('type', keysOf(kTypes))
      .combine('kind', [
        'comment',
        'handle',
        'private',
        'storage_ro',
        'storage_rw',
        'uniform',
        'workgroup',
      ])
      .combine('via_alias', [false, true])
  )
  .beforeAllSubcases(t => {
    if (kTypes[t.params.type].requiresF16) {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    const type = kTypes[t.params.type];
    const isAtomic = t.params.type.indexOf('atomic') > -1;

    let decl = '<>';
    let shouldPass = false;
    switch (t.params.kind) {
      case 'comment':
        // Control case to make sure all types are spelled correctly.
        // We always emit an alias to the target type.
        decl = '// ';
        shouldPass = true;
        break;
      case 'handle':
        decl = '@group(0) @binding(0) var foo : ';
        shouldPass = t.params.type.indexOf('texture') > -1 || t.params.type.indexOf('sampler') > -1;
        break;
      case 'private':
        decl = 'var<private> foo : ';
        shouldPass = type.isConstructible;
        break;
      case 'storage_ro':
        decl = '@group(0) @binding(0) var<storage, read> foo : ';
        shouldPass = type.isHostShareable && !isAtomic;
        break;
      case 'storage_rw':
        decl = '@group(0) @binding(0) var<storage, read_write> foo : ';
        shouldPass = type.isHostShareable;
        break;
      case 'uniform':
        decl = '@group(0) @binding(0) var<uniform> foo : ';
        shouldPass = type.isHostShareable && type.isConstructible;
        break;
      case 'workgroup':
        decl = 'var<workgroup> foo : ';
        shouldPass = type.isFixedFootprint;
        break;
    }

    const wgsl = `${type.requiresF16 ? 'enable f16;' : ''}
    const array_size_const = 4;
    override array_size_override = 4;

    struct S_u32 { a : u32 }
    struct S_bool { a : bool }
    struct S_S_bool { a : S_bool }
    struct S_array_vec4u { a : array<u32> }
    struct S_array_vec4u_4 { a : array<vec4u, 4> }
    struct S_array_bool_4 { a : array<bool, 4> }

    alias MyType = ${t.params.type};

    ${decl} ${t.params.via_alias ? 'MyType' : t.params.type};
    `;

    t.expectCompileResult(shouldPass, wgsl);
  });

g.test('function_scope_types')
  .desc('Test that only types that are allowed for a given address space are accepted.')
  .params(u =>
    u
      .combine('type', keysOf(kTypes))
      .combine('kind', ['comment', 'var'])
      .combine('via_alias', [false, true])
  )
  .beforeAllSubcases(t => {
    if (kTypes[t.params.type].requiresF16) {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    const type = kTypes[t.params.type];

    let decl = '<>';
    let shouldPass = false;
    switch (t.params.kind) {
      case 'comment':
        // Control case to make sure all types are spelled correctly.
        // We always emit an alias to the target type.
        decl = '// ';
        shouldPass = true;
        break;
      case 'var':
        decl = 'var foo : ';
        shouldPass = type.isConstructible;
        break;
    }

    const wgsl = `${type.requiresF16 ? 'enable f16;' : ''}
    const array_size_const = 4;
    override array_size_override = 4;

    struct S_u32 { a : u32 }
    struct S_bool { a : bool }
    struct S_S_bool { a : S_bool }
    struct S_array_vec4u { a : array<u32> }
    struct S_array_vec4u_4 { a : array<vec4u, 4> }
    struct S_array_bool_4 { a : array<bool, 4> }

    alias MyType = ${t.params.type};

    fn foo() {
      ${decl} ${t.params.via_alias ? 'MyType' : t.params.type};
    }`;

    t.expectCompileResult(shouldPass, wgsl);
  });

g.test('function_addrspace_at_module_scope')
  .desc('Test that the function address space is not allowed at module scope.')
  .params(u => u.combine('addrspace', ['private', 'function']))
  .fn(t => {
    t.expectCompileResult(
      t.params.addrspace === 'private',
      `var<${t.params.addrspace}> foo : i32;`
    );
  });
