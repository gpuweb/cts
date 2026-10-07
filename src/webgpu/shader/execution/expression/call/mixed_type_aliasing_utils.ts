/**
 * Utilities for testing that differently typed pointers to overlapping bytes of a buffer, formed
 * with bufferView or bufferArrayView, behave correctly. i.e. that implementations do not apply
 * type-based alias analysis. Used by the bufferView, bufferArrayView and pointer aliasing tests.
 */

import { assert } from '../../../../../common/util/util.js';
import { GPUTest } from '../../../../gpu_test.js';
import { float32ToFloat16Bits } from '../../../../util/conversion.js';

/** @returns the bit pattern of the f32 value 'f' as an i32. */
export function f32Bits(f: number): number {
  return new Int32Array(new Float32Array([f]).buffer)[0];
}

/** The scalar types that may be used by the lanes of a mixed type. */
export type MixedScalar = 'i32' | 'u32' | 'f32' | 'f16';

/** @returns the size in bytes of the scalar type 's'. */
function mixedScalarSize(s: MixedScalar): number {
  return s === 'f16' ? 2 : 4;
}

/** A scalar lane of a mixed type. */
interface MixedLane {
  /** The scalar type of the lane. */
  elem: MixedScalar;
  /** The byte offset of the lane from the start of the value. */
  offset: number;
  /** The WGSL accessor suffix for the lane. e.g. '', '[1]', '.a' or '.v[1]' */
  access: string;
}

/**
 * A scalar, vector or structure type used by the mixed type aliasing tests.
 * A value of the type is treated as a flat list of scalar lanes. Structures may contain padding,
 * which is not part of any lane.
 */
export interface MixedType {
  /** The WGSL type name. */
  name: string;
  /** The size in bytes. This is also the array element stride. */
  size: number;
  /** The alignment in bytes. */
  align: number;
  /** The scalar lanes, in declaration order. */
  lanes: MixedLane[];
  /** Present if the type is a structure. */
  struct?: {
    /** The structure members, with their byte offsets. */
    members: { name: string; type: MixedType; offset: number }[];
  };
}

function scalar(elem: MixedScalar): MixedType {
  const size = mixedScalarSize(elem);
  return { name: elem, size, align: size, lanes: [{ elem, offset: 0, access: '' }] };
}

function vec(n: 2 | 4, elem: MixedScalar): MixedType {
  const size = n * mixedScalarSize(elem);
  const lanes = [...Array(n).keys()].map(k => ({
    elem,
    offset: k * mixedScalarSize(elem),
    access: `[${k}]`,
  }));
  return { name: `vec${n}<${elem}>`, size, align: size, lanes };
}

/** @returns a structure type, laid out with the WGSL layout rules. */
function structType(name: string, members: [string, MixedType][]): MixedType {
  const roundUp = (n: number, k: number) => Math.ceil(n / k) * k;
  let end = 0;
  let align = 1;
  const laidOut = members.map(([memberName, type]) => {
    const offset = roundUp(end, type.align);
    end = offset + type.size;
    align = Math.max(align, type.align);
    return { name: memberName, type, offset };
  });
  const lanes = laidOut.flatMap(m =>
    m.type.lanes.map(l => ({
      elem: l.elem,
      offset: m.offset + l.offset,
      access: `.${m.name}${l.access}`,
    }))
  );
  return { name, size: roundUp(end, align), align, lanes, struct: { members: laidOut } };
}

const kI32 = scalar('i32');
const kU32 = scalar('u32');
const kF32 = scalar('f32');
const kF16 = scalar('f16');
const kVec2I = vec(2, 'i32');
const kVec4I = vec(4, 'i32');
const kVec4U = vec(4, 'u32');
const kVec2F = vec(2, 'f32');
const kVec4F = vec(4, 'f32');
const kVec2H = vec(2, 'f16');
const kVec4H = vec(4, 'f16');
// Structures without padding.
const kStructI = structType('SI', [
  ['a', kI32],
  ['b', kI32],
  ['c', kI32],
  ['d', kI32],
]);
const kStructF = structType('SF', [
  ['a', kF32],
  ['b', kF32],
  ['c', kF32],
  ['d', kF32],
]);
const kStructV = structType('SV', [
  ['v', kVec2I],
  ['s', kI32],
  ['t', kI32],
]);
// Structures with padding.
/** 4 bytes of padding between 'a' and 'b'. */
const kPaddedI = structType('PI', [
  ['a', kI32],
  ['b', kVec2I],
]);
/** 4 bytes of padding between 'a' and 'b'. */
const kPaddedF = structType('PF', [
  ['a', kF32],
  ['b', kVec2F],
]);
/** 4 bytes of trailing padding. */
const kPaddedTrailingF = structType('PT', [
  ['v', kVec2F],
  ['s', kF32],
]);
/** 2 bytes of padding between 'a' and 'b', within the first 4-byte word. */
const kPaddedH = structType('PH', [
  ['a', kF16],
  ['b', kF32],
]);

/** @returns true if the type 't' has any f16 lanes. */
export function mixedTypeUsesF16(t: MixedType): boolean {
  return t.lanes.some(l => l.elem === 'f16');
}

/** @returns the WGSL name of the type 't'. */
export function mixedTypeName(t: MixedType): string {
  return t.name;
}

/** @returns a WGSL constructor expression for a value of type 't', given an expression per lane. */
function mixedTypeCtorFromLanes(t: MixedType, lanes: string[]): string {
  if (t.struct) {
    let next = 0;
    const members = t.struct.members.map(m => {
      const n = m.type.lanes.length;
      const expr = mixedTypeCtorFromLanes(m.type, lanes.slice(next, next + n));
      next += n;
      return expr;
    });
    return `${t.name}(${members.join(', ')})`;
  }
  return t.lanes.length === 1 ? lanes[0] : `${t.name}(${lanes.join(', ')})`;
}

/**
 * @returns a WGSL constructor expression for a value of type 't', where lane 'k' has the value
 * 'base + k', and 'base' is a WGSL scalar expression.
 */
function mixedTypeCtor(t: MixedType, base: string): string {
  const lanes = t.lanes.map(({ elem }, k) =>
    k === 0 ? `${elem}(${base})` : `${elem}(${base}) + ${elem}(${k})`
  );
  return mixedTypeCtorFromLanes(t, lanes);
}

/** @returns the WGSL declarations of the structures used by the types 'types', including nested. */
function mixedTypeStructDecls(types: MixedType[]): string {
  const decls = new Map<string, string>();
  const visit = (t: MixedType) => {
    if (!t.struct || decls.has(t.name)) {
      return;
    }
    t.struct.members.forEach(m => visit(m.type));
    const members = t.struct.members.map(m => `${m.name} : ${m.type.name}`).join(', ');
    decls.set(t.name, `struct ${t.name} { ${members} }`);
  };
  types.forEach(visit);
  return [...decls.values()].join('\n');
}

/**
 * @returns WGSL declarations required by the mixed type ops, where 'int' is the type of the loaded
 * view, and 'other' is the type of the stored view. This declares the structures used by the types
 * and the functions:
 *   'mixed_sub(a, b)' - lane-wise 'a - b'
 *   'mixed_xor(a, b)' - lane-wise 'a ^ b'
 * If either type uses f16, the shader must also 'enable f16;'.
 */
export function mixedTypeDecls(int: MixedType, other: MixedType): string {
  const ty = mixedTypeName(int);
  const laneWise = (name: string, op: string) => {
    if (!int.struct) {
      return `fn ${name}(a : ${ty}, b : ${ty}) -> ${ty} { return a ${op} b; }`;
    }
    const lanes = int.lanes.map(({ access: l }) => `  r${l} = a${l} ${op} b${l};`);
    return `fn ${name}(a : ${ty}, b : ${ty}) -> ${ty} {\n  var r : ${ty};\n${lanes.join(
      '\n'
    )}\n  return r;\n}`;
  };
  return `${mixedTypeStructDecls([int, other])}
${laneWise('mixed_sub', '-')}
${laneWise('mixed_xor', '^')}
`;
}

/**
 * @returns WGSL statements that write each lane of the value 'value' of type 't', as an i32 bit
 * pattern, to consecutive elements of the i32 array 'array'. All lanes of 't' must be 32-bit.
 */
export function mixedTypeWriteLanes(t: MixedType, value: string, array: string): string {
  return t.lanes
    .map(({ access }, k) => `${array}[${k}] = bitcast<i32>(${value}${access});`)
    .join('\n  ');
}

/**
 * The pairs of view types tested.
 * 'int' is a type with only i32 or u32 lanes, and at most 4 lanes. It is the only view that is
 * loaded from, which keeps the expected results exact: float values are never loaded, so denormal
 * flushing and NaN canonicalization cannot affect the results.
 * 'other' is a type that is only stored to.
 */
export const kMixedTypePairs: Record<string, { int: MixedType; other: MixedType }> = {
  // scalar - scalar
  i32_f32: { int: kI32, other: kF32 },
  u32_f32: { int: kU32, other: kF32 },
  i32_i32: { int: kI32, other: kI32 },
  // vector - scalar
  vec2i_f32: { int: kVec2I, other: kF32 },
  vec4i_f32: { int: kVec4I, other: kF32 },
  vec4u_f32: { int: kVec4U, other: kF32 },
  vec4u_u32: { int: kVec4U, other: kU32 },
  // scalar - vector
  i32_vec2f: { int: kI32, other: kVec2F },
  i32_vec4f: { int: kI32, other: kVec4F },
  i32_vec4u: { int: kI32, other: kVec4U },
  i32_vec4i: { int: kI32, other: kVec4I },
  // vector - vector
  vec2i_vec2f: { int: kVec2I, other: kVec2F },
  vec4i_vec4f: { int: kVec4I, other: kVec4F },
  vec4u_vec4f: { int: kVec4U, other: kVec4F },
  vec4i_vec2f: { int: kVec4I, other: kVec2F },
  vec2i_vec4f: { int: kVec2I, other: kVec4F },
  vec4i_vec4u: { int: kVec4I, other: kVec4U },
  vec4i_vec4i: { int: kVec4I, other: kVec4I },
  // struct - scalar
  structi_f32: { int: kStructI, other: kF32 },
  structv_f32: { int: kStructV, other: kF32 },
  i32_structf: { int: kI32, other: kStructF },
  // struct - vector
  structi_vec4f: { int: kStructI, other: kVec4F },
  structi_vec2f: { int: kStructI, other: kVec2F },
  vec4i_structf: { int: kVec4I, other: kStructF },
  // struct - struct
  structi_structf: { int: kStructI, other: kStructF },
  structv_structf: { int: kStructV, other: kStructF },
  // f16. The f16 stores only write part of a 4-byte word.
  i32_f16: { int: kI32, other: kF16 },
  u32_f16: { int: kU32, other: kF16 },
  i32_vec2h: { int: kI32, other: kVec2H },
  i32_vec4h: { int: kI32, other: kVec4H },
  vec4i_f16: { int: kVec4I, other: kF16 },
  vec2i_vec4h: { int: kVec2I, other: kVec4H },
  vec4i_vec4h: { int: kVec4I, other: kVec4H },
  // padded struct. Stores of padded structures must not write the padding.
  paddedi_f32: { int: kPaddedI, other: kF32 },
  paddedi_vec4f: { int: kPaddedI, other: kVec4F },
  i32_paddedf: { int: kI32, other: kPaddedF },
  vec4i_paddedf: { int: kVec4I, other: kPaddedF },
  i32_paddedtf: { int: kI32, other: kPaddedTrailingF },
  vec4i_paddedtf: { int: kVec4I, other: kPaddedTrailingF },
  paddedi_paddedf: { int: kPaddedI, other: kPaddedF },
  paddedi_structf: { int: kPaddedI, other: kStructF },
  structi_paddedf: { int: kStructI, other: kPaddedF },
  // padded struct with f16
  i32_paddedh: { int: kI32, other: kPaddedH },
  vec4i_paddedh: { int: kVec4I, other: kPaddedH },
  paddedi_paddedh: { int: kPaddedI, other: kPaddedH },
};

/**
 * How the two views overlap. Views always start on a 4-byte boundary.
 *  'same_start' - Both views start at the same byte.
 *  'offset'     - The views start at different bytes, and a lane of one view overlaps a lane of
 *                 the other. Not all pairs of types can do this while respecting alignment.
 *  'padding'    - The views overlap, but only lanes of one view overlap padding of the other.
 *                 Only possible for structures with padding.
 */
export const kMixedTypeOverlaps = ['same_start', 'offset', 'padding'] as const;
export type MixedTypeOverlap = (typeof kMixedTypeOverlaps)[number];

/**
 * @returns the word offsets of the 'int' and 'other' views for the given overlap, or undefined if
 * the types cannot be positioned to satisfy the overlap. Word offsets are always at least 4.
 */
export function mixedTypeWords(
  int: MixedType,
  other: MixedType,
  overlap: MixedTypeOverlap
): { intWord: number; otherWord: number } | undefined {
  const lanesOverlap = (a: number, b: number) =>
    int.lanes.some(li =>
      other.lanes.some(lo => {
        const i0 = a * 4 + li.offset;
        const o0 = b * 4 + lo.offset;
        return i0 < o0 + mixedScalarSize(lo.elem) && o0 < i0 + mixedScalarSize(li.elem);
      })
    );
  const viewsOverlap = (a: number, b: number) =>
    a * 4 < b * 4 + other.size && b * 4 < a * 4 + int.size;
  for (let a = 4; a < 12; a++) {
    if ((a * 4) % int.align !== 0) continue;
    for (let b = 4; b < 12; b++) {
      if ((b * 4) % other.align !== 0) continue;
      let ok = false;
      switch (overlap) {
        case 'same_start':
          ok = a === b;
          break;
        case 'offset':
          ok = a !== b && lanesOverlap(a, b);
          break;
        case 'padding':
          ok = viewsOverlap(a, b) && !lanesOverlap(a, b);
          break;
      }
      if (ok) {
        return { intWord: a, otherWord: b };
      }
    }
  }
  return undefined;
}

/** A simulated memory of 4-byte words, used to calculate the expected results of mixed type tests. */
export interface MixedTypeMemory {
  ld(ptr: number): number;
  st(ptr: number, value: number): void;
}

/** The runtime arguments passed to a mixed type op. */
export interface MixedTypeArgs {
  /** A value to write through the 'int' view. Also used as a second value for the 'other' view. */
  va: number;
  /** A value to write through the 'other' view. */
  vf: number;
  /** A loop count. */
  n: number;
}

/**
 * Stores a value of type 't' where lane 'k' is 'base + k', at word 'ptr'.
 * Only the bytes of the lanes are written. Padding is left untouched.
 */
function simStore(m: MixedTypeMemory, t: MixedType, ptr: number, base: number) {
  t.lanes.forEach(({ elem, offset }, k) => {
    const v = base + k;
    const word = ptr + Math.floor(offset / 4);
    switch (elem) {
      case 'i32':
      case 'u32':
        m.st(word, v | 0);
        break;
      case 'f32':
        m.st(word, f32Bits(v));
        break;
      case 'f16': {
        const shift = (offset % 4) * 8;
        const mask = 0xffff << shift;
        m.st(word, (m.ld(word) & ~mask) | ((float32ToFloat16Bits(v) << shift) & mask));
        break;
      }
    }
  });
}

/** @returns the lanes of a value of type 't' at word 'ptr', as i32 bit patterns. */
function simLoad(m: MixedTypeMemory, t: MixedType, ptr: number): number[] {
  return t.lanes.map(({ elem, offset }) => {
    assert(elem === 'i32' || elem === 'u32', 'only integer views are loaded');
    return m.ld(ptr + offset / 4);
  });
}

/**
 * An operation on a pointer 'pi' to an integer type, and a pointer 'pf' to another type, that may
 * refer to overlapping memory. Shaders using these ops must include mixedTypeDecls(int, other).
 */
export interface MixedTypeOp {
  /**
   * @returns a WGSL function body that returns a value of type 'int', and may use:
   *   'pi' - a pointer to 'int'
   *   'pf' - a pointer to 'other'
   *   'va' - an i32 value
   *   'vf' - an f32 value, whose value is exactly representable as an f16
   *   'n'  - an i32 loop count
   */
  wgsl: (int: MixedType, other: MixedType) => string;
  /**
   * Simulates 'wgsl', where 'pi' and 'pf' are word offsets into 'm'.
   * @returns the lanes of the returned value, as i32 bit patterns.
   */
  sim: (
    m: MixedTypeMemory,
    int: MixedType,
    other: MixedType,
    pi: number,
    pf: number,
    args: MixedTypeArgs
  ) => number[];
}

/**
 * Operations that produce different results if an implementation assumes that differently typed
 * pointers do not alias (i.e. applies C/C++ style type-based alias analysis).
 */
export const kMixedTypeOps: Record<string, MixedTypeOp> = {
  int_store_other_store_int_load: {
    wgsl: (int, other) => `
  *pi = ${mixedTypeCtor(int, 'va')};
  *pf = ${mixedTypeCtor(other, 'vf')};
  return *pi;`,
    sim: (m, int, other, pi, pf, { va, vf }) => {
      simStore(m, int, pi, va);
      simStore(m, other, pf, vf);
      return simLoad(m, int, pi);
    },
  },
  other_store_int_load: {
    wgsl: (int, other) => `
  *pf = ${mixedTypeCtor(other, 'vf')};
  return *pi;`,
    sim: (m, int, other, pi, pf, { vf }) => {
      simStore(m, other, pf, vf);
      return simLoad(m, int, pi);
    },
  },
  int_load_other_store_int_load: {
    wgsl: (int, other) => `
  let before = *pi;
  *pf = ${mixedTypeCtor(other, 'vf')};
  return mixed_sub(*pi, before);`,
    sim: (m, int, other, pi, pf, { vf }) => {
      const before = simLoad(m, int, pi);
      simStore(m, other, pf, vf);
      return simLoad(m, int, pi).map((v, k) => (v - before[k]) | 0);
    },
  },
  dead_other_store: {
    // The first store to '*pf' is only dead if '*pi' does not alias '*pf'.
    wgsl: (int, other) => `
  *pf = ${mixedTypeCtor(other, 'vf')};
  let tmp = *pi;
  *pf = ${mixedTypeCtor(other, 'va')};
  return tmp;`,
    sim: (m, int, other, pi, pf, { va, vf }) => {
      simStore(m, other, pf, vf);
      const tmp = simLoad(m, int, pi);
      simStore(m, other, pf, va);
      return tmp;
    },
  },
  loop_other_store_int_load: {
    // The load of '*pi' must not be hoisted out of the loop.
    wgsl: (int, other) => `
  var acc = ${mixedTypeName(int)}();
  for (var i = 0; i < n; i++) {
    *pf = ${mixedTypeCtor(other, 'i')};
    acc = mixed_xor(acc, *pi);
  }
  return acc;`,
    sim: (m, int, other, pi, pf, { n }) => {
      const acc = new Array<number>(int.lanes.length).fill(0);
      for (let i = 0; i < n; i++) {
        simStore(m, other, pf, i);
        simLoad(m, int, pi).forEach((v, k) => {
          acc[k] ^= v;
        });
      }
      return acc;
    },
  },
};

/** The number of 4-byte words in each of the buffers 'A' and 'B' used by runMixedTypeAliasingTest. */
export const kMixedTypeBufferWords = 32;

/**
 * The runtime parameters passed to the shader of runMixedTypeAliasingTest in 'input.p'.
 *  p[0]: 'va'  - an i32 value to write.
 *  p[1]: 'vf'  - an f32 value to write, passed as an i32 and converted to f32.
 *  p[2]: 'n'   - a loop count.
 *  p[3]: 'idx' - a runtime value that views may use to form offsets and indices.
 */
export const kMixedTypeParams = [1000, 2000, 4, 1] as const;

/** The value of 'input.p[3]', which may be used by views to form offsets and indices. */
export const kMixedTypeIdx = kMixedTypeParams[3];

/**
 * The kinds of buffer that the views are formed on:
 *  'workgroup'       - var<workgroup> of type buffer<N>
 *  'storage'         - var<storage, read_write> of type buffer<N>
 *  'storage_unsized' - var<storage, read_write> of type buffer
 */
export const kMixedTypeBuffers = ['workgroup', 'storage', 'storage_unsized'] as const;
export type MixedTypeBuffer = (typeof kMixedTypeBuffers)[number];

interface MixedTypeAliasingParams {
  /** The kind of buffer the views are formed on. */
  buffer: MixedTypeBuffer;
  /** The type of the view that is loaded from. */
  int: MixedType;
  /** The type of the view that is only stored to. */
  other: MixedType;
  /** The word offset of the 'int' view. */
  intWord: number;
  /** The word offset of the 'other' view. */
  otherWord: number;
  /**
   * @returns a WGSL expression for a pointer to a value of type 'type' at word offset 'word' of the
   * buffer variable named 'buffer'. May use 'input.p[3]' as a runtime value.
   */
  view: (type: MixedType, buffer: string, word: number) => string;
  /**
   * If true, the 'other' view is formed in the same buffer as the 'int' view.
   * Otherwise it is formed in a different buffer.
   */
  aliased: boolean;
  /** The operation to perform. */
  op: MixedTypeOp;
  /**
   * If true, the views are formed in the entry point and passed to 'f' as pointer parameters.
   * Otherwise the views are formed within 'f'.
   */
  pointerParams?: boolean;
  /** WGSL directives placed at the start of the shader. */
  directives?: string;
}

/**
 * Runs a test where two differently typed pointers are formed from buffer views and used within a
 * single function, or passed to a function as pointer parameters if 'pointerParams' is true.
 * If 'aliased' is true, then both views refer to the same buffer, otherwise the 'other' view refers
 * to a different buffer.
 *
 * The shader initializes buffers 'A' and 'B' from 'input', calls the op, and writes the lanes of
 * the result of the op, followed by the contents of 'A' and 'B', to 'output'.
 */
export function runMixedTypeAliasingTest(t: GPUTest, params: MixedTypeAliasingParams) {
  t.skipIfLanguageFeatureNotSupported('buffer_view');
  const usesF16 = mixedTypeUsesF16(params.int) || mixedTypeUsesF16(params.other);
  if (usesF16) {
    t.skipIfDeviceDoesNotHaveFeature('shader-f16');
  }

  const N = kMixedTypeBufferWords;
  let decls = '';
  switch (params.buffer) {
    case 'workgroup':
      decls = `var<workgroup> A : buffer<${N * 4}>;\nvar<workgroup> B : buffer<${N * 4}>;`;
      break;
    case 'storage':
      decls = `@group(0) @binding(2) var<storage, read_write> A : buffer<${N * 4}>;
@group(0) @binding(3) var<storage, read_write> B : buffer<${N * 4}>;`;
      break;
    case 'storage_unsized':
      decls = `@group(0) @binding(2) var<storage, read_write> A : buffer;
@group(0) @binding(3) var<storage, read_write> B : buffer;`;
      break;
  }

  const intTy = mixedTypeName(params.int);
  const otherTy = mixedTypeName(params.other);
  const writeResult = mixedTypeWriteLanes(params.int, 'r', 'output.r');
  const viewI = params.view(params.int, 'A', params.intWord);
  const viewF = params.view(params.other, params.aliased ? 'A' : 'B', params.otherWord);
  // Only storage pointers may specify an access mode.
  const ptr = (ty: string) =>
    params.buffer === 'workgroup' ? `ptr<workgroup, ${ty}>` : `ptr<storage, ${ty}, read_write>`;
  let fn = '';
  let call = '';
  if (params.pointerParams) {
    fn = `fn f(pi : ${ptr(intTy)}, pf : ${ptr(otherTy)},
     va : i32, vf : f32, n : i32) -> ${intTy} {
  ${params.op.wgsl(params.int, params.other)}
}`;
    call = `f(${viewI}, ${viewF}, input.p[0], f32(input.p[1]), input.p[2])`;
  } else {
    fn = `fn f(va : i32, vf : f32, n : i32) -> ${intTy} {
  let pi = ${viewI};
  let pf = ${viewF};
  ${params.op.wgsl(params.int, params.other)}
}`;
    call = `f(input.p[0], f32(input.p[1]), input.p[2])`;
  }

  const wgsl = `${params.directives ?? ''}
${usesF16 ? 'enable f16;' : ''}
struct In {
  a : array<i32, ${N}>,
  b : array<i32, ${N}>,
  p : array<i32, 4>,
}

struct Out {
  r : array<i32, 4>,
  a : array<i32, ${N}>,
  b : array<i32, ${N}>,
}

@group(0) @binding(0) var<storage, read> input : In;
@group(0) @binding(1) var<storage, read_write> output : Out;

${decls}

${mixedTypeDecls(params.int, params.other)}

${fn}

@compute @workgroup_size(1)
fn main() {
  *bufferView<array<i32, ${N}>>(&A, 0) = input.a;
  *bufferView<array<i32, ${N}>>(&B, 0) = input.b;
  let r = ${call};
  ${writeResult}
  output.a = *bufferView<array<i32, ${N}>>(&A, 0);
  output.b = *bufferView<array<i32, ${N}>>(&B, 0);
}
`;

  // Simulate the op. 'A' is at word 0, and 'B' is at word N.
  const initA = Array.from({ length: N }, (_, i) => 10 + i);
  const initB = Array.from({ length: N }, (_, i) => 100 + i);
  const mem = [...initA, ...initB];
  const memory: MixedTypeMemory = {
    ld: ptr => mem[ptr],
    st: (ptr, value) => {
      mem[ptr] = value | 0;
    },
  };
  const [va, vf, n] = kMixedTypeParams;
  const pi = params.intWord;
  const pf = (params.aliased ? 0 : N) + params.otherWord;
  const r = params.op.sim(memory, params.int, params.other, pi, pf, { va, vf, n });
  const rOut = [0, 0, 0, 0];
  r.forEach((v, k) => {
    rOut[k] = v;
  });
  const expected = new Int32Array([...rOut, ...mem]);

  const pipeline = t.device.createComputePipeline({
    layout: 'auto',
    compute: { module: t.device.createShaderModule({ code: wgsl }) },
  });

  const inputBuffer = t.makeBufferWithContents(
    new Int32Array([...initA, ...initB, ...kMixedTypeParams]),
    GPUBufferUsage.STORAGE
  );
  const outputBuffer = t.createBufferTracked({
    size: expected.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const entries: GPUBindGroupEntry[] = [
    { binding: 0, resource: { buffer: inputBuffer } },
    { binding: 1, resource: { buffer: outputBuffer } },
  ];
  if (params.buffer !== 'workgroup') {
    for (const binding of [2, 3]) {
      const buffer = t.createBufferTracked({ size: N * 4, usage: GPUBufferUsage.STORAGE });
      entries.push({ binding, resource: { buffer } });
    }
  }
  const bg = t.device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries });

  const encoder = t.device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(1);
  pass.end();
  t.queue.submit([encoder.finish()]);

  t.expectGPUBufferValuesEqual(outputBuffer, expected);
}
