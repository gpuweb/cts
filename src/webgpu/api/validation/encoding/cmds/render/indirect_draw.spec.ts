export const description = `
Validation tests for drawIndirect/drawIndexedIndirect on render pass and render bundle.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUConst } from '../../../../../constants.js';
import { ValidationTest } from '../../../validation_test.js';

import { kRenderEncodeTypeParams, kBufferStates } from './render.js';

const kIndirectDrawTestParams = kRenderEncodeTypeParams.combine('indexed', [true, false] as const);

export const g = makeTestGroup(ValidationTest);

g.test('indirect_buffer')
  .desc(
    `
Tests indirect buffer must be valid.
  `
  )
  .paramsSubcasesOnly(kIndirectDrawTestParams.combine('state', kBufferStates))
  .unimplemented();

g.test('indirect_buffer_usage')
  .desc(
    `
Tests indirect buffer must have 'Indirect' usage.
  `
  )
  .paramsSubcasesOnly(
    kIndirectDrawTestParams.combine('usage', [
      GPUConst.BufferUsage.INDIRECT, // control case
      GPUConst.BufferUsage.COPY_DST,
      GPUConst.BufferUsage.COPY_DST | GPUConst.BufferUsage.INDIRECT,
    ] as const)
  )
  .unimplemented();

g.test('indirect_offset_alignment')
  .desc(
    `
Tests indirect offset must be a multiple of 4.
  `
  )
  .paramsSubcasesOnly(kIndirectDrawTestParams.combine('offset', [0, 2, 4] as const))
  .unimplemented();

g.test('indirect_offset_oob')
  .desc(
    `
Tests indirect draw calls with various indirect offsets and buffer sizes.
- (offset, b.size) is
  - (0, 0)
  - (0, min size) (control case)
  - (0, min size + 1) (control case)
  - (0, min size - 1)
  - (0, min size - min alignment)
  - (min alignment, min size + min alignment)
  - (min alignment, min size + min alignment - 1)
  - (min alignment +/- 1, min size + alignment)
  - (min size, min size)
  - (min size + min alignment, min size)
  - min size = indirect draw parameters size
  - x =(drawIndirect, drawIndexedIndirect)
  `
  )
  .paramsSubcasesOnly(
    kIndirectDrawTestParams.expandWithParams(p => {
      const indirectParamsSize = p.indexed ? 20 : 16;
      return [
        { indirectOffset: 0, bufferSize: 0 },
        { indirectOffset: 0, bufferSize: indirectParamsSize },
        { indirectOffset: 0, bufferSize: indirectParamsSize + 1 },
        { indirectOffset: 0, bufferSize: indirectParamsSize - 1 },
        { indirectOffset: 0, bufferSize: indirectParamsSize - 4 },
        { indirectOffset: 4, bufferSize: indirectParamsSize + 4 },
        { indirectOffset: 4, bufferSize: indirectParamsSize + 3 },
        { indirectOffset: 3, bufferSize: indirectParamsSize + 4 },
        { indirectOffset: 5, bufferSize: indirectParamsSize + 4 },
        { indirectOffset: indirectParamsSize, bufferSize: indirectParamsSize },
        { indirectOffset: indirectParamsSize + 4, bufferSize: indirectParamsSize },
      ] as const;
    })
  )
  .unimplemented();
