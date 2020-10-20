export const description = `
API validation test for compute pass
`;

import { params, poptions } from '../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../common/framework/test_group.js';

import { ValidationTest } from './../../validation_test.js';

class F extends ValidationTest {
  createComputePipeline(state: 'valid' | 'invalid'): GPUComputePipeline {
    if (state === 'valid') {
      return this.createNoOpComputePipeline();
    }

    return this.createErrorComputePipeline();
  }

  createIndirectBuffer(state: 'valid' | 'invalid' | 'destroyed', data: Uint32Array): GPUBuffer {
    const descriptor: GPUBufferDescriptor = {
      size: data.byteLength,
      usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST,
    };

    if (state === 'invalid') {
      descriptor.usage = 0xffff; // Invalid GPUBufferUsage
    }

    this.device.pushErrorScope('validation');
    const buffer = this.device.createBuffer(descriptor);
    this.device.popErrorScope();

    if (state === 'valid') {
      this.queue.writeBuffer(buffer, 0, data);
    }

    if (state === 'destroyed') {
      buffer.destroy();
    }

    return buffer;
  }
}

export const g = makeTestGroup(F);

g.test('set_pipeline')
  .desc(
    `- Tests using compute pipelines
  - An error should be generated when using an 'invalid' pipeline`
  )
  .params(poptions('state', ['valid', 'invalid'] as const))
  .fn(t => {
    const pipeline = t.createComputePipeline(t.params.state);
    const { encoder, finish } = t.createEncoder('compute pass');
    encoder.setPipeline(pipeline);
    t.expectValidationError(() => {
      finish();
    }, t.params.state === 'invalid');
  });

g.test('dispatch_sizes')
  .desc(
    `- For both 'direct' and 'indirect' dispatch
  - Tests using the following workgroup sizes: {[0, 0, 0], [1, 1, 1]}
  - An error should occur when the number exceeds <fill number here>`
  )
  .params(
    params()
      .combine(poptions('dispatchType', ['direct', 'indirect'] as const))
      .combine(
        poptions('workSizes', [
          [0, 0, 0],
          [1, 1, 1],
          // TODO: Add tests for workSizes right under and above upper limit once the limit has been decided.
        ] as [number, number, number][])
      )
  )
  .fn(t => {
    const pipeline = t.createNoOpComputePipeline();
    const [x, y, z] = t.params.workSizes;
    const { encoder, finish } = t.createEncoder('compute pass');
    encoder.setPipeline(pipeline);
    if (t.params.dispatchType === 'direct') {
      encoder.dispatch(x, y, z);
    } else if (t.params.dispatchType === 'indirect') {
      encoder.dispatchIndirect(t.createIndirectBuffer('valid', new Uint32Array([x, y, z])), 0);
    }
    t.queue.submit([finish()]);
  });

const kBufferData = new Uint32Array(6).fill(1);
g.test('indirect_dispatch_buffer')
  .desc(
    `- For 'indirect' dispatch
  - Tests that indirect buffers:
    - 'invalid', 'destroyed' generate an error
    - 'valid' buffers do not generate an error
  - Tests that, for a buffer with 6 elements, indirect offsets:
    - 0, 'sizeof(uint32)', and '3 * sizeof(uint32)' do not generate an error
    - An error should be generate by the following:
      - 1: non-multiple of 4
      - '4 * sizeof(uint32): z-components outside of buffer`
  )
  .params(
    params()
      .combine(poptions('state', ['valid', 'invalid', 'destroyed'] as const))
      .combine(
        poptions('offset', [
          0, // valid for 'valid' buffers
          Uint32Array.BYTES_PER_ELEMENT, // valid for 'valid' buffers
          kBufferData.byteLength - 3 * Uint32Array.BYTES_PER_ELEMENT, // valid for 'valid' buffers
          1, // invalid, non-multiple of 4 offset
          kBufferData.byteLength - Uint32Array.BYTES_PER_ELEMENT, // invalid, last element outside buffer
        ])
      )
  )
  .fn(t => {
    const { state, offset } = t.params;
    const pipeline = t.createNoOpComputePipeline();
    const buffer = t.createIndirectBuffer(state, kBufferData);
    const { encoder, finish } = t.createEncoder('compute pass');
    encoder.setPipeline(pipeline);
    t.expectValidationError(() => {
      encoder.dispatchIndirect(buffer, offset);
      t.queue.submit([finish()]);
    }, state !== 'valid' || offset % 4 !== 0 || offset + 3 * Uint32Array.BYTES_PER_ELEMENT > kBufferData.byteLength);
  });
