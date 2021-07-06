export const description = `
Validation tests for setVertexBuffer on render pass and render bundle.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUConst, DefaultLimits } from '../../../../../constants.js';
import { ValidationTest } from '../../../validation_test.js';

import {
  kRenderEncodeTypeParams,
  kBufferStates,
  buildBufferOffsetAndSizeOOBTestParams,
} from './render.js';

export const g = makeTestGroup(ValidationTest);

g.test('slot')
  .desc(
    `
Tests slot must be less than the maxVertexBuffers in device limits.
  `
  )
  .paramsSubcasesOnly(
    kRenderEncodeTypeParams.combine('slot', [
      0,
      DefaultLimits.maxVertexBuffers - 1,
      DefaultLimits.maxVertexBuffers,
    ] as const)
  )
  .unimplemented();

g.test('vertex_buffer')
  .desc(
    `
Tests vertex buffer must be valid.
  `
  )
  .paramsSubcasesOnly(kRenderEncodeTypeParams.combine('state', kBufferStates))
  .unimplemented();

g.test('vertex_buffer_usage')
  .desc(
    `
Tests vertex buffer must have 'Vertex' usage.
  `
  )
  .paramsSubcasesOnly(
    kRenderEncodeTypeParams.combine('usage', [
      GPUConst.BufferUsage.VERTEX, // control case
      GPUConst.BufferUsage.COPY_DST,
      GPUConst.BufferUsage.COPY_DST | GPUConst.BufferUsage.VERTEX,
    ] as const)
  )
  .unimplemented();

g.test('offset_alignment')
  .desc(
    `
Tests offset must be a multiple of 4.
  `
  )
  .paramsSubcasesOnly(kRenderEncodeTypeParams.combine('offset', [0, 2, 4] as const))
  .unimplemented();

g.test('offset_and_size_oob')
  .desc(
    `
Tests offset and size cannot be larger than vertex buffer size.
  `
  )
  .paramsSubcasesOnly(buildBufferOffsetAndSizeOOBTestParams(4, 256))
  .unimplemented();
