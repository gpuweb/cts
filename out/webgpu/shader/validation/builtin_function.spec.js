/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = 'builtin functions';import { makeTestGroup } from '../../../common/framework/test_group.js';

import { ShaderValidationTest } from './shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

const kTestTypes = [
'f32',
'i32',
'u32',
'bool',
'vec4<f32>',
'vec4<i32>',
'vec4<u32>',
'vec4<bool>',
'mat4x4<f32>',
// TODO(sarahM0): 12 is a random number here. find a solution to replace it.
'array<f32, 12>',
'array<i32, 12>',
'array<u32, 12>',
'array<bool, 12>'];


g.test('abs').
desc(
`
abs(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = abs(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = [
  'f32',
  'i32',
  'u32',
  'vec2<f32>',
  'vec3<f32>',
  'vec4<f32>',
  'vec2<i32>',
  'vec3<i32>',
  'vec4<i32>',
  'vec2<u32>',
  'vec3<u32>',
  'vec4<u32>'];


  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('acos').
desc(
`
acos(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = acos(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('asin').
desc(
`
asin(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = asin(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('atan').
desc(
`
atan(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = atan(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('atan2').
desc(
`
atan2(e1: T ,e2: T ) -> T
`).

params((u) =>
u.combine('result', kTestTypes).combine('e1T', kTestTypes).combine('e2T', kTestTypes)).

fn(t => {
  const { result, e1T, e2T } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = atan2(${e1T}(), ${e2T}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = e1T;

  // bind expectations to T
  const expecte1 = e1T === T;
  const expecte2 = e2T === T;

  // final expectation
  const expectation = expecte1 && expecte2 && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('ceil').
desc(
`
ceil(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = ceil(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('clamp').
desc(
`
clamp(e1: T ,e2: T ,e3: T) -> T
`).

params((u) =>
u.
combine('result', kTestTypes).
combine('e1T', kTestTypes).
combine('e2T', kTestTypes).
combine('e3T', kTestTypes)).

fn(t => {
  const { result, e1T, e2T, e3T } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = clamp(${e1T}(), ${e2T}(), ${e3T}());
  return vec4<f32>();
}
`;
  // validT
  const validT = [
  'f32',
  'u32',
  'i32',
  'vec2<f32>',
  'vec3<f32>',
  'vec4<f32>',
  'vec2<u32>',
  'vec3<u32>',
  'vec4<u32>',
  'vec2<i32>',
  'vec3<i32>',
  'vec4<i32>'];


  // init T
  const T = e1T;

  // bind expectations to T
  const expecte1 = e1T === T;
  const expecte2 = e2T === T;
  const expecte3 = e3T === T;

  // final expectation
  const expectation =
  expecte1 && expecte2 && expecte3 && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('cos').
desc(
`
cos(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = cos(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('cosh').
desc(
`
cosh(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = cosh(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('exp').
desc(
`
exp(e1: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('e1T', kTestTypes)).
fn(t => {
  const { result, e1T } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = exp(${e1T}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = e1T;

  // bind expectations to T
  const expecte1 = e1T === T;

  // final expectation
  const expectation = expecte1 && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('exp2').
desc(
`
exp2(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = exp2(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('faceForward').
desc(
`
faceForward(e1: T ,e2: T ,e3: T ) -> T
`).

params((u) =>
u.
combine('result', kTestTypes).
combine('e1T', kTestTypes).
combine('e2T', kTestTypes).
combine('e3T', kTestTypes)).

fn(t => {
  const { result, e1T, e2T, e3T } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = faceForward(${e1T}(), ${e2T}(), ${e3T}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = e1T;

  // bind expectations to T
  const expecte1 = e1T === T;
  const expecte2 = e2T === T;
  const expecte3 = e3T === T;

  // final expectation
  const expectation =
  expecte1 && expecte2 && expecte3 && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('floor').
desc(
`
floor(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = floor(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('fma').
desc(
`
fma(e1: T ,e2: T ,e3: T ) -> T
`).

params((u) =>
u.
combine('result', kTestTypes).
combine('e1T', kTestTypes).
combine('e2T', kTestTypes).
combine('e3T', kTestTypes)).

fn(t => {
  const { result, e1T, e2T, e3T } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = fma(${e1T}(), ${e2T}(), ${e3T}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32'];

  // init T
  const T = e1T;

  // bind expectations to T
  const expecte1 = e1T === T;
  const expecte2 = e2T === T;
  const expecte3 = e3T === T;

  // final expectation
  const expectation =
  expecte1 && expecte2 && expecte3 && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('fract').
desc(
`
fract(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = fract(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('inverseSqrt').
desc(
`
inverseSqrt(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = inverseSqrt(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('ldexp').
desc(
`
ldexp(e1: T ,e2: I ) -> T
`).

params((u) =>
u.combine('result', kTestTypes).combine('e1T', kTestTypes).combine('e2I', kTestTypes)).

fn(t => {
  const { result, e1T, e2I } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = ldexp(${e1T}(), ${e2I}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = e1T;
  const I = e2I;

  // bind expectations to T
  const expecte1 = e1T === T;
  const expecte2 = e2I === I;

  // final expectation
  const expectation = expecte1 && expecte2 && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('log').
desc(
`
log(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = log(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('log2').
desc(
`
log2(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = log2(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('max').
desc(
`
max(e1: T ,e2: T ) -> T
`).

params((u) =>
u.combine('result', kTestTypes).combine('e1T', kTestTypes).combine('e2T', kTestTypes)).

fn(t => {
  const { result, e1T, e2T } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = max(${e1T}(), ${e2T}());
  return vec4<f32>();
}
`;
  // validT
  const validT = [
  'f32',
  'u32',
  'i32',
  'vec2<f32>',
  'vec3<f32>',
  'vec4<f32>',
  'vec2<u32>',
  'vec3<u32>',
  'vec4<u32>',
  'vec2<i32>',
  'vec3<i32>',
  'vec4<i32>'];


  // init T
  const T = e1T;

  // bind expectations to T
  const expecte1 = e1T === T;
  const expecte2 = e2T === T;

  // final expectation
  const expectation = expecte1 && expecte2 && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('min').
desc(
`
min(e1: T ,e2: T ) -> T
`).

params((u) =>
u.combine('result', kTestTypes).combine('e1T', kTestTypes).combine('e2T', kTestTypes)).

fn(t => {
  const { result, e1T, e2T } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = min(${e1T}(), ${e2T}());
  return vec4<f32>();
}
`;
  // validT
  const validT = [
  'f32',
  'u32',
  'i32',
  'vec2<f32>',
  'vec3<f32>',
  'vec4<f32>',
  'vec2<u32>',
  'vec3<u32>',
  'vec4<u32>',
  'vec2<i32>',
  'vec3<i32>',
  'vec4<i32>'];


  // init T
  const T = e1T;

  // bind expectations to T
  const expecte1 = e1T === T;
  const expecte2 = e2T === T;

  // final expectation
  const expectation = expecte1 && expecte2 && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('mix').
desc(
`
mix(e1: T ,e2: T ,e3: U) -> T
`).

params((u) =>
u.
combine('result', kTestTypes).
combine('e1T', kTestTypes).
combine('e2T', kTestTypes).
combine('e3U', kTestTypes)).

fn(t => {
  const { result, e1T, e2T, e3U } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = mix(${e1T}(), ${e2T}(), ${e3U}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = e1T;
  const U = e3U;

  // bind expectations to T
  const expecte1 = e1T === T;
  const expecte2 = e2T === T;
  const expecte3 = e3U === U;

  // final expectation
  const expectation =
  expecte1 && expecte2 && expecte3 && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('pow').
desc(
`
pow(e1: T ,e2: T ) -> T
`).

params((u) =>
u.combine('result', kTestTypes).combine('e1T', kTestTypes).combine('e2T', kTestTypes)).

fn(t => {
  const { result, e1T, e2T } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = pow(${e1T}(), ${e2T}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = e1T;

  // bind expectations to T
  const expecte1 = e1T === T;
  const expecte2 = e2T === T;

  // final expectation
  const expectation = expecte1 && expecte2 && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('quantizeToF16').
desc(
`
quantizeToF16(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = quantizeToF16(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('reflect').
desc(
`
reflect(e1: T ,e2: T ) -> T
`).

params((u) =>
u.combine('result', kTestTypes).combine('e1T', kTestTypes).combine('e2T', kTestTypes)).

fn(t => {
  const { result, e1T, e2T } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = reflect(${e1T}(), ${e2T}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = e1T;

  // bind expectations to T
  const expecte1 = e1T === T;
  const expecte2 = e2T === T;

  // final expectation
  const expectation = expecte1 && expecte2 && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('refract').
desc(
`
refract(e1: T ,e2: T ,e3: I ) -> T
`).

params((u) =>
u.
combine('result', kTestTypes).
combine('e1T', kTestTypes).
combine('e2T', kTestTypes).
combine('e3I', kTestTypes)).

fn(t => {
  const { result, e1T, e2T, e3I } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = refract(${e1T}(), ${e2T}(), ${e3I}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['vec2<f32>', 'vec3<f32>', 'vec4<f32>I'];

  // init T
  const T = e1T;
  const I = e3I;

  // bind expectations to T
  const expecte1 = e1T === T;
  const expecte2 = e2T === T;
  const expecte3 = e3I === I;

  // final expectation
  const expectation =
  expecte1 && expecte2 && expecte3 && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('round').
desc(
`
round(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = round(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('sign').
desc(
`
sign(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = sign(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('sin').
desc(
`
sin(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = sin(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('sinh').
desc(
`
sinh(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = sinh(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('smoothStep').
desc(
`
smoothStep(e1: T ,e2: T ,e3: T ) -> T
`).

params((u) =>
u.
combine('result', kTestTypes).
combine('e1T', kTestTypes).
combine('e2T', kTestTypes).
combine('e3T', kTestTypes)).

fn(t => {
  const { result, e1T, e2T, e3T } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = smoothStep(${e1T}(), ${e2T}(), ${e3T}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = e1T;

  // bind expectations to T
  const expecte1 = e1T === T;
  const expecte2 = e2T === T;
  const expecte3 = e3T === T;

  // final expectation
  const expectation =
  expecte1 && expecte2 && expecte3 && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('sqrt').
desc(
`
sqrt(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = sqrt(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('step').
desc(
`
step(e1: T ,e2: T ) -> T
`).

params((u) =>
u.combine('result', kTestTypes).combine('e1T', kTestTypes).combine('e2T', kTestTypes)).

fn(t => {
  const { result, e1T, e2T } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = step(${e1T}(), ${e2T}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = e1T;

  // bind expectations to T
  const expecte1 = e1T === T;
  const expecte2 = e2T === T;

  // final expectation
  const expectation = expecte1 && expecte2 && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('tan').
desc(
`
tan(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = tan(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('tanh').
desc(
`
tanh(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = tanh(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('trunc').
desc(
`
trunc(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = trunc(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('countOneBits').
desc(
`
countOneBits(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = countOneBits(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['i32,'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});

g.test('reverseBits').
desc(
`
reverseBits(e: T ) -> T
`).

params(u => u.combine('result', kTestTypes).combine('eT', kTestTypes)).
fn(t => {
  const { result, eT } = t.params;

  const code = `
[[stage(vertex)]]
fn vertex_main() -> [[builtin(position)]] vec4<f32> {
  var v:${result} = reverseBits(${eT}());
  return vec4<f32>();
}
`;
  // validT
  const validT = ['i32,'];

  // init T
  const T = eT;

  // bind expectations to T
  const expecte = eT === T;

  // final expectation
  const expectation = expecte && result === T && validT.indexOf(result) > -1;
  t.expectCompileResult(expectation, code);
});
//# sourceMappingURL=builtin_function.spec.js.map