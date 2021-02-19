export const description = `
Tests using a destroyed query set on a queue.

- used in {resolveQuerySet, timestamp {compute, render, non-pass},
    pipeline statistics {compute, render}, occlusion}
- x= {destroyed, not destroyed (control case)}

TODO: implement. (Search for other places some of these cases may have already been tested.)
Consider whether these tests should be distributed throughout the suite, instead of centralized.
`;

import { params, pbool, poptions } from '../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { ValidationTest } from '../../validation_test.js';

export const enum EncoderType {
  CommandEncoder = 'CommandEncoder',
  ComputeEncoder = 'ComputeEncoder',
  RenderEncoder = 'RenderEncoder',
}

export const g = makeTestGroup(ValidationTest);

g.test('writeTimestamp')
  .desc(
    `
Tests that use a destroyed query set in writeTimestamp on {compute, render, non-pass} encoder.
- x= {destroyed, not destroyed (control case)}
  `
  )
  .params(
    params()
      .combine(
        poptions('encoderType', [
          EncoderType.CommandEncoder,
          EncoderType.ComputeEncoder,
          EncoderType.RenderEncoder,
        ] as const)
      )
      .combine(pbool('destroyed'))
  )
  .fn(async t => {
    await t.selectDeviceOrSkipTestCase({ extensions: ['timestamp-query'] });

    const querySet = t.device.createQuerySet({ type: 'timestamp', count: 2 });

    if (t.params.destroyed) {
      querySet.destroy();
    }

    const encoder = t.device.createCommandEncoder();

    switch (t.params.encoderType) {
      case EncoderType.CommandEncoder: {
        encoder.writeTimestamp(querySet, 0);
        break;
      }
      case EncoderType.ComputeEncoder: {
        const pass = encoder.beginComputePass();
        pass.writeTimestamp(querySet, 0);
        pass.endPass();
        break;
      }
      case EncoderType.RenderEncoder: {
        const colorAttachment = t.device.createTexture({
          format: 'rgba8unorm',
          size: { width: 4, height: 4, depth: 1 },
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              attachment: colorAttachment.createView(),
              loadValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
            },
          ],
        });
        pass.writeTimestamp(querySet, 0);
        pass.endPass();
        break;
      }
    }

    t.expectValidationError(() => {
      t.queue.submit([encoder.finish()]);
    }, t.params.destroyed);
  });

g.test('resolveQuerySet')
  .desc(
    `
Tests that use a destroyed query set in resolveQuerySet.
- x= {destroyed, not destroyed (control case)}
  `
  )
  .params(pbool('destroyed'))
  .fn(async t => {
    const querySet = t.device.createQuerySet({
      type: 'occlusion',
      count: 1,
    });

    if (t.params.destroyed) {
      querySet.destroy();
    }

    const buffer = t.device.createBuffer({ size: 8, usage: GPUBufferUsage.QUERY_RESOLVE });

    const encoder = t.device.createCommandEncoder();
    encoder.resolveQuerySet(querySet, 0, 1, buffer, 0);

    t.expectValidationError(() => {
      t.queue.submit([encoder.finish()]);
    }, t.params.destroyed);
  });
