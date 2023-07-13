export const description = `
Tests limitations of copyTextureToBuffer in compat mode.
`;

import { makeTestGroup } from '../../../../../common/internal/test_group.js';
import { ValidationTest } from '../../../../../webgpu/api/validation/validation_test.js';
import {
  kCompressedTextureFormats,
  kTextureFormatInfo,
} from '../../../../../webgpu/format_info.js';
import { align } from '../../../../../webgpu/util/math.js';

export const g = makeTestGroup(ValidationTest);

g.test('compressed')
  .desc(`Tests that you can not call copyTextureToBuffer with compressed textures in compat mode.`)
  .params(u => u.combine('format', kCompressedTextureFormats))
  .beforeAllSubcases(t => {
    const { format } = t.params;
    t.selectDeviceOrSkipTestCase([kTextureFormatInfo[format].feature]);
  })
  .fn(t => {
    const { format } = t.params;

    const { blockWidth, blockHeight, bytesPerBlock } = kTextureFormatInfo[format];

    const texture = t.device.createTexture({
      size: [blockWidth, blockHeight, 1],
      format,
      usage: GPUTextureUsage.COPY_SRC,
    });
    t.trackForCleanup(texture);

    const bytesPerRow = align(bytesPerBlock, 256);

    const buffer = t.device.createBuffer({
      size: bytesPerRow,
      usage: GPUBufferUsage.COPY_DST,
    });
    t.trackForCleanup(buffer);

    const encoder = t.device.createCommandEncoder();
    encoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow }, [blockWidth, blockHeight, 1]);
    t.expectGPUError('validation', () => {
      encoder.finish();
    });
  });
