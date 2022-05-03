/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ export const description = `
Execution tests for the 'cross' builtin function
`;
import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('abstract_float')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is AbstractFloat, f32, or f16
@const fn cross(e1: vec3<T> ,e2: vec3<T>) -> vec3<T>
Returns the cross product of e1 and e2.
`
  )
  .params(u => u.combine('storageClass', ['uniform', 'storage_r', 'storage_rw']))
  .unimplemented();

g.test('f32')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is AbstractFloat, f32, or f16
@const fn cross(e1: vec3<T> ,e2: vec3<T>) -> vec3<T>
Returns the cross product of e1 and e2.
`
  )
  .params(u => u.combine('storageClass', ['uniform', 'storage_r', 'storage_rw']))
  .unimplemented();

g.test('f16')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is AbstractFloat, f32, or f16
@const fn cross(e1: vec3<T> ,e2: vec3<T>) -> vec3<T>
Returns the cross product of e1 and e2.
`
  )
  .params(u => u.combine('storageClass', ['uniform', 'storage_r', 'storage_rw']))
  .unimplemented();
