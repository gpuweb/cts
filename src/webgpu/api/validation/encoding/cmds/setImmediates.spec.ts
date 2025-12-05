export const description = `
setImmediates validation tests.

Test different encoder types (compute pass, render pass, render bundle):
* Interpretation:
  - Passing a TypedArray, the data offset and size are given in elements (not bytes).
* Alignment:
  - rangeOffset is not a multiple of 4 bytes.
  - content size, converted to bytes, is not a multiple of 4 bytes.
* Arithmetic overflow
  - rangeOffset + contentSize is overflow
* Bounds:
  - dataOffset + contentSize (in bytes) exceeds the content data size.
  - rangeOffset + contentSize (in bytes) exceeds the maxImmediateSize.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import {
  kTypedArrayBufferViewConstructors,
  TypedArrayBufferViewConstructor,
} from '../../../../../common/util/util.js';
import { Float16Array } from '../../../../../external/petamoriken/float16/float16.js';
import { AllFeaturesMaxLimitsGPUTest } from '../../../../gpu_test.js';
import { kProgrammableEncoderTypes } from '../../../../util/command_buffer_maker.js';
import { kMaxSafeMultipleOf8 } from '../../../../util/math.js';

export const g = makeTestGroup(AllFeaturesMaxLimitsGPUTest);

g.test('interpretation')
  .desc('Tests that contentSize is interpreted as element size with TypedArray.')
  .paramsSubcasesOnly(u =>
    u //
      .combine('encoderType', kProgrammableEncoderTypes)
      .combine('success', [true, false])
  )
  .fn(t => {
    const { encoderType, success } = t.params;

    function runTest(arrayBufferType: TypedArrayBufferViewConstructor) {
      const kMinAlignmentBytes = 4;
      const elementSize = arrayBufferType.BYTES_PER_ELEMENT;
      const maxImmediateSize = t.device.limits.maxImmediateSize; // using this limit for tests
      const validDataSize = success
        ? Math.floor((maxImmediateSize - kMinAlignmentBytes) / elementSize)
        : maxImmediateSize - kMinAlignmentBytes;
      const validOffset = success
        ? Math.ceil(kMinAlignmentBytes / elementSize)
        : kMinAlignmentBytes;

      const { encoder, validateFinish } = t.createEncoder(encoderType);
      const data = new arrayBufferType(maxImmediateSize);

      encoder.setImmediates(/* rangeOffset */ 0, data, /* dataOffset */ validOffset, validDataSize);

      validateFinish(success || elementSize === 1);
    }

    for (const arrayType of kTypedArrayBufferViewConstructors) {
      if (arrayType === Float16Array) {
        // Skip Float16Array since it is supplied by an external module, so there isn't an overload for it.
        continue;
      }
      runTest(arrayType);
    }
  });

g.test('alignment')
  .desc('Tests that rangeOffset and contentSize must align to 4 bytes.')
  .paramsSubcasesOnly(u =>
    u //
      .combine('encoderType', kProgrammableEncoderTypes)
      .combineWithParams([
        // control case
        { offset: 4, contentByteSize: 4, _offsetValid: true, _contentValid: true },
        // offset is not aligned to 4 bytes
        { offset: 1, contentByteSize: 4, _offsetValid: false, _contentValid: true },
        // contentSize is not aligned to 4 bytes
        { offset: 4, contentByteSize: 5, _offsetValid: true, _contentValid: false },
      ] as const)
  )
  .fn(t => {
    const { encoderType, offset, contentByteSize, _offsetValid, _contentValid } = t.params;
    const data = new Uint8Array(contentByteSize);

    const { encoder, validateFinish } = t.createEncoder(encoderType);

    const doSetImmediates = () => {
      encoder.setImmediates(offset, data, 0, contentByteSize);
    };

    if (_contentValid) {
      doSetImmediates();
    } else {
      t.shouldThrow('RangeError', doSetImmediates);
    }

    validateFinish(_offsetValid);
  });

g.test('overflow')
  .desc('Tests that rangeOffset + contentSize exceed Number.MAX_SAFE_INTEGER.')
  .paramsSubcasesOnly(u =>
    u //
      .combine('encoderType', kProgrammableEncoderTypes)
      .combineWithParams([
        // control case
        { offset: 4, contentByteSize: 4, _rangeValid: true, _contentValid: true },
        // rangeOffset + contentSize is overflow
        {
          offset: 4,
          contentByteSize: kMaxSafeMultipleOf8,
          _rangeValid: true,
          _contentValid: false,
        },
      ] as const)
  )
  .fn(t => {
    const { encoderType, offset, contentByteSize, _rangeValid, _contentValid } = t.params;
    // Allocate enough data to avoid bounds errors when testing overflow.
    const data = new Uint8Array(contentByteSize);

    const { encoder, validateFinish } = t.createEncoder(encoderType);

    const doSetImmediates = () => {
      encoder.setImmediates(offset, data, 0, contentByteSize);
    };

    if (_contentValid) {
      doSetImmediates();
    } else {
      t.shouldThrow('RangeError', doSetImmediates);
    }

    validateFinish(_rangeValid);
  });

g.test('out_of_bounds')
  .desc(
    'Tests that rangeOffset + contentSize is greater than maxImmediateSize and contentSize is larger than data size.'
  )
  .paramsSubcasesOnly(u =>
    u //
      .combine('encoderType', kProgrammableEncoderTypes)
      .combineWithParams([
        // control case
        {
          rangeRemainSpace: 4,
          dataByteSize: 32,
          immediateContentByteSize: 4,
          _rangeValid: true,
          _contentValid: true,
        },
        // offset + contentByteSize larger than maxImmediateSize
        {
          rangeRemainSpace: 0,
          dataByteSize: 32,
          immediateContentByteSize: 4,
          _rangeValid: false,
          _contentValid: true,
        },
        // contentSize is larger than data size
        {
          rangeRemainSpace: 8,
          dataByteSize: 4,
          immediateContentByteSize: 8,
          _rangeValid: true,
          _contentValid: false,
        },
      ] as const)
  )
  .fn(t => {
    const {
      encoderType,
      rangeRemainSpace,
      dataByteSize,
      immediateContentByteSize,
      _rangeValid,
      _contentValid,
    } = t.params;
    const maxImmediates = t.device.limits.maxImmediateSize;
    const rangeOffset = maxImmediates - rangeRemainSpace;
    const data = new Uint8Array(dataByteSize);

    const { encoder, validateFinish } = t.createEncoder(encoderType);

    const doSetImmediates = () => {
      encoder.setImmediates(rangeOffset, data, 0, immediateContentByteSize);
    };

    if (_contentValid) {
      doSetImmediates();
    } else {
      t.shouldThrow('RangeError', doSetImmediates);
    }

    validateFinish(_rangeValid);
  });
