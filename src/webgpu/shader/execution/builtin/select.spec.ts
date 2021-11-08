export const description = `WGSL execution test. Section: Logical built-in functions Function: select`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import {
  Scalar,
  Vector,
  TypeVec,
  TypeBool,
  TypeF32,
  TypeI32,
  TypeU32,
  f32,
  i32,
  u32,
  False,
  True,
  bool,
  vec2,
  vec3,
  vec4,
} from '../../../util/conversion.js';

import { run } from './builtin.js';

export const g = makeTestGroup(GPUTest);

function makeBool(n: number) {
  return bool((n & 1) === 1);
}

type scalarKind = 'b' | 'f' | 'i' | 'u';

const dataType = {
  b: {
    type: TypeBool,
    constructor: makeBool,
  },
  f: {
    type: TypeF32,
    constructor: f32,
  },
  i: {
    type: TypeI32,
    constructor: i32,
  },
  u: {
    type: TypeU32,
    constructor: u32,
  },
};

g.test('logical_builtin_functions,scalar_select')
  .uniqueId('50b1f627c11098a1')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#logical-builtin-functions')
  .desc(
    `
scalar select:
T is a scalar or a vector select(f:T,t:T,cond: bool): T Returns t when cond is true, and f otherwise. (OpSelect)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('component', ['b', 'f', 'i', 'u'] as const)
      .combine('overload', ['scalar', 'vec2', 'vec3', 'vec4'] as const)
  )
  .fn(async t => {
    const componentType = dataType[t.params.component as scalarKind].type;
    const cons = dataType[t.params.component as scalarKind].constructor;

    const c = [0, 1, 2, 3, 4, 5, 6, 7].map(i => cons(i)) as Scalar[];
    const v2a = vec2(c[0], c[1]);
    const v2b = vec2(c[4], c[5]);
    const v3a = vec3(c[0], c[1], c[2]);
    const v3b = vec3(c[4], c[5], c[6]);
    const v4a = vec4(c[0], c[1], c[2], c[3]);
    const v4b = vec4(c[4], c[5], c[6], c[7]);

    const overloads = {
      scalar: {
        type: componentType,
        cases: [
          { input: [c[0], c[1], False], expected: c[0] },
          { input: [c[0], c[1], True], expected: c[1] },
        ],
      },
      vec2: {
        type: TypeVec(2, componentType),
        cases: [
          { input: [v2a, v2b, False], expected: v2a },
          { input: [v2a, v2b, True], expected: v2b },
        ],
      },
      vec3: {
        type: TypeVec(3, componentType),
        cases: [
          { input: [v3a, v3b, False], expected: v3a },
          { input: [v3a, v3b, True], expected: v3b },
        ],
      },
      vec4: {
        type: TypeVec(4, componentType),
        cases: [
          { input: [v4a, v4b, False], expected: v4a },
          { input: [v4a, v4b, True], expected: v4b },
        ],
      },
    };
    const overload = overloads[t.params.overload];

    run(
      t,
      'select',
      [overload.type, overload.type, TypeBool],
      overload.type,
      t.params,
      overload.cases
    );
  });

g.test('logical_builtin_functions,vector_select')
  .uniqueId('8b7bb7f58ee1e479')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#logical-builtin-functions')
  .desc(
    `
vector select:
T is a scalar select(f: vecN<T>,t: vecN<T>,cond: vecN<bool>) Component-wise selection. Result component i is evaluated as select(f[i],t[i],cond[i]). (OpSelect)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('component', ['b', 'f', 'i', 'u'] as const)
      .combine('overload', ['vec2', 'vec3', 'vec4'] as const)
  )
  .fn(async t => {
    const componentType = dataType[t.params.component as scalarKind].type;
    const cons = dataType[t.params.component as scalarKind].constructor;

    const c = [0, 1, 2, 3, 4, 5, 6, 7].map(i => cons(i)) as Scalar[];
    const T = True;
    const F = False;
    // Form vectors be used for the 'false' and 'true' data operands.
    const FF = vec2(c[0], c[1]);
    const TT = vec2(c[4], c[5]);
    const FFF = vec3(c[0], c[1], c[2]);
    const TTT = vec3(c[4], c[5], c[6]);
    const FFFF = vec4(c[0], c[1], c[2], c[3]);
    const TTTT = vec4(c[4], c[5], c[6], c[7]);

    const pick2 = (a: Vector, b: Vector) => vec2(a.elements[0], b.elements[1]);
    const pick3 = (a: Vector, b: Vector, c: Vector) =>
      vec3(a.elements[0], b.elements[1], c.elements[2]);
    const pick4 = (a: Vector, b: Vector, c: Vector, d: Vector) =>
      vec4(a.elements[0], b.elements[1], c.elements[2], d.elements[3]);

    const overloads = {
      vec2: {
        dataType: TypeVec(2, componentType),
        boolType: TypeVec(2, TypeBool),
        cases: [
          { input: [FF, TT, vec2(F, F)], expected: pick2(FF, FF) },
          { input: [FF, TT, vec2(F, T)], expected: pick2(FF, TT) },
          { input: [FF, TT, vec2(T, F)], expected: pick2(TT, FF) },
          { input: [FF, TT, vec2(T, T)], expected: pick2(TT, TT) },
        ],
      },
      vec3: {
        dataType: TypeVec(3, componentType),
        boolType: TypeVec(3, TypeBool),
        cases: [
          { input: [FFF, TTT, vec3(F, F, F)], expected: pick3(FFF, FFF, FFF) },
          { input: [FFF, TTT, vec3(F, F, T)], expected: pick3(FFF, FFF, TTT) },
          { input: [FFF, TTT, vec3(F, T, F)], expected: pick3(FFF, TTT, FFF) },
          { input: [FFF, TTT, vec3(F, T, T)], expected: pick3(FFF, TTT, TTT) },
          { input: [FFF, TTT, vec3(T, F, F)], expected: pick3(TTT, FFF, FFF) },
          { input: [FFF, TTT, vec3(T, F, T)], expected: pick3(TTT, FFF, TTT) },
          { input: [FFF, TTT, vec3(T, T, F)], expected: pick3(TTT, TTT, FFF) },
          { input: [FFF, TTT, vec3(T, T, T)], expected: pick3(TTT, TTT, TTT) },
        ],
      },
      vec4: {
        dataType: TypeVec(4, componentType),
        boolType: TypeVec(4, TypeBool),
        cases: [
          { input: [FFFF, TTTT, vec4(F, F, F, F)], expected: pick4(FFFF, FFFF, FFFF, FFFF) },
          { input: [FFFF, TTTT, vec4(F, F, F, T)], expected: pick4(FFFF, FFFF, FFFF, TTTT) },
          { input: [FFFF, TTTT, vec4(F, F, T, F)], expected: pick4(FFFF, FFFF, TTTT, FFFF) },
          { input: [FFFF, TTTT, vec4(F, F, T, T)], expected: pick4(FFFF, FFFF, TTTT, TTTT) },
          { input: [FFFF, TTTT, vec4(F, T, F, F)], expected: pick4(FFFF, TTTT, FFFF, FFFF) },
          { input: [FFFF, TTTT, vec4(F, T, F, T)], expected: pick4(FFFF, TTTT, FFFF, TTTT) },
          { input: [FFFF, TTTT, vec4(F, T, T, F)], expected: pick4(FFFF, TTTT, TTTT, FFFF) },
          { input: [FFFF, TTTT, vec4(F, T, T, T)], expected: pick4(FFFF, TTTT, TTTT, TTTT) },
          { input: [FFFF, TTTT, vec4(T, F, F, F)], expected: pick4(TTTT, FFFF, FFFF, FFFF) },
          { input: [FFFF, TTTT, vec4(T, F, F, T)], expected: pick4(TTTT, FFFF, FFFF, TTTT) },
          { input: [FFFF, TTTT, vec4(T, F, T, F)], expected: pick4(TTTT, FFFF, TTTT, FFFF) },
          { input: [FFFF, TTTT, vec4(T, F, T, T)], expected: pick4(TTTT, FFFF, TTTT, TTTT) },
          { input: [FFFF, TTTT, vec4(T, T, F, F)], expected: pick4(TTTT, TTTT, FFFF, FFFF) },
          { input: [FFFF, TTTT, vec4(T, T, F, T)], expected: pick4(TTTT, TTTT, FFFF, TTTT) },
          { input: [FFFF, TTTT, vec4(T, T, T, F)], expected: pick4(TTTT, TTTT, TTTT, FFFF) },
          { input: [FFFF, TTTT, vec4(T, T, T, T)], expected: pick4(TTTT, TTTT, TTTT, TTTT) },
        ],
      },
    };
    const overload = overloads[t.params.overload];

    run(
      t,
      'select',
      [overload.dataType, overload.dataType, overload.boolType],
      overload.dataType,
      t.params,
      overload.cases
    );
  });
