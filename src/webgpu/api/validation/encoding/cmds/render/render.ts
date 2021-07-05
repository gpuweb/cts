import { kUnitCaseParamsBuilder } from '../../../../../../common/framework/params_builder.js';
import { kRenderEncodeTypes } from '../../../validation_test.js';

export const kRenderEncodeTypeParams = kUnitCaseParamsBuilder.combine(
  'encoderType',
  kRenderEncodeTypes
);

export const kBufferStates = ['valid', 'invalid', 'destroyed'] as const;

export function buildBufferOffsetAndSizeOOBTestParams(minAlignment: number, bufferSize: number) {
  return kRenderEncodeTypeParams.combineWithParams([
    // Explicit size
    { offset: 0, size: 0, _valid: true },
    { offset: 0, size: 1, _valid: true }, // control case
    { offset: 0, size: 4, _valid: true },
    { offset: 0, size: 5, _valid: true },
    { offset: 0, size: bufferSize, _valid: true },
    { offset: 0, size: bufferSize + 4, _valid: false },
    { offset: minAlignment, size: bufferSize, _valid: false },
    { offset: minAlignment, size: bufferSize - minAlignment, _valid: true },
    { offset: bufferSize - 1, size: 1, _valid: false },
    { offset: bufferSize, size: 1, _valid: false },
    // Implicit size: buffer.size - offset
    { offset: 0, size: undefined, _valid: true }, // control case
    { offset: minAlignment, size: undefined, _valid: true },
    { offset: bufferSize - minAlignment, size: undefined, _valid: true },
    { offset: bufferSize, size: undefined, _valid: true },
    { offset: bufferSize + minAlignment, size: undefined, _valid: false },
  ]);
}
