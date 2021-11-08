/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `WGSL execution test. Section: Logical built-in functions Function: select`;import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import {

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
vec4 } from
'../../../util/conversion.js';

import { run } from './builtin.js';

export const g = makeTestGroup(GPUTest);

function makeBool(n) {
  return bool((n & 1) === 1);
}



const dataType = {
  b: {
    type: TypeBool,
    constructor: makeBool },

  f: {
    type: TypeF32,
    constructor: f32 },

  i: {
    type: TypeI32,
    constructor: i32 },

  u: {
    type: TypeU32,
    constructor: u32 } };



g.test('logical_builtin_functions,scalar_select').
uniqueId('50b1f627c11098a1').
specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#logical-builtin-functions').
desc(
`
scalar select:
T is a scalar or a vector select(f:T,t:T,cond: bool): T Returns t when cond is true, and f otherwise. (OpSelect)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('component', ['b', 'f', 'i', 'u']).
combine('overload', ['scalar', 'vec2', 'vec3', 'vec4'])).

fn(async t => {
  const componentType = dataType[t.params.component].type;
  const cons = dataType[t.params.component].constructor;

  const c = [0, 1, 2, 3, 4, 5, 6, 7].map(i => cons(i));
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
      { input: [c[0], c[1], True], expected: c[1] }] },


    vec2: {
      type: TypeVec(2, componentType),
      cases: [
      { input: [v2a, v2b, False], expected: v2a },
      { input: [v2a, v2b, True], expected: v2b }] },


    vec3: {
      type: TypeVec(3, componentType),
      cases: [
      { input: [v3a, v3b, False], expected: v3a },
      { input: [v3a, v3b, True], expected: v3b }] },


    vec4: {
      type: TypeVec(4, componentType),
      cases: [
      { input: [v4a, v4b, False], expected: v4a },
      { input: [v4a, v4b, True], expected: v4b }] } };



  const overload = overloads[t.params.overload];

  run(
  t,
  'select',
  [overload.type, overload.type, TypeBool],
  overload.type,
  t.params,
  overload.cases);

});

g.test('logical_builtin_functions,vector_select').
uniqueId('8b7bb7f58ee1e479').
specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#logical-builtin-functions').
desc(
`
vector select:
T is a scalar select(f: vecN<T>,t: vecN<T>,cond: vecN<bool>) Component-wise selection. Result component i is evaluated as select(f[i],t[i],cond[i]). (OpSelect)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`).

params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3'])).
unimplemented();
//# sourceMappingURL=select.spec.js.map