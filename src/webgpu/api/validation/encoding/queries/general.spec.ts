export const description = `
TODO:

- For each way to start a query (all possible types in all possible encoders):
    - queryIndex {in, out of} range for GPUQuerySet
    - GPUQuerySet {valid, invalid}
        - or {undefined}, for occlusionQuerySet
    - x = {occlusion, pipeline statistics, timestamp} query
`;

import { params, poptions } from '../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { kQueryTypes } from '../../../../capability_info.js';
import { ValidationTest } from '../../validation_test.js';

async function selectDeviceForQueryType(t: ValidationTest, type: GPUQueryType): Promise<void> {
  const extensions: GPUExtensionName[] = [];
  if (type === 'pipeline-statistics') {
    extensions.push('pipeline-statistics-query');
  } else if (type === 'timestamp') {
    extensions.push('timestamp-query');
  }

  await t.selectDeviceOrSkipTestCase({ extensions });
}

export const enum EncoderType {
  CommandEncoder = 'CommandEncoder',
  ComputeEncoder = 'ComputeEncoder',
  RenderEncoder = 'RenderEncoder',
}

export const g = makeTestGroup(ValidationTest);

g.test('writeTimestamp')
  .desc(
    `
Tests that write timestamp to all types of query set on all possible encoders:
- queryIndex {in, out of} range for GPUQuerySet
- GPUQuerySet {valid, invalid}
- x= {occlusion, pipeline statistics, timestamp} query
- x= {compute, render, non-pass} enconder
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
      .combine(poptions('type', kQueryTypes))
      .combine(poptions('queryIndex', [0, 1, 2]))
      .unless(({ type, queryIndex }) => type !== 'timestamp' && queryIndex !== 0)
  )
  .fn(async t => {
    const { encoderType, type, queryIndex } = t.params;

    await selectDeviceForQueryType(t, type);

    const count = 2;
    const pipelineStatistics =
      type === 'pipeline-statistics' ? (['clipper-invocations'] as const) : ([] as const);
    const querySet = t.device.createQuerySet({ type, count, pipelineStatistics });

    const encoder = t.device.createCommandEncoder();

    switch (encoderType) {
      case EncoderType.CommandEncoder: {
        encoder.writeTimestamp(querySet, queryIndex);
        break;
      }
      case EncoderType.ComputeEncoder: {
        const pass = encoder.beginComputePass();
        pass.writeTimestamp(querySet, queryIndex);
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
        pass.writeTimestamp(querySet, queryIndex);
        pass.endPass();
        break;
      }
    }

    t.expectValidationError(() => {
      encoder.finish();
    }, type !== 'timestamp' || queryIndex >= count);
  });
