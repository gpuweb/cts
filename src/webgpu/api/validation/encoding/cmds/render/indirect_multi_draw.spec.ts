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
      // drawCountState only matters if useDrawCountBuffer=true
      .filter(p => p.useDrawCountBuffer || p.drawCountState === 'valid')
      // Filter out a few unnecessary cases that would hit two errors in the same API call
      .filter(
        p =>
          p.indirectState === 'valid' ||
          p.drawCountState === 'valid' ||
          p.indirectState !== p.drawCountState
      )
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (encoder as any).multiDrawIndexedIndirect(indirectBuffer, 0, 1, drawCountBuffer);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (encoder as any).multiDrawIndirect(indirectBuffer, 0, 1, drawCountBuffer);
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
  .paramsSubcasesOnly(
    kIndirectMultiDrawTestParams.combineWithParams([
      { indirectMismatched: false, drawCountMismatched: false }, // control case
      { indirectMismatched: true, drawCountMismatched: false },
      { indirectMismatched: false, drawCountMismatched: true },
    ])
  )
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase('chromium-experimental-multi-draw-indirect' as GPUFeatureName);
    t.selectMismatchedDeviceOrSkipTestCase(undefined);
  })
  .fn(t => {
    const { indexed, useDrawCountBuffer, indirectMismatched, drawCountMismatched } = t.params;

    const indirectDevice = indirectMismatched ? t.mismatchedDevice : t.device;
    const drawCountDevice = drawCountMismatched ? t.mismatchedDevice : t.device;

    const indirectBuffer = t.trackForCleanup(
      indirectDevice.createBuffer({
        size: 256,
        usage: GPUBufferUsage.INDIRECT,
      })
    );
    const drawCountBuffer = useDrawCountBuffer
      ? t.trackForCleanup(
          drawCountDevice.createBuffer({
            size: 256,
            usage: GPUBufferUsage.INDIRECT,
          })
        )
      : undefined;

    const { encoder, validateFinish } = t.createEncoder('render pass');
    encoder.setPipeline(t.createNoOpRenderPipeline());
    if (indexed) {
      encoder.setIndexBuffer(t.makeIndexBuffer(), 'uint32');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (encoder as any).multiDrawIndexedIndirect(indirectBuffer, 0, 1, drawCountBuffer);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (encoder as any).multiDrawIndirect(indirectBuffer, 0, 1, drawCountBuffer);
    }
    validateFinish(!indirectMismatched && (!useDrawCountBuffer || !drawCountMismatched));
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (encoder as any).multiDrawIndexedIndirect(indirectBuffer, 0, 1, drawCountBuffer);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (encoder as any).multiDrawIndirect(indirectBuffer, 0, 1, drawCountBuffer);
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
    kIndirectMultiDrawTestParams.combineWithParams([
      // Valid
      { indirectOffset: 0, drawCountOffset: 0 },
      { indirectOffset: 4, drawCountOffset: 0 },
      { indirectOffset: 0, drawCountOffset: 4 },
      // Invalid
      { indirectOffset: 2, drawCountOffset: 0 },
      { indirectOffset: 6, drawCountOffset: 0 },
      { indirectOffset: 0, drawCountOffset: 2 },
      { indirectOffset: 0, drawCountOffset: 6 },
    ] as const)
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (encoder as any).multiDrawIndexedIndirect(
        indirectBuffer,
        indirectOffset,
        1,
        drawCountBuffer,
        drawCountOffset
      );
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (encoder as any).multiDrawIndirect(
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

interface IndirectOffsetOobCase {
  indirectOffset: number;
  bufferSize: number;
  useDrawCountBuffer?: boolean;
  drawCountOffset?: number;
  maxDrawCount?: number;
  _valid: boolean;
}

g.test('offsets_and_buffer_sizes')
  .desc(
    `
Tests multi indirect draw calls with various indirect offsets, buffer sizes, draw count offsets, and draw count buffer sizes.
  `
  )
  .paramsSubcasesOnly(u =>
    u.combine('indexed', [true, false] as const).expandWithParams<IndirectOffsetOobCase>(p => {
      const indirectParamsSize = p.indexed ? 20 : 16;
      return [
        { indirectOffset: 0, bufferSize: 0, _valid: false },
        // In bounds
        { indirectOffset: 0, bufferSize: indirectParamsSize, _valid: true },
        { indirectOffset: 0, bufferSize: indirectParamsSize + 1, _valid: true },
        // In bounds with drawCountBuffer
        {
          indirectOffset: 0,
          bufferSize: indirectParamsSize,
          useDrawCountBuffer: true,
          _valid: true,
        },
        // In bounds, bigger buffer, positive offset
        { indirectOffset: indirectParamsSize, bufferSize: indirectParamsSize * 2, _valid: true },
        // In bounds with drawCountBuffer, bigger buffer
        {
          indirectOffset: 0,
          bufferSize: indirectParamsSize,
          useDrawCountBuffer: true,
          drawCountOffset: indirectParamsSize - 4,
          _valid: true,
        },
        // Out of bounds, buffer too small
        { indirectOffset: 0, bufferSize: indirectParamsSize - 1, _valid: false },
        { indirectOffset: 0, bufferSize: indirectParamsSize - 4, _valid: false },
        // In bounds, non-multiple of 4 offsets
        { indirectOffset: 3, bufferSize: indirectParamsSize + 4, _valid: false },
        { indirectOffset: 5, bufferSize: indirectParamsSize + 4, _valid: false },
        {
          indirectOffset: 0,
          bufferSize: indirectParamsSize + 4,
          useDrawCountBuffer: true,
          drawCountOffset: 1,
          _valid: false,
        },
        {
          indirectOffset: 0,
          bufferSize: indirectParamsSize + 4,
          useDrawCountBuffer: true,
          drawCountOffset: 2,
          _valid: false,
        },
        // Out of bounds, index too big
        { indirectOffset: 4, bufferSize: indirectParamsSize, _valid: false },
        // Out of bounds, index past buffer
        { indirectOffset: indirectParamsSize + 4, bufferSize: indirectParamsSize, _valid: false },
        // Out of bounds, too small for maxDrawCount
        { indirectOffset: 0, bufferSize: indirectParamsSize, maxDrawCount: 2, _valid: false },
        // Out of bounds, offset too big for drawCountBuffer
        {
          indirectOffset: 0,
          bufferSize: indirectParamsSize,
          useDrawCountBuffer: true,
          drawCountOffset: indirectParamsSize,
          _valid: false,
        },
        // Out of bounds, index + size of command overflows
        {
          indirectOffset: kMaxUnsignedLongLongValue,
          bufferSize: indirectParamsSize,
          _valid: false,
        },
        // Out of bounds, index + size of command overflows with drawCountBuffer
        {
          indirectOffset: 0,
          bufferSize: indirectParamsSize,
          useDrawCountBuffer: true,
          drawCountOffset: kMaxUnsignedLongLongValue,
          _valid: false,
        },
        // Out of bounds, maxDrawCount = kMaxUnsignedLongValue
        {
          indirectOffset: 0,
          bufferSize: indirectParamsSize,
          maxDrawCount: kMaxUnsignedLongValue,
          _valid: false,
        },
      ] as const;
    })
  )
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase('chromium-experimental-multi-draw-indirect' as GPUFeatureName);
  })
  .fn(t => {
    const {
      indexed,
      bufferSize,
      indirectOffset,
      drawCountOffset = 0,
      maxDrawCount = 1,
      useDrawCountBuffer = false,
      _valid,
    } = t.params;

    const indirectBuffer = t.createBufferTracked({
      size: bufferSize,
      usage: GPUBufferUsage.INDIRECT,
    });

    const { encoder, validateFinish } = t.createEncoder('render pass');
    encoder.setPipeline(t.createNoOpRenderPipeline());
    if (indexed) {
      encoder.setIndexBuffer(t.makeIndexBuffer(), 'uint32');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (encoder as any).multiDrawIndexedIndirect(
        indirectBuffer,
        indirectOffset,
        maxDrawCount,
        useDrawCountBuffer ? indirectBuffer : undefined,
        drawCountOffset
      );
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (encoder as any).multiDrawIndirect(
        indirectBuffer,
        indirectOffset,
        maxDrawCount,
        useDrawCountBuffer ? indirectBuffer : undefined,
        drawCountOffset
      );
    }

    validateFinish(_valid);
  });
