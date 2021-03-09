export const description = `
API validation test for compute pass

Does **not** test usage scopes (resource_usages/) or programmable pass stuff (programmable_pass).
`;

import { params, poptions } from '../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { ValidationTest } from '../../validation_test.js';

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
    `
setPipeline should generate an error iff using an 'invalid' pipeline.
`
  )
  .params(poptions('state', ['valid', 'invalid'] as const))
  .fn(t => {
    const pipeline = t.createComputePipeline(t.params.state);

    const encoder = t.device.createCommandEncoder();
    {
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.endPass();
    }
    t.expectValidationError(() => {
      encoder.finish();
    }, t.params.state === 'invalid');
  });

g.test('dispatch_sizes')
  .desc(
    `
Test 'direct' and 'indirect' dispatch with various sizes.
  - workgroup sizes:
    - valid, {[0, 0, 0], [1, 1, 1]}
    - invalid, TODO: workSizes {x,y,z} just under and above limit, once limit is established.
`
  )
  .params(
    params()
      .combine(poptions('dispatchType', ['direct', 'indirect'] as const))
      .combine(
        poptions('workSizes', [
          [0, 0, 0],
          [1, 1, 1],
        ] as const)
      )
  )
  .fn(t => {
    const pipeline = t.createNoOpComputePipeline();
    const [x, y, z] = t.params.workSizes;

    const encoder = t.device.createCommandEncoder();
    {
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      if (t.params.dispatchType === 'direct') {
        pass.dispatch(x, y, z);
      } else if (t.params.dispatchType === 'indirect') {
        pass.dispatchIndirect(t.createIndirectBuffer('valid', new Uint32Array([x, y, z])), 0);
      }
      pass.endPass();
    }
    t.queue.submit([encoder.finish()]);
  });

const kBufferData = new Uint32Array(6).fill(1);
g.test('indirect_dispatch_buffer')
  .desc(
    `
Test dispatchIndirect validation by submitting various dispatches with a no-op pipeline and an
indirectBuffer with 6 elements.
- indirectBuffer: {'valid', 'invalid'} ('destroyed' tested in destroyed/buffer.spec.ts)
- indirectOffset:
  - valid, within the buffer: {beginning, middle, end} of the buffer
  - invalid, non-multiple of 4
  - invalid, the last element is outside the buffer

TODO: test specifically which call the validation error occurs in.
      (Should be finish() for invalid, but submit() for destroyed.)
`
  )
  .params(
    params()
      .combine(poptions('state', ['valid', 'invalid'] as const))
      .combine(
        poptions('offset', [
          // valid (for 'valid' buffers)
          0,
          Uint32Array.BYTES_PER_ELEMENT,
          kBufferData.byteLength - 3 * Uint32Array.BYTES_PER_ELEMENT,
          // invalid, non-multiple of 4 offset
          1,
          // invalid, last element outside buffer
          kBufferData.byteLength - 2 * Uint32Array.BYTES_PER_ELEMENT,
        ])
      )
  )
  .fn(t => {
    const { state, offset } = t.params;
    const pipeline = t.createNoOpComputePipeline();
    const buffer = t.createIndirectBuffer(state, kBufferData);

    const encoder = t.device.createCommandEncoder();
    {
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.dispatchIndirect(buffer, offset);
    }

    t.expectValidationError(() => {
      encoder.finish();
    }, state !== 'valid' || offset % 4 !== 0 || offset + 3 * Uint32Array.BYTES_PER_ELEMENT > kBufferData.byteLength);
  });
