import { kUnitCaseParamsBuilder } from '../../../../../../common/framework/params_builder.js';
import { kRenderEncodeTypes } from '../../../validation_test.js';

export const kRenderEncodeTypeParams = kUnitCaseParamsBuilder.combine(
  'encoder',
  kRenderEncodeTypes
);

export const kBufferStates = ['valid', 'invalid', 'destroyed'] as const;

export function buildBufferOffsetAndSizeOOBTestParams(minAlignment: number, bufferSize: number) {
  return kRenderEncodeTypeParams.combineWithParams([
    // Explicit size
    { offset: 0, size: 0 },
    { offset: 0, size: 1 }, // control case
    { offset: 0, size: 4 },
    { offset: 0, size: 5 },
    { offset: 0, size: bufferSize },
    { offset: 0, size: bufferSize + 4 },
    { offset: minAlignment, size: bufferSize },
    { offset: minAlignment, size: bufferSize - minAlignment },
    { offset: bufferSize - 1, size: 1 },
    { offset: bufferSize, size: 1 },
    // Implicit size: buffer.size - offset
    { offset: 0, size: undefined }, // control case
    { offset: minAlignment, size: undefined },
    { offset: bufferSize - minAlignment, size: undefined },
    { offset: bufferSize, size: undefined },
    { offset: bufferSize + minAlignment, size: undefined },
  ]);
}
