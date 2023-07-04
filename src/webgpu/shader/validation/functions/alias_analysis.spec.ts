export const description = `Validation tests for function alias analysis`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { unreachable } from '../../../../common/util/util.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

interface Use {
  use: string;
  is_write: boolean;
}

const kUses = [
  { use: 'no_access', is_write: false },
  { use: 'assign', is_write: true },
  { use: 'compound_assign_lhs', is_write: true },
  { use: 'compound_assign_rhs', is_write: false },
  { use: 'increment', is_write: true },
  { use: 'binary_lhs', is_write: false },
  { use: 'binary_rhs', is_write: false },
  { use: 'unary_minus', is_write: false },
  { use: 'bitcast', is_write: false },
  { use: 'convert', is_write: false },
  { use: 'function_arg', is_write: false },
  { use: 'index_access', is_write: false },
  { use: 'let_init', is_write: false },
  { use: 'var_init', is_write: false },
  { use: 'return', is_write: false },
  { use: 'switch_cond', is_write: false },
];

function generateUse(condition: string, ref: string): string {
  switch (condition) {
    case 'no_access': {
      return `{ let p = &*&${ref}; }`;
    }
    case 'assign': {
      return `${ref} = 42;`;
    }
    case 'increment': {
      return `${ref}++;`;
    }
    case 'compound_assign_lhs': {
      return `${ref} += 1;`;
    }
    case 'compound_assign_rhs': {
      return `{ var tmp : i32; tmp += ${ref}; }`;
    }
    case 'binary_lhs': {
      return `_ = ${ref} + 1;`;
    }
    case 'binary_rhs': {
      return `_ = 1 + ${ref};`;
    }
    case 'unary_minus': {
      return `_ = -${ref};`;
    }
    case 'bitcast': {
      return `_ = bitcast<f32>(${ref});`;
    }
    case 'convert': {
      return `_ = f32(${ref});`;
    }
    case 'function_arg': {
      return `_ = abs(${ref});`;
    }
    case 'index_access': {
      return `{ var arr : array<i32, 4>; _ = arr[${ref}]; }`;
    }
    case 'let_init': {
      return `{ let tmp = ${ref}; }`;
    }
    case 'var_init': {
      return `{ var tmp = ${ref}; }`;
    }
    case 'return': {
      return `{ return ${ref}; }`;
    }
    case 'switch_cond': {
      return `switch(${ref}) { default { break; } }`;
    }
    default: {
      unreachable(`Unhandled usage type`);
    }
  }
}

function shouldPass(aliased: boolean, a_use: Use, b_use: Use): boolean {
  // Expect fail if the pointers are aliased and at least one of the accesses is a write.
  // If either of the accesses is a "no access" then expect pass.
  let should_pass = aliased ? !(a_use.is_write || b_use.is_write) : true;
  should_pass = a_use.use === 'no_access' ? true : should_pass;
  should_pass = b_use.use === 'no_access' ? true : should_pass;
  return should_pass;
}

g.test('two_pointers')
  .desc(`Test aliasing of two pointers passed to a function.`)
  .params(u =>
    u
      .combine('address_space', ['private', 'function'] as const)
      .combine('a_use', kUses)
      .combine('b_use', kUses)
      .combine('aliased', [true, false])
      .beginSubcases()
  )
  .fn(t => {
    const code = `
${t.params.address_space === 'private' ? `var<private> va : i32; var<private> vb : i32;` : ``}

fn callee(pa : ptr<${t.params.address_space}, i32>,
          pb : ptr<${t.params.address_space}, i32>) -> i32 {
  ${generateUse(t.params.a_use.use, `*pa`)}
  ${generateUse(t.params.b_use.use, `*pb`)}
  return 0;
}

fn caller() {
  ${t.params.address_space === 'function' ? `var va : i32; var vb : i32;` : ``}
  callee(&va, ${t.params.aliased ? `&va` : `&vb`});
}
`;
    t.expectCompileResult(shouldPass(t.params.aliased, t.params.a_use, t.params.b_use), code);
  });

g.test('one_pointer_one_module_scope')
  .desc(`Test aliasing of a pointer with a direct access to a module-scope variable.`)
  .params(u =>
    u
      .combine('a_use', kUses)
      .combine('b_use', kUses)
      .combine('aliased', [true, false])
      .beginSubcases()
  )
  .fn(t => {
    const code = `
var<private> va : i32;
var<private> vb : i32;

fn callee(pb : ptr<private, i32>) -> i32 {
  ${generateUse(t.params.a_use.use, `va`)}
  ${generateUse(t.params.b_use.use, `*pb`)}
  return 0;
}

fn caller() {
  callee(${t.params.aliased ? `&va` : `&vb`});
}
`;
    t.expectCompileResult(shouldPass(t.params.aliased, t.params.a_use, t.params.b_use), code);
  });

g.test('subcalls')
  .desc(`Test aliasing of two pointers passed to a function, and then passed to other functions.`)
  .params(u =>
    u
      .combine(
        'a_use',
        kUses.filter(el => ['no_access', 'assign', 'binary_lhs'].includes(el.use))
      )
      .combine(
        'b_use',
        kUses.filter(el => ['no_access', 'assign', 'binary_lhs'].includes(el.use))
      )
      .combine('aliased', [true, false])
      .beginSubcases()
  )
  .fn(t => {
    const code = `
var<private> va : i32;
var<private> vb : i32;

fn subcall_no_access(p : ptr<private, i32>) {
  let pp = &*p;
}

fn subcall_binary_lhs(p : ptr<private, i32>) -> i32 {
  return *p + 1;
}

fn subcall_assign(p : ptr<private, i32>) {
  *p = 42;
}

fn callee(pa : ptr<private, i32>, pb : ptr<private, i32>) -> i32 {
  let new_pa = &*pa;
  let new_pb = &*pb;
  subcall_${t.params.a_use.use}(new_pa);
  subcall_${t.params.b_use.use}(new_pb);
  return 0;
}

fn caller() {
  callee(&va, ${t.params.aliased ? `&va` : `&vb`});
}
`;
    t.expectCompileResult(shouldPass(t.params.aliased, t.params.a_use, t.params.b_use), code);
  });

g.test('member_accessors')
  .desc(`Test aliasing of two pointers passed to a function and used with member accessors.`)
  .params(u =>
    u
      .combine(
        'a_use',
        kUses.filter(el => ['no_access', 'assign', 'binary_lhs'].includes(el.use))
      )
      .combine(
        'b_use',
        kUses.filter(el => ['no_access', 'assign', 'binary_lhs'].includes(el.use))
      )
      .combine('aliased', [true, false])
      .beginSubcases()
  )
  .fn(t => {
    const code = `
struct S { a : i32 }

var<private> va : S;
var<private> vb : S;

fn callee(pa : ptr<private, S>,
          pb : ptr<private, S>) -> i32 {
  ${generateUse(t.params.a_use.use, `(*pa).a`)}
  ${generateUse(t.params.b_use.use, `(*pb).a`)}
  return 0;
}

fn caller() {
  callee(&va, ${t.params.aliased ? `&va` : `&vb`});
}
`;
    t.expectCompileResult(shouldPass(t.params.aliased, t.params.a_use, t.params.b_use), code);
  });

g.test('same_pointer_read_and_write')
  .desc(`Test that we can read from and write to the same pointer.`)
  .params(u => u.beginSubcases())
  .fn(t => {
    const code = `
var<private> v : i32;

fn callee(p : ptr<private, i32>) {
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
  .params(u => u.beginSubcases())
  .fn(t => {
    const code = `
var<private> v : i32;

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
