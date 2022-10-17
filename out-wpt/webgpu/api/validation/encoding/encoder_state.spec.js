/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ export const description = `
TODO:
- createCommandEncoder
- non-pass command, or beginPass, during {render, compute} pass
- {before (control case), after} finish()
    - x= {finish(), ... all non-pass commands}
- {before (control case), after} end()
    - x= {render, compute} pass
    - x= {finish(), ... all relevant pass commands}
    - x= {
        - before endPass (control case)
        - after endPass (no pass open)
        - after endPass+beginPass (a new pass of the same type is open)
        - }
    - should make whole encoder invalid
- ?
`;
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ValidationTest } from '../validation_test.js';

class F extends ValidationTest {
  beginRenderPass(commandEncoder) {
    const attachmentTexture = this.device.createTexture({
      format: 'rgba8unorm',
      size: { width: 16, height: 16, depthOrArrayLayers: 1 },
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.trackForCleanup(attachmentTexture);
    return commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: attachmentTexture.createView(),
          clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
  }
}

export const g = makeTestGroup(F);

g.test('pass_end_invalid_order')
  .desc(
    `
  Test that beginning a  {compute,render} pass before ending the previous {compute,render} pass
  causes an error.

  TODO: Need to add a control case to be sure a validation error happens because of ending order.
  `
  )
  .paramsSubcasesOnly(u =>
    u
      .combine('pass0Type', ['compute', 'render'])
      .combine('pass1Type', ['compute', 'render'])
      .combine('endPasses', [[], [0], [1], [0, 1], [1, 0]])
  )
  .fn(async t => {
    const { pass0Type, pass1Type, endPasses } = t.params;

    const encoder = t.device.createCommandEncoder();

    const firstPass =
      pass0Type === 'compute' ? encoder.beginComputePass() : t.beginRenderPass(encoder);

    // Begin a second pass before ending the previous pass.
    const secondPass =
      pass1Type === 'compute' ? encoder.beginComputePass() : t.beginRenderPass(encoder);

    const passes = [firstPass, secondPass];
    for (const index of endPasses) {
      passes[index].end();
    }

    t.expectValidationError(() => {
      encoder.finish();
    }, true);
  });

g.test('call_after_successful_finish')
  .desc(`Test that encoding command after a successful finish generates a validation error.`)
  .paramsSubcasesOnly(u =>
    u.combine('passType', ['compute', 'render']).combine('IsEncoderFinished', [false, true])
  )
  .fn(async t => {
    const { passType, IsEncoderFinished } = t.params;

    const encoder = t.device.createCommandEncoder();

    const pass = passType === 'compute' ? encoder.beginComputePass() : t.beginRenderPass(encoder);
    pass.end();

    const srcBuffer = t.device.createBuffer({
      size: 1024,
      usage: GPUBufferUsage.COPY_SRC,
    });

    const dstBuffer = t.device.createBuffer({
      size: 1024,
      usage: GPUBufferUsage.COPY_DST,
    });

    if (IsEncoderFinished) {
      encoder.finish();
      t.expectValidationError(() => {
        encoder.copyBufferToBuffer(srcBuffer, 0, dstBuffer, 0, 0);
      }, IsEncoderFinished);
    } else {
      t.expectValidationError(() => {
        encoder.copyBufferToBuffer(srcBuffer, 0, dstBuffer, 0, 0);
      }, IsEncoderFinished);
      encoder.finish();
    }
  });
