export const description = `
Validation tests for setIndexBuffer on render pass and render bundle.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUConst } from '../../../../../constants.js';
import { ValidationTest, kRenderEncodeTypes } from '../../../validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('index_buffer')
  .desc(
    `
Tests index buffer must be valid.
  `
  )
  .paramsSubcasesOnly(u =>
    u
      .combine('encoder', kRenderEncodeTypes)
      .combine('state', ['valid', 'invalid', 'destroyed'] as const)
  )
  .unimplemented();

g.test('index_buffer_usage')
  .desc(
    `
Tests index buffer must have 'Index' usage.
  `
  )
  .paramsSubcasesOnly(u =>
    u.combine('encoder', kRenderEncodeTypes).combine('usage', [
      GPUConst.BufferUsage.INDEX, // control case
      GPUConst.BufferUsage.COPY_DST,
      GPUConst.BufferUsage.COPY_DST | GPUConst.BufferUsage.INDEX,
    ] as const)
  )
  .unimplemented();

g.test('offset_alignment')
  .desc(
    `
Tests offset must be a multiple of index format’s byte size.
  `
  )
  .paramsSubcasesOnly(u =>
    u
      .combine('encoder', kRenderEncodeTypes)
      .combine('indexFormat', ['uint16', 'uint32'] as const)
      .expand('offset', p => {
        return p.indexFormat === 'uint16' ? ([0, 1, 2] as const) : ([0, 2, 4] as const);
      })
  )
  .unimplemented();

g.test('offset_and_size_oob')
  .desc(
    `
Tests offset and size cannot be larger than index buffer size
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
