export const description = `
Execution tests for the 'all' builtin function
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import {
  False,
  True,
  TypeBool,
  TypeVec,
  vec2,
  vec3,
  vec4,
} from '../../../../../util/conversion.js';
import { run } from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('bool')
  .specURL('https://www.w3.org/TR/WGSL/#logical-builtin-functions')
  .desc(
    `
# scalar
e: bool
@const fn all(e) -> bool
Returns e.

# vector
@const fn all(e: vecN<bool>) -> bool
Returns true if each component of e is true.
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('overload', ['scalar', 'vec2', 'vec3', 'vec4'] as const)
  )
  .fn(async t => {
    const overloads = {
      scalar: {
        type: TypeBool,
        cases: [
          { input: False, expected: False },
          { input: True, expected: True },
        ],
      },
      vec2: {
        type: TypeVec(2, TypeBool),
        cases: [
          { input: vec2(False, False), expected: False },
          { input: vec2(True, False), expected: False },
          { input: vec2(False, True), expected: False },
          { input: vec2(True, True), expected: True },
        ],
      },
      vec3: {
        type: TypeVec(3, TypeBool),
        cases: [
          { input: vec3(False, False, False), expected: False },
          { input: vec3(True, False, False), expected: False },
          { input: vec3(False, True, False), expected: False },
          { input: vec3(True, True, False), expected: False },
          { input: vec3(False, False, True), expected: False },
          { input: vec3(True, False, True), expected: False },
          { input: vec3(False, True, True), expected: False },
          { input: vec3(True, True, True), expected: True },
        ],
      },
      vec4: {
        type: TypeVec(4, TypeBool),
        cases: [
          { input: vec4(False, False, False, False), expected: False },
          { input: vec4(False, True, False, False), expected: False },
          { input: vec4(False, False, True, False), expected: False },
          { input: vec4(False, True, True, False), expected: False },
          { input: vec4(False, False, False, True), expected: False },
          { input: vec4(False, True, False, True), expected: False },
          { input: vec4(False, False, True, True), expected: False },
          { input: vec4(False, True, True, True), expected: False },
          { input: vec4(True, False, False, False), expected: False },
          { input: vec4(True, False, False, True), expected: False },
          { input: vec4(True, False, True, False), expected: False },
          { input: vec4(True, False, True, True), expected: False },
          { input: vec4(True, True, False, False), expected: False },
          { input: vec4(True, True, False, True), expected: False },
          { input: vec4(True, True, True, False), expected: False },
          { input: vec4(True, True, True, True), expected: True },
        ],
      },
    };
    const overload = overloads[t.params.overload];

    run(t, builtin('all'), [overload.type], TypeBool, t.params, overload.cases);
  });
