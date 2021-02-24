export const description = `
copyTextureToBuffer and copyBufferToTexture validation tests not covered by
copy_between_linear_data_and_texture or destroyed,*.

TODO: plan
`;

import { poptions, params } from '../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { kDepthStencilFormats } from '../../../../capability_info.js';
import { ValidationTest } from '../../validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('depth_stencil_format,copy_usage_and_aspect')
  .desc(
    `
  Validate the combination of usage and aspect of each depth stencil format in copyBufferToTexture
  and copyTextureToBuffer. See https://gpuweb.github.io/gpuweb/#depth-formats for more details.
  TODO(jiawei.shao@intel.com): add tests on depth16norm when it is supported.
`
  )
  .cases(
    params()
      .combine(poptions('format', kDepthStencilFormats))
      .combine(poptions('aspect', ['all', 'depth-only', 'stencil-only'] as const))
  )
  .fn(async t => {
    const { format, aspect } = t.params;

    const textureSize = { width: 1, height: 1, depth: 1 };
    const texture = t.device.createTexture({
      size: textureSize,
      format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    const buffer = t.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    const emptyStringArray: string[] = [];

    const kDepthStencilFormatCapabilityInBufferTextureCopy = {
      // kUnsizedDepthStencilFormats
      depth24plus: {
        AspectsSupportedInB2T: emptyStringArray,
        AspectsSupportedInT2B: emptyStringArray,
      },
      'depth24plus-stencil8': {
        AspectsSupportedInB2T: ['stencil-only'],
        AspectsSupportedInT2B: ['stencil-only'],
      },

      // kSizedDepthStencilFormats
      depth32float: {
        AspectsSupportedInB2T: emptyStringArray,
        AspectsSupportedInT2B: ['all', 'depth-only'],
      },
      stencil8: {
        AspectsSupportedInB2T: ['all', 'stencil-only'],
        AspectsSupportedInT2B: ['all', 'stencil-only'],
      },
    };

    {
      const success = kDepthStencilFormatCapabilityInBufferTextureCopy[
        format
      ].AspectsSupportedInB2T.includes(aspect);

      const encoder = t.device.createCommandEncoder();
      encoder.copyBufferToTexture({ buffer }, { texture, aspect }, textureSize);

      t.expectValidationError(() => {
        t.device.queue.submit([encoder.finish()]);
      }, !success);
    }

    {
      const success = kDepthStencilFormatCapabilityInBufferTextureCopy[
        format
      ].AspectsSupportedInT2B.includes(aspect);

      const encoder = t.device.createCommandEncoder();
      encoder.copyTextureToBuffer({ texture, aspect }, { buffer }, textureSize);

      t.expectValidationError(() => {
        t.device.queue.submit([encoder.finish()]);
      }, !success);
    }
  });
