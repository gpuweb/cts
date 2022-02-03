export const description = `Validation tests for device lost induced via destroy.`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import {
  kBufferUsageTypes,
  kBufferUsageTypesInfo,
  kBufferUsageCopy,
  kBufferUsageCopyInfo,
  kTextureUsageType,
  kTextureUsageTypeInfo,
  kTextureUsageCopy,
  kTextureUsageCopyInfo,
  kRegularTextureFormats,
  kCompressedTextureFormats,
  kTextureFormatInfo,
} from '../../../../capability_info.js';
import { ValidationTest } from '../../validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('createBuffer')
  .desc(`A destroyed device should not be able to create any valid buffers.`)
  .params(u =>
    u
      .combine('usageType', kBufferUsageTypes)
      .beginSubcases()
      .combine('usageCopy', kBufferUsageCopy)
      .filter(({ usageType, usageCopy }) => {
        if (usageType === 'map-read') {
          return usageCopy === 'none' || usageCopy === 'dst';
        }
        if (usageType === 'map-write') {
          return usageCopy === 'none' || usageCopy === 'src';
        }
        return true;
      })
      .combine('mappedAtCreation', [true, false])
  )
  .fn(async t => {
    const { usageType, usageCopy, mappedAtCreation } = t.params;
    t.device.destroy();
    t.expectValidationError(() => {
      t.device.createBuffer({
        size: 16,
        usage: kBufferUsageTypesInfo[usageType] | kBufferUsageCopyInfo[usageCopy],
        mappedAtCreation,
      });
    });
  });

g.test('createTexture,2d,uncompressed_format')
  .desc(`A destroyed device should not be able to create any valid 2d uncompressed textures.`)
  .params(u =>
    u
      .combine('format', kRegularTextureFormats)
      .beginSubcases()
      .combine('usageType', kTextureUsageType)
      .combine('usageCopy', kTextureUsageCopy)
      .filter(({ format, usageType }) => {
        const info = kTextureFormatInfo[format];
        return !(
          (!info.renderable && usageType === 'render') ||
          (!info.storage && usageType === 'storage')
        );
      })
  )
  .fn(async t => {
    const { format, usageType, usageCopy } = t.params;
    const { blockWidth, blockHeight } = kTextureFormatInfo[format];
    t.device.destroy();
    t.expectValidationError(() => {
      t.device.createTexture({
        size: { width: blockWidth, height: blockHeight },
        usage: kTextureUsageTypeInfo[usageType] | kTextureUsageCopyInfo[usageCopy],
        format,
      });
    });
  });

g.test('createTexture,2d,compressed_format')
  .desc(`A destroyed device should not be able to create any valid 2d compressed textures.`)
  .params(u =>
    u
      .combine('format', kCompressedTextureFormats)
      .beginSubcases()
      .combine('usageType', kTextureUsageType)
      .combine('usageCopy', kTextureUsageCopy)
      .filter(({ format, usageType }) => {
        const info = kTextureFormatInfo[format];
        return !(
          (!info.renderable && usageType === 'render') ||
          (!info.storage && usageType === 'storage')
        );
      })
  )
  .fn(async t => {
    const { format, usageType, usageCopy } = t.params;
    const { blockWidth, blockHeight, feature } = kTextureFormatInfo[format];
    await t.selectDeviceOrSkipTestCase(feature);
    t.device.destroy();
    t.expectValidationError(() => {
      t.device.createTexture({
        size: { width: blockWidth, height: blockHeight },
        usage: kTextureUsageTypeInfo[usageType] | kTextureUsageCopyInfo[usageCopy],
        format,
      });
    });
  });

g.test('createView,2d,uncompressed_format')
  .desc(
    `A texture from a destroyed device should not be able to create any valid 2d uncompressed texture views.`
  )
  .params(u =>
    u
      .combine('format', kRegularTextureFormats)
      .beginSubcases()
      .combine('usageType', kTextureUsageType)
      .combine('usageCopy', kTextureUsageCopy)
      .filter(({ format, usageType }) => {
        const info = kTextureFormatInfo[format];
        return !(
          (!info.renderable && usageType === 'render') ||
          (!info.storage && usageType === 'storage')
        );
      })
  )
  .fn(async t => {
    const { format, usageType, usageCopy } = t.params;
    const { blockWidth, blockHeight } = kTextureFormatInfo[format];
    const texture = t.device.createTexture({
      size: { width: blockWidth, height: blockHeight },
      usage: kTextureUsageTypeInfo[usageType] | kTextureUsageCopyInfo[usageCopy],
      format,
    });

    t.device.destroy();
    t.expectValidationError(() => {
      texture.createView({ format });
    });
  });

g.test('createView,2d,compressed_format')
  .desc(
    `A texture from a destroyed device should not be able to create any valid 2d compressed texture views.`
  )
  .params(u =>
    u
      .combine('format', kCompressedTextureFormats)
      .beginSubcases()
      .combine('usageType', kTextureUsageType)
      .combine('usageCopy', kTextureUsageCopy)
      .filter(({ format, usageType }) => {
        const info = kTextureFormatInfo[format];
        return !(
          (!info.renderable && usageType === 'render') ||
          (!info.storage && usageType === 'storage')
        );
      })
  )
  .fn(async t => {
    const { format, usageType, usageCopy } = t.params;
    const { blockWidth, blockHeight, feature } = kTextureFormatInfo[format];
    await t.selectDeviceOrSkipTestCase(feature);
    const texture = t.device.createTexture({
      size: { width: blockWidth, height: blockHeight },
      usage: kTextureUsageTypeInfo[usageType] | kTextureUsageCopyInfo[usageCopy],
      format,
    });

    t.device.destroy();
    t.expectValidationError(() => {
      texture.createView({ format });
    });
  });

g.test('createSampler')
  .desc(`A destroyed device should not be able to create any valid samplers.`)
  .fn(async t => {
    t.device.destroy();
    t.expectValidationError(() => {
      t.device.createSampler({});
    });
  });
