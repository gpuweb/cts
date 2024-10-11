export const description = `
Validation tests for multiDrawIndirect/multiDrawIndexedIndirect on render pass.
`;

import { kUnitCaseParamsBuilder } from '../../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import {
  GPUConst,
  kMaxUnsignedLongValue,
  kMaxUnsignedLongLongValue,
} from '../../../../../constants.js';
import { kResourceStates } from '../../../../../gpu_test.js';
import { ValidationTest } from '../../../validation_test.js';

const kIndirectMultiDrawTestParams = kUnitCaseParamsBuilder
  .combine('indexed', [true, false] as const)
  .combine('useDrawCountBuffer', [true, false] as const);

class F extends ValidationTest {
  makeIndexBuffer(): GPUBuffer {
    return this.createBufferTracked({
      size: 16,
      usage: GPUBufferUsage.INDEX,
    });
  }
}

export const g = makeTestGroup(F);

g.test('buffers_state')
  .desc(
    `
Tests indirect and draw count buffers must be valid.
  `
  )
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase('chromium-experimental-multi-draw-indirect' as GPUFeatureName);
  })

  .paramsSubcasesOnly(
    kIndirectMultiDrawTestParams
      .combine('indirectState', kResourceStates)
      .combine('drawCountState', kResourceStates)
  )
  .fn(t => {
    const { indexed, indirectState, useDrawCountBuffer, drawCountState } = t.params;
    const indirectBuffer = t.createBufferWithState(indirectState, {
      size: 256,
      usage: GPUBufferUsage.INDIRECT,
    });
    const drawCountBuffer = useDrawCountBuffer
      ? t.createBufferWithState(drawCountState, {
          size: 256,
          usage: GPUBufferUsage.INDIRECT,
        })
      : undefined;

    const { encoder, validateFinishAndSubmit } = t.createEncoder('render pass');
    encoder.setPipeline(t.createNoOpRenderPipeline());
    if (indexed) {
      encoder.setIndexBuffer(t.makeIndexBuffer(), 'uint32');
      encoder.multiDrawIndexedIndirect(indirectBuffer, 0, 1, drawCountBuffer);
    } else {
      encoder.multiDrawIndirect(indirectBuffer, 0, 1, drawCountBuffer);
    }

    const shouldBeValid =
      indirectState !== 'invalid' && (!drawCountBuffer || drawCountState !== 'invalid');
    const submitShouldSucceedIfValid =
      indirectState !== 'destroyed' && (!drawCountBuffer || drawCountState !== 'destroyed');
    validateFinishAndSubmit(shouldBeValid, submitShouldSucceedIfValid);
  });

g.test('buffers,device_mismatch')
  .desc(
    'Tests multiDraw(Indexed)Indirect cannot be called with buffers created from another device'
  )
  .paramsSubcasesOnly(kIndirectMultiDrawTestParams.combine('mismatched', [true, false]))
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase('chromium-experimental-multi-draw-indirect' as GPUFeatureName);
    t.selectMismatchedDeviceOrSkipTestCase(undefined);
  })
  .fn(t => {
    const { indexed, useDrawCountBuffer, mismatched } = t.params;

    const sourceDevice = mismatched ? t.mismatchedDevice : t.device;

    const indirectBuffer = t.trackForCleanup(
      sourceDevice.createBuffer({
        size: 256,
        usage: GPUBufferUsage.INDIRECT,
      })
    );
    const drawCountBuffer = useDrawCountBuffer
      ? t.trackForCleanup(
          sourceDevice.createBuffer({
            size: 256,
            usage: GPUBufferUsage.INDIRECT,
          })
        )
      : undefined;

    const { encoder, validateFinish } = t.createEncoder('render pass');
    encoder.setPipeline(t.createNoOpRenderPipeline());
    if (indexed) {
      encoder.setIndexBuffer(t.makeIndexBuffer(), 'uint32');
      encoder.multiDrawIndexedIndirect(indirectBuffer, 0, 1, drawCountBuffer);
    } else {
      encoder.multiDrawIndirect(indirectBuffer, 0, 1, drawCountBuffer);
    }
    validateFinish(!mismatched);
  });

g.test('indirect_buffer_usage')
  .desc(
    `
Tests indirect and draw count buffers must have 'Indirect' usage.
  `
  )
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase('chromium-experimental-multi-draw-indirect' as GPUFeatureName);
  })
  .paramsSubcasesOnly(
    kIndirectMultiDrawTestParams
      .combine('indirectUsage', [
        GPUConst.BufferUsage.INDIRECT,
        GPUConst.BufferUsage.VERTEX,
        GPUConst.BufferUsage.VERTEX | GPUConst.BufferUsage.INDIRECT,
      ] as const)
      .combine('drawCountUsage', [
        GPUConst.BufferUsage.INDIRECT,
        GPUConst.BufferUsage.VERTEX,
        GPUConst.BufferUsage.VERTEX | GPUConst.BufferUsage.INDIRECT,
      ] as const)
  )
  .fn(t => {
    const { indexed, indirectUsage, useDrawCountBuffer, drawCountUsage } = t.params;

    const indirectBuffer = t.createBufferTracked({
      size: 256,
      usage: indirectUsage,
    });
    const drawCountBuffer = useDrawCountBuffer
      ? t.createBufferTracked({
          size: 256,
          usage: drawCountUsage,
        })
      : undefined;

    const { encoder, validateFinish } = t.createEncoder('render pass');
    encoder.setPipeline(t.createNoOpRenderPipeline());
    if (indexed) {
      encoder.setIndexBuffer(t.makeIndexBuffer(), 'uint32');
      encoder.multiDrawIndexedIndirect(indirectBuffer, 0, 1, drawCountBuffer);
    } else {
      encoder.multiDrawIndirect(indirectBuffer, 0, 1, drawCountBuffer);
    }
    const shouldSucceed =
      (indirectUsage & GPUBufferUsage.INDIRECT) !== 0 &&
      (!drawCountBuffer || drawCountUsage & GPUBufferUsage.INDIRECT) !== 0;
    validateFinish(shouldSucceed);
  });

g.test('offsets_alignment')
  .desc(
    `
Tests indirect and draw count offsets must be a multiple of 4.
  `
  )
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase('chromium-experimental-multi-draw-indirect' as GPUFeatureName);
  })
  .paramsSubcasesOnly(
    kIndirectMultiDrawTestParams
      .combine('indirectOffset', [0, 2, 4] as const)
      .combine('drawCountOffset', [0, 2, 4] as const)
  )
  .fn(t => {
    const { indexed, indirectOffset, useDrawCountBuffer, drawCountOffset } = t.params;

    const indirectBuffer = t.createBufferTracked({
      size: 256,
      usage: GPUBufferUsage.INDIRECT,
    });
    const drawCountBuffer = useDrawCountBuffer
      ? t.createBufferTracked({
          size: 256,
          usage: GPUBufferUsage.INDIRECT,
        })
      : undefined;

    const { encoder, validateFinish } = t.createEncoder('render pass');
    encoder.setPipeline(t.createNoOpRenderPipeline());
    if (indexed) {
      encoder.setIndexBuffer(t.makeIndexBuffer(), 'uint32');
      encoder.multiDrawIndexedIndirect(
        indirectBuffer,
        indirectOffset,
        1,
        drawCountBuffer,
        drawCountOffset
      );
    } else {
      encoder.multiDrawIndirect(
        indirectBuffer,
        indirectOffset,
        1,
        drawCountBuffer,
        drawCountOffset
      );
    }

    // We need to figure out if https://github.com/gpuweb/gpuweb/pull/2315/files#r1773031950 applies.
    validateFinish(indirectOffset % 4 === 0 && (!useDrawCountBuffer || drawCountOffset % 4 === 0));
  });

g.test('indirect_offset_oob')
  .desc(
    `
Tests multi indirect draw calls with various offsets and buffer sizes.
  `
  )
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase('chromium-experimental-multi-draw-indirect' as GPUFeatureName);
  })
  .params(u =>
    u.expandWithParams(() => {
      return [
        // In bounds
        { bufferSize: 4, indirectOffset: 0, _valid: true },
        // In bounds, bigger buffer
        { bufferSize: 7, indirectOffset: 0, _valid: true },
        // In bounds, bigger buffer, positive offset
        { bufferSize: 8, indirectOffset: 4, _valid: true },
        // In bounds for maxDrawCount
        { bufferSize: 8, indirectOffset: 0, maxDrawCount: 2, _valid: true },
        // In bounds with drawCountBuffer
        { bufferSize: 4, indirectOffset: 0, useDrawCountBuffer: true, _valid: true },
        // In bounds with drawCountBuffer, bigger buffer
        {
          bufferSize: 7,
          indirectOffset: 0,
          drawCountOffset: 6 * Uint32Array.BYTES_PER_ELEMENT,
          useDrawCountBuffer: true,
          _valid: true,
        },
        // In bounds, non-multiple of 4 offsets
        { bufferSize: 5, indirectOffset: 1, _valid: false },
        { bufferSize: 5, indirectOffset: 2, _valid: false },
        {
          bufferSize: 5,
          indirectOffset: 0,
          drawCountOffset: 1,
          useDrawCountBuffer: true,
          _valid: false,
        },
        {
          bufferSize: 5,
          indirectOffset: 0,
          drawCountOffset: 2,
          useDrawCountBuffer: true,
          _valid: false,
        },
        // Out of bounds, buffer too small
        { bufferSize: 3, indirectOffset: 0, _valid: false },
        // Out of bounds, index too big
        { bufferSize: 4, indirectOffset: 1 * Uint32Array.BYTES_PER_ELEMENT, _valid: false },
        // Out of bounds, index past buffer
        { bufferSize: 4, indirectOffset: 5 * Uint32Array.BYTES_PER_ELEMENT, _valid: false },
        // Out of bounds, too small for maxDrawCount
        { bufferSize: 7, indirectOffset: 0, drawCountOffset: 0, maxDrawCount: 2, _valid: false },
        // Out of bounds, offset too big for drawCountBuffer
        {
          bufferSize: 4,
          indirectOffset: 0,
          drawCountOffset: 4 * Uint32Array.BYTES_PER_ELEMENT,
          useDrawCountBuffer: true,
          _valid: false,
        },
        // Out of bounds, index + size of command overflows
        // uint64_t offset = std::numeric_limits<uint64_t>::max();
        { bufferSize: 7, indirectOffset: kMaxUnsignedLongLongValue, _valid: false },
        // Out of bounds, index + size of command overflows with drawCountBuffer
        {
          bufferSize: 7,
          indirectOffset: 0,
          drawCountOffset: kMaxUnsignedLongLongValue,
          useDrawCountBuffer: true,
          _valid: false,
        },
        // Out of bounds, maxDrawCount = kMaxUnsignedLongValue
        { bufferSize: 7, indirectOffset: 0, maxDrawCount: kMaxUnsignedLongValue, _valid: false },
      ];
    })
  )
  .fn(t => {
    const {
      bufferSize,
      indirectOffset,
      drawCountOffset = 0,
      maxDrawCount = 1,
      useDrawCountBuffer = false,
      _valid,
    } = t.params;

    const indirectBuffer = t.createBufferTracked({
      size: bufferSize * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.INDIRECT,
    });

    const { encoder, validateFinish } = t.createEncoder('render pass');
    encoder.setPipeline(t.createNoOpRenderPipeline());
    encoder.multiDrawIndirect(
      indirectBuffer,
      indirectOffset,
      maxDrawCount,
      useDrawCountBuffer ? indirectBuffer : undefined,
      drawCountOffset
    );

    validateFinish(_valid);
  });

g.test('indexed_indirect_offset_oob')
  .desc(
    `
Tests multi indexed indirect draw calls with various offsets and buffer sizes.
  `
  )
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase('chromium-experimental-multi-draw-indirect' as GPUFeatureName);
  })
  .params(u =>
    u.expandWithParams(() => {
      return [
        // In bounds
        { bufferSize: 5, indirectOffset: 0, _valid: true },
        // In bounds, bigger buffer
        { bufferSize: 9, indirectOffset: 0, _valid: true },
        // In bounds, bigger buffer, positive offset
        { bufferSize: 10, indirectOffset: 5 * Uint32Array.BYTES_PER_ELEMENT, _valid: true },
        // In bounds with drawCountBuffer
        { bufferSize: 5, indirectOffset: 0, useDrawCountBuffer: true, _valid: true },
        // In bounds with drawCountBuffer, bigger buffer
        {
          bufferSize: 6,
          indirectOffset: 0,
          drawCountOffset: 5 * Uint32Array.BYTES_PER_ELEMENT,
          useDrawCountBuffer: true,
          _valid: true,
        },
        // In bounds, non-multiple of 4 offsets
        { bufferSize: 6, indirectOffset: 1, _valid: false },
        { bufferSize: 6, indirectOffset: 2, _valid: false },
        {
          bufferSize: 6,
          indirectOffset: 0,
          drawCountOffset: 1,
          useDrawCountBuffer: true,
          _valid: false,
        },
        {
          bufferSize: 6,
          indirectOffset: 0,
          drawCountOffset: 2,
          useDrawCountBuffer: true,
          _valid: false,
        },
        // Out of bounds, buffer too small
        { bufferSize: 4, indirectOffset: 0, _valid: false },
        // Out of bounds, index too big
        { bufferSize: 5, indirectOffset: 1 * Uint32Array.BYTES_PER_ELEMENT, _valid: false },
        // Out of bounds, index past buffer
        { bufferSize: 5, indirectOffset: 5 * Uint32Array.BYTES_PER_ELEMENT, _valid: false },
        // Out of bounds, too small for maxDrawCount
        { bufferSize: 5, indirectOffset: 0, drawCountOffset: 0, maxDrawCount: 2, _valid: false },
        // Out of bounds, offset too big for drawCountBuffer
        {
          bufferSize: 5,
          indirectOffset: 0,
          drawCountOffset: 5 * Uint32Array.BYTES_PER_ELEMENT,
          useDrawCountBuffer: true,
          _valid: false,
        },
        // Out of bounds, index + size of command overflows
        { bufferSize: 10, indirectOffset: kMaxUnsignedLongLongValue, _valid: false },
        // Out of bounds, index + size of command overflows with drawCountBuffer
        {
          bufferSize: 10,
          indirectOffset: 0,
          drawCountOffset: kMaxUnsignedLongLongValue,
          useDrawCountBuffer: true,
          _valid: false,
        },
        // Out of bounds, maxDrawCount = kMaxUnsignedLongValue
        { bufferSize: 5, indirectOffset: 0, maxDrawCount: kMaxUnsignedLongValue, _valid: false },
      ];
    })
  )
  .fn(t => {
    const {
      bufferSize,
      indirectOffset,
      drawCountOffset = 0,
      maxDrawCount = 1,
      useDrawCountBuffer = false,
      _valid,
    } = t.params;

    const indirectBuffer = t.createBufferTracked({
      size: bufferSize * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.INDIRECT,
    });

    const { encoder, validateFinish } = t.createEncoder('render pass');
    encoder.setPipeline(t.createNoOpRenderPipeline());
    encoder.setIndexBuffer(t.makeIndexBuffer(), 'uint32');
    encoder.multiDrawIndexedIndirect(
      indirectBuffer,
      indirectOffset,
      maxDrawCount,
      useDrawCountBuffer ? indirectBuffer : undefined,
      drawCountOffset
    );

    validateFinish(_valid);
  });
