export const description = `
Validation tests for drawIndirect/drawIndexedIndirect on render pass and render bundle.
`;

import { kUnitCaseParamsBuilder } from '../../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUConst } from '../../../../../constants.js';
import { ValidationTest, kRenderEncodeTypes } from '../../../validation_test.js';

export const g = makeTestGroup(ValidationTest);

const kTestParams = kUnitCaseParamsBuilder
  .combine('encoder', kRenderEncodeTypes)
  .combine('indexed', [true, false] as const);

g.test('indirect_buffer')
  .desc(
    `
Tests indirect buffer must be valid.
  `
  )
  .paramsSubcasesOnly(kTestParams.combine('state', ['valid', 'invalid', 'destroyed'] as const))
  .unimplemented();

g.test('indirect_buffer_usage')
  .desc(
    `
Tests indirect buffer must have 'Indirect' usage.
  `
  )
  .paramsSubcasesOnly(
    kTestParams.combine('usage', [
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
  .paramsSubcasesOnly(kTestParams.combine('offset', [0, 2, 4] as const))
  .unimplemented();

g.test('indirect_offset_oob')
  .desc(
    `
Tests indirect draw calls with various indirect offsets and buffer sizes.
- (offset, b.size) is
  - (0, 0)
  - (0, min size - min alignment)
  - (0, min size - 1)
  - (0, min size) (control case)
  - (min alignment, min size + min alignment)
  - (min alignment, min alignment + min size - 1)
  - (min alignment +/- 1, min size + alignment)
  - (min size, min size)
  - (min size + min alignment, min size)
  `
  )
  .paramsSubcasesOnly(
    kTestParams.expandWithParams(p => {
      const minSize = p.indexed ? 20 : 16;
      return [
        { indirectOffset: 0, bufferSize: 0 },
        { indirectOffset: 0, bufferSize: minSize },
        { indirectOffset: 0, bufferSize: minSize - 1 },
        { indirectOffset: 0, bufferSize: minSize - 4 },
        { indirectOffset: 4, bufferSize: minSize + 4 },
        { indirectOffset: 4, bufferSize: minSize + 3 },
        { indirectOffset: 3, bufferSize: minSize + 4 },
        { indirectOffset: 5, bufferSize: minSize + 4 },
        { indirectOffset: minSize, bufferSize: minSize },
        { indirectOffset: minSize + 4, bufferSize: minSize },
      ] as const;
    })
  )
  .unimplemented();
