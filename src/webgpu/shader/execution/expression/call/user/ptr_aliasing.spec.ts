export const description = `
Execution tests for aliased pointer parameters.

With the 'unrestricted_aliasing' language feature, pointer arguments passed to a user-declared
function may alias each other (or a module-scope variable accessed by the callee), even when one of
the accesses is a write. These tests check that implementations honour the WGSL memory semantics in
that case, i.e. that no code generation or downstream compiler step assumes that pointer parameters
are non-aliasing.

Every test is run with 'aliased' set to true and false:
 * aliased=false: The pointers refer to distinct memory locations with distinct root identifiers.
   These cases are valid without the 'unrestricted_aliasing' language feature and act as a control
   for the expectations.
 * aliased=true: The pointers refer to overlapping memory locations. These cases require the
   'unrestricted_aliasing' language feature.

Cases that form pointers using runtime indices into the same root variable always require the
'unrestricted_aliasing' language feature, as they cannot be statically proven not to alias.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { keysOf } from '../../../../../../common/util/data_tables.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { kMixedTypeOps, kMixedTypePairs, mixedTypeDecls } from '../builtin/buffer_view_utils.js';

export const g = makeTestGroup(GPUTest);

type AddressSpace = 'function' | 'private' | 'workgroup' | 'storage';

const kAddressSpaces = ['function', 'private', 'workgroup', 'storage'] as const;
const kModuleScopeAddressSpaces = ['private', 'workgroup', 'storage'] as const;
const kAtomicAddressSpaces = ['workgroup', 'storage'] as const;

/**
 * WGSL type declarations shared by all shaders.
 *
 * Data is made entirely of i32 so it has no padding, and its memory layout in i32 units is:
 *   x: 0, y: 1, arr: 2..5, s: 6..9, big: 10..41
 */
const kTypeDecls = `
struct S {
  a : i32,
  b : i32,
  c : i32,
  d : i32,
}

struct Data {
  x : i32,
  y : i32,
  arr : array<i32, 4>,
  s : S,
  big : array<i32, 32>,
}

struct AtomicData {
  x : atomic<i32>,
  y : atomic<i32>,
  arr : array<atomic<i32>, 4>,
}

struct In {
  a : Data,
  b : Data,
  p : array<i32, 8>,
}

struct Out {
  r : array<i32, 4>,
  a : Data,
  b : Data,
}
`;

/** The number of i32s in 'Data'. */
const kDataSize = 42;
/** The offset of 'Data.big' in i32 units. */
const kBig = 10;
/** The number of elements in 'Data.big'. */
const kBigSize = 32;
/** The offset of variable 'B' in the simulated memory. Variable 'A' is at offset 0. */
const kB = kDataSize;
/** The initial contents of variable 'A'. */
const kInitA = Array.from({ length: kDataSize }, (_, i) => 10 + i);
/** The initial contents of variable 'B'. */
const kInitB = Array.from({ length: kDataSize }, (_, i) => 100 + i);
/**
 * The runtime parameters passed to the shader in 'input.p'.
 * Shaders use these to prevent the compiler from constant folding the tests away.
 *  p[0]: 'va' - a value to write.
 *  p[1]: 'vb' - another value to write.
 *  p[2]: 'n'  - a loop count.
 *  p[3]: 'idx' - a runtime index.
 *  p[4]: 'm'  - a long loop count, used to iterate over 'Data.big'. Must be less than kBigSize.
 *  p[5..7]: unused.
 */
const kParams = [1000, 2000, 4, 1, kBigSize - 1, 0, 0, 0];
const [kVA, kVB, kN, kIdx, kM] = kParams;

/** A simulation of the memory of variables 'A' and 'B', and the output results. */
class Memory {
  readonly mem: number[] = [...kInitA, ...kInitB];
  readonly r: number[] = [0, 0, 0, 0];
  ld(ptr: number): number {
    return this.mem[ptr];
  }
  st(ptr: number, value: number) {
    this.mem[ptr] = value | 0;
  }
  /** @returns the expected contents of the 'Out' buffer. */
  expected(): Int32Array {
    return new Int32Array([...this.r, ...this.mem]);
  }
}

/** @returns the WGSL pointer type for a pointer to 'type' in the given address space. */
function ptr(space: AddressSpace, type: string) {
  switch (space) {
    case 'storage':
      return `ptr<storage, ${type}, read_write>`;
    default:
      return `ptr<${space}, ${type}>`;
  }
}

interface ShaderParams {
  /** The address space of variables 'A' and 'B'. */
  space: AddressSpace;
  /** Whether the shader requires the 'unrestricted_aliasing' language feature. */
  requiresAliasing: boolean;
  /** Module-scope helper functions. */
  helpers: string;
  /** The body of the entry point. Runs after 'A' and 'B' are initialized. */
  body: string;
  /** The expected contents of the output buffer. */
  expected: Int32Array;
  /**
   * If true, then 'A' and 'B' are of type 'AtomicData', and 'body' is responsible for initializing
   * them and for writing them to 'output'.
   */
  atomic?: boolean;
  /**
   * If true, then 'A' and 'B' are untyped 'buffer<N>' variables with the same size as 'Data'.
   * They are initialized from, and written to, 'output' through 'bufferView<Data>'.
   * Requires the 'buffer_view' language feature, and 'space' must be 'workgroup' or 'storage'.
   */
  bufferView?: boolean;
}

/**
 * Builds and runs a compute shader that declares two variables 'A' and 'B' in the given address
 * space, initializes them from 'input', runs 'body', then writes 'A' and 'B' to 'output'.
 */
function run(t: GPUTest, params: ShaderParams) {
  t.skipIfLanguageFeatureNotSupported('unrestricted_pointer_parameters');
  //if (params.requiresAliasing) {
  //  t.skipIfLanguageFeatureNotSupported('unrestricted_aliasing');
  //}
  if (params.bufferView) {
    t.skipIfLanguageFeatureNotSupported('buffer_view');
  }

  const varType = params.atomic
    ? 'AtomicData'
    : params.bufferView
    ? `buffer<${kDataSize * 4}>`
    : 'Data';
  let moduleVars = '';
  let functionVars = '';
  switch (params.space) {
    case 'function':
      functionVars = `var A : ${varType};\n  var B : ${varType};`;
      break;
    case 'private':
    case 'workgroup':
      moduleVars = `var<${params.space}> A : ${varType};\nvar<${params.space}> B : ${varType};`;
      break;
    case 'storage':
      moduleVars = `
@group(0) @binding(2) var<storage, read_write> A : ${varType};
@group(0) @binding(3) var<storage, read_write> B : ${varType};`;
      break;
  }

  let init = `A = input.a;\n  B = input.b;`;
  let dump = `output.a = A;\n  output.b = B;`;
  if (params.atomic) {
    init = '';
    dump = '';
  } else if (params.bufferView) {
    init = `*bufferView<Data>(&A, 0u) = input.a;\n  *bufferView<Data>(&B, 0u) = input.b;`;
    dump = `output.a = *bufferView<Data>(&A, 0u);\n  output.b = *bufferView<Data>(&B, 0u);`;
  }

  const code = `
${params.requiresAliasing ? '// requires unrestricted_aliasing;' : ''}

${kTypeDecls}

@group(0) @binding(0) var<storage, read> input : In;
@group(0) @binding(1) var<storage, read_write> output : Out;

${moduleVars}

${params.helpers}

@compute @workgroup_size(1)
fn main() {
  ${functionVars}
  ${init}
  ${params.body}
  ${dump}
}
`;

  const pipeline = t.device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: t.device.createShaderModule({ code }),
      entryPoint: 'main',
    },
  });

  const inputBuffer = t.makeBufferWithContents(
    new Int32Array([...kInitA, ...kInitB, ...kParams]),
    GPUBufferUsage.STORAGE
  );
  const outputBuffer = t.createBufferTracked({
    size: params.expected.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  const entries: GPUBindGroupEntry[] = [
    { binding: 0, resource: { buffer: inputBuffer } },
    { binding: 1, resource: { buffer: outputBuffer } },
  ];
  if (params.space === 'storage') {
    for (const binding of [2, 3]) {
      const buffer = t.createBufferTracked({
        size: kDataSize * 4,
        usage: GPUBufferUsage.STORAGE,
      });
      entries.push({ binding, resource: { buffer } });
    }
  }

  const bindGroup = t.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries,
  });

  const encoder = t.device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(1);
  pass.end();
  t.queue.submit([encoder.finish()]);

  t.expectGPUBufferValuesEqual(outputBuffer, params.expected);
}

/** Scalar i32 memory locations within 'Data' that pointers can be formed to. */
const kScalarTargets = {
  scalar: { wgsl: 'x', offset: 0 },
  array_element: { wgsl: 'arr[1]', offset: 3 },
  struct_member: { wgsl: 's.b', offset: 7 },
};

interface TwoPointerOp {
  /** The body of 'fn f(pa : ptr<i32>, pb : ptr<i32>, va : i32, vb : i32, n : i32) -> i32'. */
  wgsl: string;
  /** Simulates 'f'. */
  sim: (m: Memory, pa: number, pb: number) => number;
}

const kTwoPointerOps: Record<string, TwoPointerOp> = {
  store_store_load: {
    wgsl: `
  *pa = va;
  *pb = vb;
  return *pa;`,
    sim: (m, pa, pb) => {
      m.st(pa, kVA);
      m.st(pb, kVB);
      return m.ld(pa);
    },
  },
  store_load: {
    wgsl: `
  *pa = va;
  return *pb;`,
    sim: (m, pa, pb) => {
      m.st(pa, kVA);
      return m.ld(pb);
    },
  },
  load_store_load: {
    wgsl: `
  let before = *pa;
  *pb = vb;
  return *pa - before;`,
    sim: (m, pa, pb) => {
      const before = m.ld(pa);
      m.st(pb, kVB);
      return m.ld(pa) - before;
    },
  },
  compound_assign: {
    wgsl: `
  *pa += *pb;
  *pa += *pb;
  return *pa;`,
    sim: (m, pa, pb) => {
      m.st(pa, m.ld(pa) + m.ld(pb));
      m.st(pa, m.ld(pa) + m.ld(pb));
      return m.ld(pa);
    },
  },
  increment: {
    wgsl: `
  (*pa)++;
  (*pb)++;
  return *pa;`,
    sim: (m, pa, pb) => {
      m.st(pa, m.ld(pa) + 1);
      m.st(pb, m.ld(pb) + 1);
      return m.ld(pa);
    },
  },
  swap: {
    wgsl: `
  let tmp = *pa;
  *pa = *pb;
  *pb = tmp;
  return *pa;`,
    sim: (m, pa, pb) => {
      const tmp = m.ld(pa);
      m.st(pa, m.ld(pb));
      m.st(pb, tmp);
      return m.ld(pa);
    },
  },
  loop_accumulate: {
    // The load of '*pb' must not be hoisted out of the loop.
    wgsl: `
  for (var i = 0; i < n; i++) {
    *pa += *pb;
  }
  return *pa;`,
    sim: (m, pa, pb) => {
      for (let i = 0; i < kN; i++) {
        m.st(pa, m.ld(pa) + m.ld(pb));
      }
      return m.ld(pa);
    },
  },
  loop_store: {
    // The load of '*pb' must not be hoisted out of the loop.
    wgsl: `
  var sum = 0;
  for (var i = 0; i < n; i++) {
    *pa = i;
    sum += *pb;
  }
  return sum;`,
    sim: (m, pa, pb) => {
      let sum = 0;
      for (let i = 0; i < kN; i++) {
        m.st(pa, i);
        sum += m.ld(pb);
      }
      return sum;
    },
  },
  nested_calls: {
    wgsl: `
  *pa = va;
  store_i32(pb, vb);
  return load_i32(pa);`,
    sim: (m, pa, pb) => {
      m.st(pa, kVA);
      m.st(pb, kVB);
      return m.ld(pa);
    },
  },
  nested_calls_swapped: {
    // Pass the pointers through to another function in the opposite order.
    wgsl: `
  return store_store_load(pb, pa, vb, va);`,
    sim: (m, pa, pb) => {
      m.st(pb, kVB);
      m.st(pa, kVA);
      return m.ld(pb);
    },
  },
  dead_store: {
    // The first store to '*pa' is only dead if '*pb' does not alias '*pa'.
    wgsl: `
  *pa = va;
  let tmp = *pb;
  *pa = vb;
  return tmp;`,
    sim: (m, pa, pb) => {
      m.st(pa, kVA);
      const tmp = m.ld(pb);
      m.st(pa, kVB);
      return tmp;
    },
  },
  dead_store_nested_call: {
    // As 'dead_store', but the intervening read happens in another function.
    wgsl: `
  *pa = va;
  let tmp = load_i32(pb);
  *pa = vb;
  return tmp;`,
    sim: (m, pa, pb) => {
      m.st(pa, kVA);
      const tmp = m.ld(pb);
      m.st(pa, kVB);
      return tmp;
    },
  },
  dead_store_loop: {
    // Each store to '*pa' is overwritten by the next iteration, so only the last is live if '*pb'
    // does not alias '*pa'.
    wgsl: `
  var sum = 0;
  for (var i = 0; i < n; i++) {
    *pa = va + i;
    sum += *pb;
    *pa = vb;
  }
  return sum;`,
    sim: (m, pa, pb) => {
      let sum = 0;
      for (let i = 0; i < kN; i++) {
        m.st(pa, kVA + i);
        sum += m.ld(pb);
        m.st(pa, kVB);
      }
      return sum;
    },
  },
};

g.test('two_pointers')
  .desc(
    `Test that a function with two i32 pointer parameters behaves correctly when both pointers refer
to the same memory location.`
  )
  .params(u =>
    u
      .combine('address_space', kAddressSpaces)
      .combine('target', keysOf(kScalarTargets))
      .combine('aliased', [true, false])
      .beginSubcases()
      .combine('op', keysOf(kTwoPointerOps))
  )
  .fn(t => {
    const space = t.params.address_space;
    const target = kScalarTargets[t.params.target];
    const op = kTwoPointerOps[t.params.op];
    const pi32 = ptr(space, 'i32');

    const pa = 0 + target.offset;
    const pb = (t.params.aliased ? 0 : kB) + target.offset;
    const m = new Memory();
    m.r[0] = op.sim(m, pa, pb);

    run(t, {
      space,
      requiresAliasing: t.params.aliased,
      helpers: `
fn store_i32(p : ${pi32}, v : i32) {
  *p = v;
}

fn load_i32(p : ${pi32}) -> i32 {
  return *p;
}

fn store_store_load(pa : ${pi32}, pb : ${pi32}, va : i32, vb : i32) -> i32 {
  *pa = va;
  *pb = vb;
  return *pa;
}

fn f(pa : ${pi32}, pb : ${pi32}, va : i32, vb : i32, n : i32) -> i32 {
  ${op.wgsl}
}`,
      body: `
  output.r[0] = f(&A.${target.wgsl}, &${t.params.aliased ? 'A' : 'B'}.${target.wgsl},
                  input.p[0], input.p[1], input.p[2]);`,
      expected: m.expected(),
    });
  });

g.test('two_pointers_dynamic_index')
  .desc(
    `Test that a function with two i32 pointer parameters behaves correctly when the pointers are
formed from runtime indices into the same array, and those indices may or may not be equal.

These cases always require the 'unrestricted_aliasing' language feature.`
  )
  .params(u =>
    u
      .combine('address_space', kAddressSpaces)
      .combine('aliased', [true, false])
      .beginSubcases()
      .combine('op', keysOf(kTwoPointerOps))
  )
  .fn(t => {
    const space = t.params.address_space;
    const op = kTwoPointerOps[t.params.op];
    const pi32 = ptr(space, 'i32');

    const kArr = 2;
    const pa = kArr + kIdx;
    const pb = kArr + kIdx + (t.params.aliased ? 0 : 1);
    const m = new Memory();
    m.r[0] = op.sim(m, pa, pb);

    run(t, {
      space,
      requiresAliasing: true,
      helpers: `
fn store_i32(p : ${pi32}, v : i32) {
  *p = v;
}

fn load_i32(p : ${pi32}) -> i32 {
  return *p;
}

fn store_store_load(pa : ${pi32}, pb : ${pi32}, va : i32, vb : i32) -> i32 {
  *pa = va;
  *pb = vb;
  return *pa;
}

fn f(pa : ${pi32}, pb : ${pi32}, va : i32, vb : i32, n : i32) -> i32 {
  ${op.wgsl}
}`,
      body: `
  let i = input.p[3];
  let j = input.p[3] + ${t.params.aliased ? 0 : 1};
  output.r[0] = f(&A.arr[i], &A.arr[j], input.p[0], input.p[1], input.p[2]);`,
      expected: m.expected(),
    });
  });

/** Composite types within 'Data' that pointers can be formed to. */
const kComposites = {
  array: {
    type: 'array<i32, 4>',
    member: 'arr',
    offset: 2,
    access: (i: number | string) => `[${i}]`,
    ctor: (args: string) => `array<i32, 4>(${args})`,
  },
  struct: {
    type: 'S',
    member: 's',
    offset: 6,
    access: (i: number | string) => `.${'abcd'[Number(i)]}`,
    ctor: (args: string) => `S(${args})`,
  },
};
type Composite = (typeof kComposites)[keyof typeof kComposites];

interface CompositeAndElementOp {
  /**
   * The body of 'fn f(pc : ptr<C>, pe : ptr<i32>, va : i32, vb : i32, idx : i32) -> i32', where
   * 'pc' points to a composite and 'pe' points to its element 1 (or the equivalent element of a
   * different variable).
   */
  wgsl: (c: Composite) => string;
  /** Simulates 'f'. */
  sim: (m: Memory, pc: number, pe: number) => number;
}

const kCompositeAndElementOps: Record<string, CompositeAndElementOp> = {
  element_then_whole: {
    wgsl: c => `
  *pe = va;
  *pc = ${c.ctor('vb, vb + 1, vb + 2, vb + 3')};
  return *pe;`,
    sim: (m, pc, pe) => {
      m.st(pe, kVA);
      for (let i = 0; i < 4; i++) {
        m.st(pc + i, kVB + i);
      }
      return m.ld(pe);
    },
  },
  whole_then_element: {
    wgsl: c => `
  *pc = ${c.ctor('vb, vb + 1, vb + 2, vb + 3')};
  *pe = va;
  return (*pc)${c.access(1)};`,
    sim: (m, pc, pe) => {
      for (let i = 0; i < 4; i++) {
        m.st(pc + i, kVB + i);
      }
      m.st(pe, kVA);
      return m.ld(pc + 1);
    },
  },
  element_then_load_whole: {
    wgsl: c => `
  *pe = va;
  let v = *pc;
  return v${c.access(1)};`,
    sim: (m, pc, pe) => {
      m.st(pe, kVA);
      return m.ld(pc + 1);
    },
  },
  sub_element_write: {
    wgsl: c => `
  (*pc)${c === kComposites.array ? '[idx]' : c.access(1)} = va;
  return *pe;`,
    sim: (m, pc, pe) => {
      m.st(pc + kIdx, kVA);
      return m.ld(pe);
    },
  },
  load_whole_modify_store_whole: {
    // The copy 'v' must be taken before the store to '*pe'.
    wgsl: c => `
  var v = *pc;
  *pe = va;
  v${c.access(0)} = v${c.access(1)};
  *pc = v;
  return *pe;`,
    sim: (m, pc, pe) => {
      const v = [0, 1, 2, 3].map(i => m.ld(pc + i));
      m.st(pe, kVA);
      v[0] = v[1];
      for (let i = 0; i < 4; i++) {
        m.st(pc + i, v[i]);
      }
      return m.ld(pe);
    },
  },
};

g.test('composite_and_element')
  .desc(
    `Test that a function taking a pointer to a composite and a pointer to an i32 behaves correctly
when the i32 pointer points to an element of the composite.`
  )
  .params(u =>
    u
      .combine('address_space', kAddressSpaces)
      .combine('composite', keysOf(kComposites))
      .combine('aliased', [true, false])
      .beginSubcases()
      .combine('op', keysOf(kCompositeAndElementOps))
  )
  .fn(t => {
    const space = t.params.address_space;
    const c = kComposites[t.params.composite];
    const op = kCompositeAndElementOps[t.params.op];

    const pc = c.offset;
    const pe = (t.params.aliased ? 0 : kB) + c.offset + 1;
    const m = new Memory();
    m.r[0] = op.sim(m, pc, pe);

    run(t, {
      space,
      requiresAliasing: t.params.aliased,
      helpers: `
fn f(pc : ${ptr(space, c.type)}, pe : ${ptr(space, 'i32')}, va : i32, vb : i32, idx : i32) -> i32 {
  ${op.wgsl(c)}
}`,
      body: `
  output.r[0] = f(&A.${c.member}, &${t.params.aliased ? 'A' : 'B'}.${c.member}${c.access(1)},
                  input.p[0], input.p[1], input.p[3]);`,
      expected: m.expected(),
    });
  });

interface CompositeCopyOp {
  /** The body of 'fn f(pd : ptr<C>, ps : ptr<C>) -> i32'. */
  wgsl: (c: Composite) => string;
  /** Simulates 'f'. */
  sim: (m: Memory, pd: number, ps: number) => number;
}

const kCompositeCopyOps: Record<string, CompositeCopyOp> = {
  reverse_construct: {
    // All loads of '*ps' happen before the store to '*pd'.
    wgsl: c => `
  *pd = ${c.ctor([3, 2, 1, 0].map(i => `(*ps)${c.access(i)}`).join(', '))};
  return (*pd)${c.access(0)};`,
    sim: (m, pd, ps) => {
      const v = [3, 2, 1, 0].map(i => m.ld(ps + i));
      for (let i = 0; i < 4; i++) {
        m.st(pd + i, v[i]);
      }
      return m.ld(pd);
    },
  },
  memberwise_reverse: {
    // Loads and stores are interleaved.
    wgsl: c =>
      [0, 1, 2, 3].map(i => `\n  (*pd)${c.access(i)} = (*ps)${c.access(3 - i)};`).join('') +
      `\n  return (*pd)${c.access(0)};`,
    sim: (m, pd, ps) => {
      for (let i = 0; i < 4; i++) {
        m.st(pd + i, m.ld(ps + 3 - i));
      }
      return m.ld(pd);
    },
  },
  copy_then_modify: {
    wgsl: c => `
  *pd = *ps;
  (*pd)${c.access(0)} += 1;
  return (*ps)${c.access(0)};`,
    sim: (m, pd, ps) => {
      for (let i = 0; i < 4; i++) {
        m.st(pd + i, m.ld(ps + i));
      }
      m.st(pd, m.ld(pd) + 1);
      return m.ld(ps);
    },
  },
};

g.test('composite_copy')
  .desc(
    `Test that a function that copies between two composite pointers behaves correctly when both
pointers refer to the same composite.`
  )
  .params(u =>
    u
      .combine('address_space', kAddressSpaces)
      .combine('composite', keysOf(kComposites))
      .combine('aliased', [true, false])
      .beginSubcases()
      .combine('op', keysOf(kCompositeCopyOps))
  )
  .fn(t => {
    const space = t.params.address_space;
    const c = kComposites[t.params.composite];
    const op = kCompositeCopyOps[t.params.op];
    const pc = ptr(space, c.type);

    const pd = c.offset;
    const ps = (t.params.aliased ? 0 : kB) + c.offset;
    const m = new Memory();
    m.r[0] = op.sim(m, pd, ps);

    run(t, {
      space,
      requiresAliasing: t.params.aliased,
      helpers: `
fn f(pd : ${pc}, ps : ${pc}) -> i32 {
  ${op.wgsl(c)}
}`,
      body: `
  output.r[0] = f(&A.${c.member}, &${t.params.aliased ? 'A' : 'B'}.${c.member});`,
      expected: m.expected(),
    });
  });

interface ModuleScopeOp {
  /**
   * The body of 'fn f(p : ptr<i32>, va : i32, vb : i32, n : i32) -> i32', where 'global' is an
   * expression that directly accesses the module-scope variable 'A'.
   */
  wgsl: (global: string) => string;
  /** Simulates 'f', where 'global' is the offset of the memory accessed by the 'global' expression. */
  sim: (m: Memory, p: number, global: number) => number;
}

const kModuleScopeOps: Record<string, ModuleScopeOp> = {
  ptr_store_global_store_ptr_load: {
    wgsl: g => `
  *p = va;
  ${g} = vb;
  return *p;`,
    sim: (m, p, g) => {
      m.st(p, kVA);
      m.st(g, kVB);
      return m.ld(p);
    },
  },
  global_store_ptr_store_global_load: {
    wgsl: g => `
  ${g} = va;
  *p = vb;
  return ${g};`,
    sim: (m, p, g) => {
      m.st(g, kVA);
      m.st(p, kVB);
      return m.ld(g);
    },
  },
  ptr_store_global_load: {
    wgsl: g => `
  *p = va;
  return ${g};`,
    sim: (m, p, g) => {
      m.st(p, kVA);
      return m.ld(g);
    },
  },
  loop_accumulate: {
    wgsl: g => `
  for (var i = 0; i < n; i++) {
    ${g} += *p;
  }
  return ${g};`,
    sim: (m, p, g) => {
      for (let i = 0; i < kN; i++) {
        m.st(g, m.ld(g) + m.ld(p));
      }
      return m.ld(g);
    },
  },
  whole_global_store: {
    wgsl: _ => `
  *p = va;
  A = input.b;
  return *p;`,
    sim: (m, p, _) => {
      m.st(p, kVA);
      for (let i = 0; i < kDataSize; i++) {
        m.st(i, kInitB[i]);
      }
      return m.ld(p);
    },
  },
};

g.test('one_pointer_one_module_scope')
  .desc(
    `Test that a function with a pointer parameter behaves correctly when the pointer refers to a
module-scope variable that is also directly accessed by the function.`
  )
  .params(u =>
    u
      .combine('address_space', kModuleScopeAddressSpaces)
      .combine('target', keysOf(kScalarTargets))
      .combine('aliased', [true, false])
      .beginSubcases()
      .combine('op', keysOf(kModuleScopeOps))
  )
  .fn(t => {
    const space = t.params.address_space;
    const target = kScalarTargets[t.params.target];
    const op = kModuleScopeOps[t.params.op];

    const p = (t.params.aliased ? 0 : kB) + target.offset;
    const m = new Memory();
    m.r[0] = op.sim(m, p, target.offset);

    run(t, {
      space,
      requiresAliasing: t.params.aliased,
      helpers: `
fn f(p : ${ptr(space, 'i32')}, va : i32, vb : i32, n : i32) -> i32 {
  ${op.wgsl(`A.${target.wgsl}`)}
}`,
      body: `
  output.r[0] = f(&${t.params.aliased ? 'A' : 'B'}.${target.wgsl},
                  input.p[0], input.p[1], input.p[2]);`,
      expected: m.expected(),
    });
  });

interface AtomicOp {
  /** The body of 'fn f(pa : ptr<atomic<i32>>, pb : ptr<atomic<i32>>, va : i32, vb : i32) -> i32'. */
  wgsl: string;
  /** Simulates 'f'. */
  sim: (m: Memory, pa: number, pb: number) => number;
}

const kAtomicOps: Record<string, AtomicOp> = {
  add_add_load: {
    wgsl: `
  atomicAdd(pa, va);
  atomicAdd(pb, vb);
  return atomicLoad(pa);`,
    sim: (m, pa, pb) => {
      m.st(pa, m.ld(pa) + kVA);
      m.st(pb, m.ld(pb) + kVB);
      return m.ld(pa);
    },
  },
  store_exchange: {
    wgsl: `
  atomicStore(pa, va);
  return atomicExchange(pb, vb);`,
    sim: (m, pa, pb) => {
      m.st(pa, kVA);
      const old = m.ld(pb);
      m.st(pb, kVB);
      return old;
    },
  },
  exchange_load: {
    wgsl: `
  let old = atomicExchange(pa, va);
  return old + atomicLoad(pb);`,
    sim: (m, pa, pb) => {
      const old = m.ld(pa);
      m.st(pa, kVA);
      return old + m.ld(pb);
    },
  },
};

/** Atomic i32 memory locations within 'AtomicData' that pointers can be formed to. */
const kAtomicTargets = {
  scalar: { wgsl: 'x', offset: 0 },
  array_element: { wgsl: 'arr[1]', offset: 3 },
};

g.test('two_atomic_pointers')
  .desc(
    `Test that a function with two atomic pointer parameters behaves correctly when both pointers
refer to the same atomic.`
  )
  .params(u =>
    u
      .combine('address_space', kAtomicAddressSpaces)
      .combine('target', keysOf(kAtomicTargets))
      .combine('aliased', [true, false])
      .beginSubcases()
      .combine('op', keysOf(kAtomicOps))
  )
  .fn(t => {
    const space = t.params.address_space;
    const target = kAtomicTargets[t.params.target];
    const op = kAtomicOps[t.params.op];
    const patomic = ptr(space, 'atomic<i32>');

    const pa = target.offset;
    const pb = (t.params.aliased ? 0 : kB) + target.offset;
    const m = new Memory();
    m.r[0] = op.sim(m, pa, pb);
    // 's' is not present in 'AtomicData', so is not written to the output.
    for (const base of [0, kB]) {
      for (let i = 6; i < kDataSize; i++) {
        m.mem[base + i] = 0;
      }
    }

    run(t, {
      space,
      requiresAliasing: t.params.aliased,
      atomic: true,
      helpers: `
fn f(pa : ${patomic}, pb : ${patomic}, va : i32, vb : i32) -> i32 {
  ${op.wgsl}
}`,
      body: `
  atomicStore(&A.x, input.a.x);
  atomicStore(&A.y, input.a.y);
  atomicStore(&B.x, input.b.x);
  atomicStore(&B.y, input.b.y);
  for (var i = 0; i < 4; i++) {
    atomicStore(&A.arr[i], input.a.arr[i]);
    atomicStore(&B.arr[i], input.b.arr[i]);
  }

  output.r[0] = f(&A.${target.wgsl}, &${t.params.aliased ? 'A' : 'B'}.${target.wgsl},
                  input.p[0], input.p[1]);

  output.a.x = atomicLoad(&A.x);
  output.a.y = atomicLoad(&A.y);
  output.b.x = atomicLoad(&B.x);
  output.b.y = atomicLoad(&B.y);
  for (var i = 0; i < 4; i++) {
    output.a.arr[i] = atomicLoad(&A.arr[i]);
    output.b.arr[i] = atomicLoad(&B.arr[i]);
  }`,
      expected: m.expected(),
    });
  });

interface LoopCarriedOp {
  /**
   * The body of 'fn f(pd : ptr<array<i32, 32>>, ps : ptr<array<i32, 32>>, m : i32) -> i32'.
   * When 'pd' and 'ps' alias, each iteration depends on a value written by an earlier iteration,
   * so the loop must not be vectorized as if the arrays were disjoint.
   */
  wgsl: string;
  /** Simulates 'f'. */
  sim: (m: Memory, pd: number, ps: number) => number;
}

const kLoopCarriedOps: Record<string, LoopCarriedOp> = {
  shift_up: {
    // Aliased: ps[0] is propagated to every element.
    wgsl: `
  for (var i = 0; i < m; i++) {
    (*pd)[i + 1] = (*ps)[i];
  }
  return (*pd)[m];`,
    sim: (mem, pd, ps) => {
      for (let i = 0; i < kM; i++) {
        mem.st(pd + i + 1, mem.ld(ps + i));
      }
      return mem.ld(pd + kM);
    },
  },
  shift_up_by_two: {
    // Aliased: a dependence distance of 2, which is less than typical vector widths.
    wgsl: `
  for (var i = 0; i < m - 1; i++) {
    (*pd)[i + 2] = (*ps)[i] * 2;
  }
  return (*pd)[m];`,
    sim: (mem, pd, ps) => {
      for (let i = 0; i < kM - 1; i++) {
        mem.st(pd + i + 2, mem.ld(ps + i) * 2);
      }
      return mem.ld(pd + kM);
    },
  },
  running_sum: {
    // Aliased: a prefix-sum style recurrence.
    wgsl: `
  for (var i = 0; i < m; i++) {
    (*pd)[i + 1] = (*ps)[i] + (*ps)[i + 1];
  }
  return (*pd)[m];`,
    sim: (mem, pd, ps) => {
      for (let i = 0; i < kM; i++) {
        mem.st(pd + i + 1, mem.ld(ps + i) + mem.ld(ps + i + 1));
      }
      return mem.ld(pd + kM);
    },
  },
  reverse: {
    // Aliased: the second half reads values already written by the first half, producing a
    // palindrome rather than a reversal.
    wgsl: `
  for (var i = 0; i <= m; i++) {
    (*pd)[i] = (*ps)[m - i];
  }
  return (*pd)[0];`,
    sim: (mem, pd, ps) => {
      for (let i = 0; i <= kM; i++) {
        mem.st(pd + i, mem.ld(ps + kM - i));
      }
      return mem.ld(pd);
    },
  },
};

g.test('loop_carried_dependence')
  .desc(
    `Test that loops over two array pointers behave correctly when both pointers refer to the same
array, creating a loop-carried dependence. The loop count is a runtime value large enough to make
vectorization attractive.`
  )
  .params(u =>
    u
      .combine('address_space', kAddressSpaces)
      .combine('aliased', [true, false])
      .beginSubcases()
      .combine('op', keysOf(kLoopCarriedOps))
  )
  .fn(t => {
    const space = t.params.address_space;
    const op = kLoopCarriedOps[t.params.op];
    const parr = ptr(space, `array<i32, ${kBigSize}>`);

    const pd = kBig;
    const ps = (t.params.aliased ? 0 : kB) + kBig;
    const m = new Memory();
    m.r[0] = op.sim(m, pd, ps);

    run(t, {
      space,
      requiresAliasing: t.params.aliased,
      helpers: `
fn f(pd : ${parr}, ps : ${parr}, m : i32) -> i32 {
  ${op.wgsl}
}`,
      body: `
  output.r[0] = f(&A.big, &${t.params.aliased ? 'A' : 'B'}.big, input.p[4]);`,
      expected: m.expected(),
    });
  });

/** The f32 value passed as 'vf'. */
const kVF = kVB;

/** Locations in the buffer that the i32 and f32 views are formed at. */
const kBufferViewTargets = {
  scalar: { offset: 0, wgsl: '0u' },
  array_element: { offset: 3, wgsl: '12u' },
  dynamic: { offset: kIdx, wgsl: 'u32(input.p[3]) * 4u' },
};

g.test('buffer_view_mixed_types')
  .desc(
    `Test that a function taking an i32 pointer and an f32 pointer behaves correctly when both are
views of the same bytes of a buffer, formed with bufferView.

Stores are never followed by loads of a different type from the same location except through i32,
so that f32 denormal flushing and NaN canonicalization cannot affect the results.`
  )
  .params(u =>
    u
      .combine('address_space', ['workgroup', 'storage'] as const)
      .combine('target', keysOf(kBufferViewTargets))
      .combine('aliased', [true, false])
      .beginSubcases()
      .combine('op', keysOf(kMixedTypeOps))
  )
  .fn(t => {
    const space = t.params.address_space;
    const target = kBufferViewTargets[t.params.target];
    const op = kMixedTypeOps[t.params.op];

    const pi = target.offset;
    const pf = (t.params.aliased ? 0 : kB) + target.offset;
    const m = new Memory();
    const { int, other } = kMixedTypePairs.i32_f32;
    m.r[0] = op.sim(m, int, other, pi, pf, { va: kVA, vf: kVF, n: kN })[0];

    run(t, {
      space,
      requiresAliasing: t.params.aliased,
      bufferView: true,
      helpers: `
${mixedTypeDecls(int, other)}

fn f(pi : ${ptr(space, 'i32')}, pf : ${ptr(space, 'f32')},
     va : i32, vf : f32, n : i32) -> i32 {
  ${op.wgsl(int, other)}
}`,
      body: `
  output.r[0] = f(bufferView<i32>(&A, ${target.wgsl}),
                  bufferView<f32>(&${t.params.aliased ? 'A' : 'B'}, ${target.wgsl}),
                  input.p[0], f32(input.p[1]), input.p[2]);`,
      expected: m.expected(),
    });
  });
