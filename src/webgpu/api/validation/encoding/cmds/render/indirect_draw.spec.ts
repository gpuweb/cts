export const description = `
Validation tests for drawIndirect/drawIndexedIndirect on render pass and render bundle.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUConst } from '../../../../../constants.js';
import { ValidationTest } from '../../../validation_test.js';

import { kRenderEncodeTypeParams, kBufferStates } from './render.js';

const kIndirectDrawTestParams = kRenderEncodeTypeParams.combine('indexed', [true, false] as const);

class F extends ValidationTest {
  private renderPipeline: GPURenderPipeline | undefined;
  private idxBuffer: GPUBuffer | undefined;

  get pipeline(): GPURenderPipeline {
    if (this.renderPipeline === undefined) {
      this.renderPipeline = this.createNoOpRenderPipeline();
    }

    return this.renderPipeline;
  }

  get indexBuffer(): GPUBuffer {
    if (this.idxBuffer === undefined) {
      this.idxBuffer = this.device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.INDEX,
      });
    }

    return this.idxBuffer;
  }
}

export const g = makeTestGroup(F);

g.test('indirect_buffer')
  .desc(
    `
Tests indirect buffer must be valid.
  `
  )
  .paramsSubcasesOnly(kIndirectDrawTestParams.combine('state', kBufferStates))
  .fn(t => {
    const { encoderType, indexed, state } = t.params;
    const indirectBuffer = t.createBufferWithState(state, {
      size: 256,
      usage: GPUBufferUsage.INDIRECT,
    });

    const { encoder, finish } = t.createEncoder(encoderType);
    encoder.setPipeline(t.pipeline);
    if (indexed) {
      encoder.setIndexBuffer(t.indexBuffer, 'uint32');
      encoder.drawIndexedIndirect(indirectBuffer, 0);
    } else {
      encoder.drawIndirect(indirectBuffer, 0);
    }

    t.expectValidationError(() => {
      t.queue.submit([finish()]);
    }, state !== 'valid');
  });

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
  .fn(t => {
    const { encoderType, indexed, usage } = t.params;
    const indirectBuffer = t.device.createBuffer({
      size: 256,
      usage,
    });

    const { encoder, finish } = t.createEncoder(encoderType);
    encoder.setPipeline(t.pipeline);
    if (indexed) {
      encoder.setIndexBuffer(t.indexBuffer, 'uint32');
      encoder.drawIndexedIndirect(indirectBuffer, 0);
    } else {
      encoder.drawIndirect(indirectBuffer, 0);
    }

    t.expectValidationError(() => {
      finish();
    }, (usage | GPUConst.BufferUsage.INDIRECT) !== usage);
  });

g.test('indirect_offset_alignment')
  .desc(
    `
Tests indirect offset must be a multiple of 4.
  `
  )
  .paramsSubcasesOnly(kIndirectDrawTestParams.combine('indirectOffset', [0, 2, 4] as const))
  .fn(t => {
    const { encoderType, indexed, indirectOffset } = t.params;
    const indirectBuffer = t.device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.INDIRECT,
    });

    const { encoder, finish } = t.createEncoder(encoderType);
    encoder.setPipeline(t.pipeline);
    if (indexed) {
      encoder.setIndexBuffer(t.indexBuffer, 'uint32');
      encoder.drawIndexedIndirect(indirectBuffer, indirectOffset);
    } else {
      encoder.drawIndirect(indirectBuffer, indirectOffset);
    }

    t.expectValidationError(() => {
      finish();
    }, indirectOffset % 4 !== 0);
  });

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
        { indirectOffset: 0, bufferSize: 0, _valid: false },
        { indirectOffset: 0, bufferSize: indirectParamsSize, _valid: true },
        { indirectOffset: 0, bufferSize: indirectParamsSize + 1, _valid: true },
        { indirectOffset: 0, bufferSize: indirectParamsSize - 1, _valid: false },
        { indirectOffset: 0, bufferSize: indirectParamsSize - 4, _valid: false },
        { indirectOffset: 4, bufferSize: indirectParamsSize + 4, _valid: true },
        { indirectOffset: 4, bufferSize: indirectParamsSize + 3, _valid: false },
        { indirectOffset: 3, bufferSize: indirectParamsSize + 4, _valid: false },
        { indirectOffset: 5, bufferSize: indirectParamsSize + 4, _valid: false },
        { indirectOffset: indirectParamsSize, bufferSize: indirectParamsSize, _valid: false },
        { indirectOffset: indirectParamsSize + 4, bufferSize: indirectParamsSize, _valid: false },
      ] as const;
    })
  )
  .fn(t => {
    const { encoderType, indexed, indirectOffset, bufferSize, _valid } = t.params;
    const indirectBuffer = t.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.INDIRECT,
    });

    const { encoder, finish } = t.createEncoder(encoderType);
    encoder.setPipeline(t.pipeline);
    if (indexed) {
      encoder.setIndexBuffer(t.indexBuffer, 'uint32');
      encoder.drawIndexedIndirect(indirectBuffer, indirectOffset);
    } else {
      encoder.drawIndirect(indirectBuffer, indirectOffset);
    }

    t.expectValidationError(() => {
      finish();
    }, !_valid);
  });
