export const description = `Validation tests for function alias analysis`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { keysOf } from '../../../../common/util/data_tables.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

interface Use {
  is_write: boolean;
  gen: (ref: string) => string;
}

const kUses: Record<string, Use> = {
  no_access: { is_write: false, gen: ref => `{ let p = &*&${ref}; }` },
  assign: { is_write: true, gen: ref => `${ref} = 42;` },
  compound_assign_lhs: { is_write: true, gen: ref => `${ref} += 1;` },
  compound_assign_rhs: { is_write: false, gen: ref => `{ var tmp : i32; tmp += ${ref}; }` },
  increment: { is_write: true, gen: ref => `${ref}++;` },
  binary_lhs: { is_write: false, gen: ref => `_ = ${ref} + 1;` },
  binary_rhs: { is_write: false, gen: ref => `_ = 1 + ${ref};` },
  unary_minus: { is_write: false, gen: ref => `_ = -${ref};` },
  bitcast: { is_write: false, gen: ref => `_ = bitcast<f32>(${ref});` },
  convert: { is_write: false, gen: ref => `_ = f32(${ref});` },
  builtin_arg: { is_write: false, gen: ref => `_ = abs(${ref});` },
  index_access: { is_write: false, gen: ref => `{ var arr : array<i32, 4>; _ = arr[${ref}]; }` },
  let_init: { is_write: false, gen: ref => `{ let tmp = ${ref}; }` },
  var_init: { is_write: false, gen: ref => `{ var tmp = ${ref}; }` },
  return: { is_write: false, gen: ref => `{ return ${ref}; }` },
  switch_cond: { is_write: false, gen: ref => `switch(${ref}) { default { break; } }` },
};

type UseName = keyof typeof kUses;

function shouldPass(aliased: boolean, ...uses: UseName[]): boolean {
  // Expect fail if the pointers are aliased and at least one of the accesses is a write.
  // If either of the accesses is a "no access" then expect pass.
  return !aliased || !uses.some(u => kUses[u].is_write) || uses.includes('no_access');
}

type AddressSpace = 'private' | 'function' | 'storage' | 'uniform' | 'workgroup';

const kWritableAddressSpaces = ['private', 'function', 'storage', 'workgroup'] as const;

function ptr(addressSpace: AddressSpace, type: string) {
  switch (addressSpace) {
    case 'function':
      return `ptr<function, ${type}>`;
    case 'private':
      return `ptr<private, ${type}>`;
    case 'storage':
      return `ptr<storage, ${type}, read_write>`;
    case 'uniform':
      return `ptr<uniform, ${type}>`;
    case 'workgroup':
      return `ptr<workgroup, ${type}>`;
  }
}

function declareModuleScopeVar(
  name: string,
  addressSpace: 'private' | 'storage' | 'uniform' | 'workgroup',
  type: string
) {
  const binding = name === 'x' ? 0 : 1;
  switch (addressSpace) {
    case 'private':
      return `var<private> ${name} : ${type};`;
    case 'storage':
      return `@binding(${binding}) @group(0) var<storage, read_write> ${name} : ${type};`;
    case 'uniform':
      return `@binding(${binding}) @group(0) var<uniform> ${name} : ${type};`;
    case 'workgroup':
      return `var<workgroup> ${name} : ${type};`;
  }
}

function maybeDeclareModuleScopeVar(name: string, addressSpace: AddressSpace, type: string) {
  if (addressSpace === 'function') {
    return '';
  }
  return declareModuleScopeVar(name, addressSpace, type);
}

function maybeDeclareFunctionScopeVar(name: string, addressSpace: AddressSpace, type: string) {
  switch (addressSpace) {
    case 'function':
      return `var ${name} : ${type};`;
    default:
      return ``;
  }
}

/**
 * @returns true if a pointer of the given address space requires the
 * 'unrestricted_pointer_parameters' language feature.
 */
function requiresUnrestrictedPointerParameters(addressSpace: AddressSpace) {
  return addressSpace !== 'function' && addressSpace !== 'private';
}

g.test('two_pointers')
  .desc(`Test aliasing of two pointers passed to a function.`)
  .params(u =>
    u
      .combine('address_space', kWritableAddressSpaces)
      .combine('a_use', keysOf(kUses))
      .combine('b_use', keysOf(kUses))
      .combine('aliased', [true, false])
      .beginSubcases()
  )
  .fn(t => {
    if (requiresUnrestrictedPointerParameters(t.params.address_space)) {
      t.skipIfLanguageFeatureNotSupported('unrestricted_pointer_parameters');
    }

    const code = `
${maybeDeclareModuleScopeVar('x', t.params.address_space, 'i32')}
${maybeDeclareModuleScopeVar('y', t.params.address_space, 'i32')}

fn callee(pa : ${ptr(t.params.address_space, 'i32')},
          pb : ${ptr(t.params.address_space, 'i32')}) -> i32 {
  ${kUses[t.params.a_use].gen(`*pa`)}
  ${kUses[t.params.b_use].gen(`*pb`)}
  return 0;
}

fn caller() {
  ${maybeDeclareFunctionScopeVar('x', t.params.address_space, 'i32')}
  ${maybeDeclareFunctionScopeVar('y', t.params.address_space, 'i32')}
  callee(&x, ${t.params.aliased ? `&x` : `&y`});
}
`;
    t.expectCompileResult(shouldPass(t.params.aliased, t.params.a_use, t.params.b_use), code);
  });

g.test('two_pointers_to_array_elements')
  .desc(`Test aliasing of two array element pointers passed to a function.`)
  .params(u =>
    u
      .combine('address_space', kWritableAddressSpaces)
      .combine('a_use', keysOf(kUses))
      .combine('b_use', keysOf(kUses))
      .combine('index', [0, 1])
      .combine('aliased', [true, false])
      .beginSubcases()
  )
  .fn(t => {
    t.skipIfLanguageFeatureNotSupported('unrestricted_pointer_parameters');

    const code = `
${maybeDeclareModuleScopeVar('x', t.params.address_space, 'array<i32, 4>')}
${maybeDeclareModuleScopeVar('y', t.params.address_space, 'array<i32, 4>')}

fn callee(pa : ${ptr(t.params.address_space, 'i32')},
          pb : ${ptr(t.params.address_space, 'i32')}) -> i32 {
  ${kUses[t.params.a_use].gen(`*pa`)}
  ${kUses[t.params.b_use].gen(`*pb`)}
  return 0;
}

fn caller() {
  ${maybeDeclareFunctionScopeVar('x', t.params.address_space, 'array<i32, 4>')}
  ${maybeDeclareFunctionScopeVar('y', t.params.address_space, 'array<i32, 4>')}
  callee(&x[${t.params.index}], ${t.params.aliased ? `&x[0]` : `&y[0]`});
}
`;
    t.expectCompileResult(shouldPass(t.params.aliased, t.params.a_use, t.params.b_use), code);
  });

g.test('two_pointers_to_array_elements_indirect')
  .desc(
    `Test aliasing of two array pointers passed to a function, which indexes those arrays and then
passes the element pointers to another function.`
  )
  .params(u =>
    u
      .combine('address_space', kWritableAddressSpaces)
      .combine('a_use', keysOf(kUses))
      .combine('b_use', keysOf(kUses))
      .combine('index', [0, 1])
      .combine('aliased', [true, false])
      .beginSubcases()
  )
  .fn(t => {
    t.skipIfLanguageFeatureNotSupported('unrestricted_pointer_parameters');

    const code = `
${maybeDeclareModuleScopeVar('x', t.params.address_space, 'array<i32, 4>')}
${maybeDeclareModuleScopeVar('y', t.params.address_space, 'array<i32, 4>')}

fn callee(pa : ${ptr(t.params.address_space, 'i32')},
          pb : ${ptr(t.params.address_space, 'i32')}) -> i32 {
  ${kUses[t.params.a_use].gen(`*pa`)}
  ${kUses[t.params.b_use].gen(`*pb`)}
  return 0;
}

fn index(pa : ${ptr(t.params.address_space, 'array<i32, 4>')},
         pb : ${ptr(t.params.address_space, 'array<i32, 4>')}) -> i32 {
  return callee(&(*pa)[${t.params.index}], &(*pb)[0]);
}

fn caller() {
  ${maybeDeclareFunctionScopeVar('x', t.params.address_space, 'array<i32, 4>')}
  ${maybeDeclareFunctionScopeVar('y', t.params.address_space, 'array<i32, 4>')}
  index(&x, ${t.params.aliased ? `&x` : `&y`});
}
`;
    t.expectCompileResult(shouldPass(t.params.aliased, t.params.a_use, t.params.b_use), code);
  });

g.test('two_pointers_to_struct_members')
  .desc(`Test aliasing of two struct member pointers passed to a function.`)
  .params(u =>
    u
      .combine('address_space', kWritableAddressSpaces)
      .combine('a_use', keysOf(kUses))
      .combine('b_use', keysOf(kUses))
      .combine('member', ['a', 'b'])
      .combine('aliased', [true, false])
      .beginSubcases()
  )
  .fn(t => {
    t.skipIfLanguageFeatureNotSupported('unrestricted_pointer_parameters');

    const code = `
struct S {
  a : i32,
  b : i32,
}

${maybeDeclareModuleScopeVar('x', t.params.address_space, 'S')}
${maybeDeclareModuleScopeVar('y', t.params.address_space, 'S')}

fn callee(pa : ${ptr(t.params.address_space, 'i32')},
          pb : ${ptr(t.params.address_space, 'i32')}) -> i32 {
  ${kUses[t.params.a_use].gen(`*pa`)}
  ${kUses[t.params.b_use].gen(`*pb`)}
  return 0;
}

fn caller() {
  ${maybeDeclareFunctionScopeVar('x', t.params.address_space, 'S')}
  ${maybeDeclareFunctionScopeVar('y', t.params.address_space, 'S')}
  callee(&x.${t.params.member}, ${t.params.aliased ? `&x.a` : `&y.a`});
}
`;
    t.expectCompileResult(shouldPass(t.params.aliased, t.params.a_use, t.params.b_use), code);
  });

g.test('two_pointers_to_struct_members_indirect')
  .desc(
    `Test aliasing of two structure pointers passed to a function, which accesses members of those
structures and then passes the member pointers to another function.`
  )
  .params(u =>
    u
      .combine('address_space', kWritableAddressSpaces)
      .combine('a_use', keysOf(kUses))
      .combine('b_use', keysOf(kUses))
      .combine('member', ['a', 'b'])
      .combine('aliased', [true, false])
      .beginSubcases()
  )
  .fn(t => {
    t.skipIfLanguageFeatureNotSupported('unrestricted_pointer_parameters');

    const code = `
struct S {
  a : i32,
  b : i32,
}

${maybeDeclareModuleScopeVar('x', t.params.address_space, 'S')}
${maybeDeclareModuleScopeVar('y', t.params.address_space, 'S')}

fn callee(pa : ${ptr(t.params.address_space, 'i32')},
          pb : ${ptr(t.params.address_space, 'i32')}) -> i32 {
  ${kUses[t.params.a_use].gen(`*pa`)}
  ${kUses[t.params.b_use].gen(`*pb`)}
  return 0;
}

fn access(pa : ${ptr(t.params.address_space, 'S')},
          pb : ${ptr(t.params.address_space, 'S')}) -> i32 {
  return callee(&(*pa).${t.params.member}, &(*pb).a);
}

fn caller() {
  ${maybeDeclareFunctionScopeVar('x', t.params.address_space, 'S')}
  ${maybeDeclareFunctionScopeVar('y', t.params.address_space, 'S')}
  access(&x, ${t.params.aliased ? `&x` : `&y`});
}
`;
    t.expectCompileResult(shouldPass(t.params.aliased, t.params.a_use, t.params.b_use), code);
  });

g.test('one_pointer_one_module_scope')
  .desc(`Test aliasing of a pointer with a direct access to a module-scope variable.`)
  .params(u =>
    u
      .combine('address_space', ['private', 'storage', 'workgroup'] as const)
      .combine('a_use', keysOf(kUses))
      .combine('b_use', keysOf(kUses))
      .combine('aliased', [true, false])
      .beginSubcases()
  )
  .fn(t => {
    if (requiresUnrestrictedPointerParameters(t.params.address_space)) {
      t.skipIfLanguageFeatureNotSupported('unrestricted_pointer_parameters');
    }

    const code = `
${declareModuleScopeVar('x', t.params.address_space, 'i32')}
${declareModuleScopeVar('y', t.params.address_space, 'i32')}

fn callee(pb : ${ptr(t.params.address_space, 'i32')}) -> i32 {
  ${kUses[t.params.a_use].gen(`x`)}
  ${kUses[t.params.b_use].gen(`*pb`)}
  return 0;
}

fn caller() {
  callee(${t.params.aliased ? `&x` : `&y`});
}
`;
    t.expectCompileResult(shouldPass(t.params.aliased, t.params.a_use, t.params.b_use), code);
  });

g.test('subcalls')
  .desc(`Test aliasing of two pointers passed to a function, and then passed to other functions.`)
  .params(u =>
    u
      .combine('address_space', ['private', 'storage', 'workgroup'] as const)
      .combine('a_use', ['no_access', 'assign', 'binary_lhs'] as UseName[])
      .combine('b_use', ['no_access', 'assign', 'binary_lhs'] as UseName[])
      .combine('aliased', [true, false])
      .beginSubcases()
  )
  .fn(t => {
    if (requiresUnrestrictedPointerParameters(t.params.address_space)) {
      t.skipIfLanguageFeatureNotSupported('unrestricted_pointer_parameters');
    }
    const ptr_i32 = ptr(t.params.address_space, 'i32');
    const code = `
${declareModuleScopeVar('x', t.params.address_space, 'i32')}
${declareModuleScopeVar('y', t.params.address_space, 'i32')}

fn subcall_no_access(p : ${ptr_i32}) {
  let pp = &*p;
}

fn subcall_binary_lhs(p : ${ptr_i32}) -> i32 {
  return *p + 1;
}

fn subcall_assign(p : ${ptr_i32}) {
  *p = 42;
}

fn callee(pa : ${ptr_i32}, pb : ${ptr_i32}) -> i32 {
  let new_pa = &*pa;
  let new_pb = &*pb;
  subcall_${t.params.a_use}(new_pa);
  subcall_${t.params.b_use}(new_pb);
  return 0;
}

fn caller() {
  callee(&x, ${t.params.aliased ? `&x` : `&y`});
}
`;
    t.expectCompileResult(shouldPass(t.params.aliased, t.params.a_use, t.params.b_use), code);
  });

g.test('member_accessors')
  .desc(`Test aliasing of two pointers passed to a function and used with member accessors.`)
  .params(u =>
    u
      .combine('address_space', ['private', 'storage', 'workgroup'] as const)
      .combine('a_use', ['no_access', 'assign', 'binary_lhs'] as UseName[])
      .combine('b_use', ['no_access', 'assign', 'binary_lhs'] as UseName[])
      .combine('aliased', [true, false])
      .beginSubcases()
  )
  .fn(t => {
    if (requiresUnrestrictedPointerParameters(t.params.address_space)) {
      t.skipIfLanguageFeatureNotSupported('unrestricted_pointer_parameters');
    }

    const ptr_S = ptr(t.params.address_space, 'S');
    const code = `
struct S { a : i32 }

${declareModuleScopeVar('x', t.params.address_space, 'S')}
${declareModuleScopeVar('y', t.params.address_space, 'S')}

fn callee(pa : ${ptr_S}, pb : ${ptr_S}) -> i32 {
  ${kUses[t.params.a_use].gen(`(*pa).a`)}
  ${kUses[t.params.b_use].gen(`(*pb).a`)}
  return 0;
}

fn caller() {
  callee(&x, ${t.params.aliased ? `&x` : `&y`});
}
`;
    t.expectCompileResult(shouldPass(t.params.aliased, t.params.a_use, t.params.b_use), code);
  });

g.test('same_pointer_read_and_write')
  .desc(`Test that we can read from and write to the same pointer.`)
  .params(u =>
    u.combine('address_space', ['private', 'storage', 'workgroup'] as const).beginSubcases()
  )
  .fn(t => {
    if (requiresUnrestrictedPointerParameters(t.params.address_space)) {
      t.skipIfLanguageFeatureNotSupported('unrestricted_pointer_parameters');
    }

    const code = `
${declareModuleScopeVar('v', t.params.address_space, 'i32')}

fn callee(p : ${ptr(t.params.address_space, 'i32')}) {
  *p = *p + 1;
}

fn caller() {
  callee(&v);
}
`;
    t.expectCompileResult(true, code);
  });

g.test('aliasing_inside_function')
  .desc(`Test that we can alias pointers inside a function.`)
  .params(u =>
    u.combine('address_space', ['private', 'storage', 'workgroup'] as const).beginSubcases()
  )
  .fn(t => {
    const code = `
${declareModuleScopeVar('v', t.params.address_space, 'i32')}

fn foo() {
  var v : i32;
  let p1 = &v;
  let p2 = &v;
  *p1 = 42;
  *p2 = 42;
}
`;
    t.expectCompileResult(true, code);
  });
