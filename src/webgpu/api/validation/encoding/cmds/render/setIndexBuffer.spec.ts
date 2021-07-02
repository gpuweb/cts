export const description = `
Validation tests for setIndexBuffer on render pass and render bundle.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUConst } from '../../../../../constants.js';
import { ValidationTest } from '../../../validation_test.js';

import {
  kRenderEncodeTypeParams,
  kBufferStates,
  buildBufferOffsetAndSizeOOBTestParams,
} from './render.js';

export const g = makeTestGroup(ValidationTest);

g.test('index_buffer')
  .desc(
    `
Tests index buffer must be valid.
  `
  )
  .paramsSubcasesOnly(kRenderEncodeTypeParams.combine('state', kBufferStates))
  .unimplemented();

g.test('index_buffer_usage')
  .desc(
    `
Tests index buffer must have 'Index' usage.
  `
  )
  .paramsSubcasesOnly(
    kRenderEncodeTypeParams.combine('usage', [
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
  .paramsSubcasesOnly(
    kRenderEncodeTypeParams
      .combine('indexFormat', ['uint16', 'uint32'] as const)
      .expand('offset', p => {
        return p.indexFormat === 'uint16' ? ([0, 1, 2] as const) : ([0, 2, 4] as const);
      })
  )
  .unimplemented();

g.test('offset_and_size_oob')
  .desc(
    `
Tests offset and size cannot be larger than index buffer size.
  `
  )
  .paramsSubcasesOnly(buildBufferOffsetAndSizeOOBTestParams(4, 256))
  .unimplemented();
