export const description = `
Validation tests for setVertexBuffer on render pass and render bundle.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUConst, DefaultLimits } from '../../../../../constants.js';
import { ValidationTest, kRenderEncodeTypes } from '../../../validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('slot')
  .desc(
    `
Tests slot must be less than the maxVertexBuffers in device limits.
  `
  )
  .paramsSubcasesOnly(u =>
    u
      .combine('encoder', kRenderEncodeTypes)
      .combine('slot', [
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
  .paramsSubcasesOnly(u =>
    u
      .combine('encoder', kRenderEncodeTypes)
      .combine('state', ['valid', 'invalid', 'destroyed'] as const)
  )
  .unimplemented();

g.test('vertex_buffer_usage')
  .desc(
    `
Tests vertex buffer must have 'Vertex' usage.
  `
  )
  .paramsSubcasesOnly(u =>
    u.combine('encoder', kRenderEncodeTypes).combine('usage', [
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
  .paramsSubcasesOnly(u =>
    u.combine('encoder', kRenderEncodeTypes).combine('offset', [0, 2, 4] as const)
  )
  .unimplemented();

g.test('offset_and_size_oob')
  .desc(
    `
Tests offset and size cannot be larger than vertex buffer size
- (offset, size) is
  - (0, 1)
  - (0, min size) (control case)
  - (0, min size + 1)
  - (0, buffer.size) (control case)
  - (0, buffer.size + 4)
  - (min alignment, buffer.size)
  - (min alignment, buffer.size - min alignment)
  - (buffer.size - min size, min size)
  - (buffer.size, min size)
  - (0, 0)
  - (min alignment, 0) (control case)
  - (buffer.size - 4, 0)
  - (buffer.size, 0)
  - (buffer.size + 4, 0)
  `
  )
  .paramsSubcasesOnly(u =>
    u.combine('encoder', kRenderEncodeTypes).combineWithParams([
      // Explicit size
      { offset: 0, size: 1 },
      { offset: 0, size: 4 },
      { offset: 0, size: 5 },
      { offset: 0, size: 256 },
      { offset: 0, size: 260 },
      { offset: 4, size: 256 },
      { offset: 4, size: 252 },
      { offset: 252, size: 4 },
      { offset: 256, size: 4 },
      // Implicit size: buffer.size - offset
      { offset: 0, size: 0 },
      { offset: 4, size: 0 },
      { offset: 252, size: 0 },
      { offset: 256, size: 0 },
      { offset: 260, size: 0 },
    ])
  )
  .unimplemented();
