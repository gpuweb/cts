export const description = `
copyTextureToBuffer and copyBufferToTexture validation tests not covered by
the general image_copy tests, or by destroyed,*.

TODO: plan further
`;

import { poptions, params } from '../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import {
  kDepthStencilFormats,
  depthStencilBufferTextureCopySupported,
} from '../../../../capability_info.js';
import { ValidationTest } from '../../validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('depth_stencil_format,copy_usage_and_aspect')
  .desc(
    `
  Validate the combination of usage and aspect of each depth stencil format in copyBufferToTexture
  and copyTextureToBuffer. See https://gpuweb.github.io/gpuweb/#depth-formats for more details.
`
  )
  .cases(
    params()
      .combine(poptions('format', kDepthStencilFormats))
      .combine(poptions('aspect', ['all', 'depth-only', 'stencil-only'] as const))
  )
  .fn(async t => {
    const { format, aspect } = t.params;

    const textureSize = { width: 1, height: 1, depthOrArrayLayers: 1 };
    const texture = t.device.createTexture({
      size: textureSize,
      format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    const buffer = t.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    {
      const success = depthStencilBufferTextureCopySupported('CopyB2T', format, aspect);

      const encoder = t.device.createCommandEncoder();
      encoder.copyBufferToTexture({ buffer }, { texture, aspect }, textureSize);

      t.expectValidationError(() => {
        t.device.queue.submit([encoder.finish()]);
      }, !success);
    }

    {
      const success = depthStencilBufferTextureCopySupported('CopyT2B', format, aspect);

      const encoder = t.device.createCommandEncoder();
      encoder.copyTextureToBuffer({ texture, aspect }, { buffer }, textureSize);

      t.expectValidationError(() => {
        t.device.queue.submit([encoder.finish()]);
      }, !success);
    }
  });
