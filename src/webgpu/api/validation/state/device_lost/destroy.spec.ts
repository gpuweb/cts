export const description = `
Validation tests for device lost induced via destroy.
  - Tests that prior to device destruction, valid APIs do not generate errors (control case).
  - Tests that after device destruction, the same APIs generate validation errors (failure case).
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import {
  allBindingEntries,
  bindingTypeInfo,
  kBindableResources,
  kBufferUsageKeys,
  kBufferUsageInfo,
  kBufferUsageCopy,
  kBufferUsageCopyInfo,
  kCompressedTextureFormats,
  kTextureUsageType,
  kTextureUsageTypeInfo,
  kTextureUsageCopy,
  kTextureUsageCopyInfo,
  kRegularTextureFormats,
  kRenderableColorTextureFormats,
  kShaderStageKeys,
  kTextureFormatInfo,
  kQueryTypes,
} from '../../../../capability_info.js';
import { ValidationTest } from '../../validation_test.js';

class DeviceDestroyTests extends ValidationTest {
  /**
   * Expects that `fn` does not produce any errors before the device is destroyed, and that `fn`
   * produces a validation error after the device is destroyed.
   */
  expectValidationErrorAfterDestroy(fn: () => void): void {
    this.expectDeviceLost('destroyed');

    this.expectValidationError(fn, false);
    this.device.destroy();
    this.expectValidationError(fn);
  }
}

export const g = makeTestGroup(DeviceDestroyTests);

g.test('createBuffer')
  .desc(
    `
Tests creating buffers on destroyed device fails. Tests valid combinations of:
  - Various usages
  - Mapped at creation or not
  `
  )
  .params(u =>
    u
      .combine('usageType', kBufferUsageKeys)
      .beginSubcases()
      .combine('usageCopy', kBufferUsageCopy)
      .filter(({ usageType, usageCopy }) => {
        if (usageType === 'COPY_SRC' || usageType === 'COPY_DST') {
          return false;
        }
        if (usageType === 'MAP_READ') {
          return usageCopy === 'COPY_NONE' || usageCopy === 'COPY_DST';
        }
        if (usageType === 'MAP_WRITE') {
          return usageCopy === 'COPY_NONE' || usageCopy === 'COPY_SRC';
        }
        return true;
      })
      .combine('mappedAtCreation', [true, false])
  )
  .fn(async t => {
    const { usageType, usageCopy, mappedAtCreation } = t.params;
    t.expectValidationErrorAfterDestroy(() => {
      t.device.createBuffer({
        size: 16,
        usage: kBufferUsageInfo[usageType] | kBufferUsageCopyInfo[usageCopy],
        mappedAtCreation,
      });
    });
  });

g.test('createTexture,2d,uncompressed_format')
  .desc(
    `
Tests creating 2d uncompressed textures on destroyed device fails. Tests valid combinations of:
  - Various uncompressed texture formats
  - Various usages
  `
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
    t.expectValidationErrorAfterDestroy(() => {
      t.device.createTexture({
        size: { width: blockWidth, height: blockHeight },
        usage: kTextureUsageTypeInfo[usageType] | kTextureUsageCopyInfo[usageCopy],
        format,
      });
    });
  });

g.test('createTexture,2d,compressed_format')
  .desc(
    `
Tests creating 2d compressed textures on destroyed device fails. Tests valid combinations of:
  - Various compressed texture formats
  - Various usages
  `
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
    t.expectValidationErrorAfterDestroy(() => {
      t.device.createTexture({
        size: { width: blockWidth, height: blockHeight },
        usage: kTextureUsageTypeInfo[usageType] | kTextureUsageCopyInfo[usageCopy],
        format,
      });
    });
  });

g.test('createView,2d,uncompressed_format')
  .desc(
    `
Tests creating texture views on 2d uncompressed textures from destroyed device fails. Tests valid combinations of:
  - Various uncompressed texture formats
  - Various usages
  `
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
    t.expectValidationErrorAfterDestroy(() => {
      texture.createView({ format });
    });
  });

g.test('createView,2d,compressed_format')
  .desc(
    `
Tests creating texture views on 2d compressed textures from destroyed device fails. Tests valid combinations of:
  - Various compressed texture formats
  - Various usages
  `
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
    t.expectValidationErrorAfterDestroy(() => {
      texture.createView({ format });
    });
  });

g.test('createSampler')
  .desc(
    `
Tests creating samplers on destroyed device fails.
  `
  )
  .fn(async t => {
    t.expectValidationErrorAfterDestroy(() => {
      t.device.createSampler();
    });
  });

g.test('createBindGroupLayout')
  .desc(
    `
Tests creating bind group layouts on destroyed device fails. Tests valid combinations of:
  - Various valid binding entries
  - Maximum set of visibility for each binding entry
  `
  )
  .params(u => u.combine('entry', allBindingEntries(false)))
  .fn(async t => {
    const { entry } = t.params;
    const visibility = bindingTypeInfo(entry).validStages;
    t.expectValidationErrorAfterDestroy(() => {
      t.device.createBindGroupLayout({
        entries: [{ binding: 0, visibility, ...entry }],
      });
    });
  });

g.test('createBindGroup')
  .desc(
    `
Tests creating bind group on destroyed device fails. Tests valid combinations of:
  - Various binded resource types
  - Various valid binding entries
  - Maximum set of visibility for each binding entry
  `
  )
  .desc(`A destroyed device should not be able to create any valid bind groups.`)
  .params(u =>
    u
      .combine('resourceType', kBindableResources)
      .combine('entry', allBindingEntries(false))
      .filter(({ resourceType, entry }) => {
        const info = bindingTypeInfo(entry);
        switch (info.resource) {
          // Either type of sampler may be bound to a filtering sampler binding.
          case 'filtSamp':
            return resourceType === 'filtSamp' || resourceType === 'nonFiltSamp';
          // But only non-filtering samplers can be used with non-filtering sampler bindings.
          case 'nonFiltSamp':
            return resourceType === 'nonFiltSamp';
          default:
            return info.resource === resourceType;
        }
      })
  )
  .fn(async t => {
    const { resourceType, entry } = t.params;
    const visibility = bindingTypeInfo(entry).validStages;
    const layout = t.device.createBindGroupLayout({
      entries: [{ binding: 0, visibility, ...entry }],
    });
    const resource = t.getBindingResource(resourceType);
    t.expectValidationErrorAfterDestroy(() => {
      t.device.createBindGroup({ layout, entries: [{ binding: 0, resource }] });
    });
  });

g.test('createPipelineLayout')
  .desc(
    `
Tests creating pipeline layouts on destroyed device fails. Tests valid combinations of:
  - Various bind groups with valid binding entries
  - Maximum set of visibility for each binding entry
  `
  )
  .params(u => u.combine('entry', allBindingEntries(false)))
  .fn(async t => {
    const { entry } = t.params;
    const visibility = bindingTypeInfo(entry).validStages;
    const bindGroupLayout = t.device.createBindGroupLayout({
      entries: [{ binding: 0, visibility, ...entry }],
    });
    t.expectValidationErrorAfterDestroy(() => {
      t.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      });
    });
  });

g.test('createShaderModule')
  .desc(
    `
Tests creating shader modules on destroyed device fails.
  - Tests all shader stages: vertex, fragment, compute
  `
  )
  .params(u => u.combine('stage', kShaderStageKeys))
  .fn(async t => {
    const { stage } = t.params;
    t.expectValidationErrorAfterDestroy(() => {
      t.device.createShaderModule({ code: t.getNoOpShaderCode(stage) });
    });
  });

g.test('createComputePipeline')
  .desc(
    `
Tests creating compute pipeline on destroyed device fails.
  - Tests with a valid no-op compute shader
  `
  )
  .fn(async t => {
    const cShader = t.device.createShaderModule({ code: t.getNoOpShaderCode('COMPUTE') });
    t.expectValidationErrorAfterDestroy(() => {
      t.device.createComputePipeline({
        compute: { module: cShader, entryPoint: 'main' },
      });
    });
  });

g.test('createRenderPipeline')
  .desc(
    `
Tests creating render pipeline on destroyed device fails.
  - Tests with valid no-op vertex and fragment shaders
  `
  )
  .fn(async t => {
    const vShader = t.device.createShaderModule({ code: t.getNoOpShaderCode('VERTEX') });
    const fShader = t.device.createShaderModule({ code: t.getNoOpShaderCode('FRAGMENT') });
    t.expectValidationErrorAfterDestroy(() => {
      t.device.createRenderPipeline({
        vertex: { module: vShader, entryPoint: 'main' },
        fragment: {
          module: fShader,
          entryPoint: 'main',
          targets: [{ format: 'rgba8unorm', writeMask: 0 }],
        },
      });
    });
  });

g.test('createCommandEncoder')
  .desc(
    `
Tests creating command encoders on destroyed device fails.
  `
  )
  .fn(async t => {
    t.expectValidationErrorAfterDestroy(() => {
      t.device.createCommandEncoder();
    });
  });

g.test('createRenderBundleEncoder')
  .desc(
    `
Tests creating render bundle encoders on destroyed device fails.
  - Tests various renderable texture color formats
  `
  )
  .params(u => u.combine('format', kRenderableColorTextureFormats))
  .fn(async t => {
    const { format } = t.params;
    t.expectValidationErrorAfterDestroy(() => {
      t.device.createRenderBundleEncoder({ colorFormats: [format] });
    });
  });

g.test('createQuerySet')
  .desc(
    `
Tests creating query sets on destroyed device fails.
  - Tests various query set types
  `
  )
  .params(u => u.combine('type', kQueryTypes))
  .fn(async t => {
    const { type } = t.params;
    await t.selectDeviceForQueryTypeOrSkipTestCase(type);
    t.expectValidationErrorAfterDestroy(() => {
      t.device.createQuerySet({ type, count: 4 });
    });
  });

g.test('command,copyBufferToBuffer')
  .desc(
    `
Tests copyBufferToBuffer command on destroyed device fails.
  - Tests that finishing encoding fails on destroyed device
  - Tests that submitting command fails on destroyed device
  `
  )
  .unimplemented();

g.test('command,copyBufferToTexture,uncompressed_format')
  .desc(
    `
Tests copyBufferToTexture command with various uncompressed formats on destroyed device fails
  - Tests that finishing encoding fails on destroyed device
  - Tests that submitting command fails on destroyed device
  `
  )
  .unimplemented();

g.test('command,copyBufferToTexture,compressed_format')
  .desc(
    `
Tests copyBufferToTexture command with various compressed formats on destroyed device fails.
  - Tests that finishing encoding fails on destroyed device
  - Tests that submitting command fails on destroyed device
  `
  )
  .unimplemented();

g.test('command,copyTextureToBuffer,uncompressed_format')
  .desc(
    `
Tests copyTextureToBuffer command with various uncompressed formats on destroyed device fails.
  - Tests that finishing encoding fails on destroyed device
  - Tests that submitting command fails on destroyed device
  `
  )
  .unimplemented();

g.test('command,finish,copyTextureToBuffer,compressed_format')
  .desc(
    `
Tests copyTextureToBuffer command with various compressed formats on destroyed device fails.
  - Tests that finishing encoding fails on destroyed device
  - Tests that submitting command fails on destroyed device
  `
  )
  .unimplemented();

g.test('command,copyTextureToTexture,uncompressed_format')
  .desc(
    `
Tests copyTextureToTexture command with various uncompressed formats on destroyed device fails.
  - Tests that finishing encoding fails on destroyed device
  - Tests that submitting command fails on destroyed device
  `
  )
  .unimplemented();

g.test('command,copyTextureToTexture,compressed_format')
  .desc(
    `
Tests copyTextureToTexture command with various compressed formats on destroyed device fails
  - Tests that finishing encoding fails on destroyed device
  - Tests that submitting command fails on destroyed device
  `
  )
  .unimplemented();

g.test('command,clearBuffer')
  .desc(
    `
Tests encoding and finishing a clearBuffer command on destroyed device fails.
  - Tests that finishing encoding fails on destroyed device
  - Tests that submitting command fails on destroyed device
  `
  )
  .unimplemented();

g.test('command,writeTimestamp')
  .desc(
    `
Tests encoding and finishing a writeTimestamp command on destroyed device fails.
  - Tests that finishing encoding fails on destroyed device
  - Tests that submitting command fails on destroyed device
  `
  )
  .unimplemented();

g.test('command,resolveQuerySet')
  .desc(
    `
Tests encoding and finishing a resolveQuerySet command on destroyed device fails.
  - Tests that finishing encoding fails on destroyed device
  - Tests that submitting command fails on destroyed device
  `
  )
  .unimplemented();

g.test('command,computePass,dispatch')
  .desc(
    `
Tests encoding and dispatching a simple valid compute pass on destroyed device fails.
  - Binds valid pipeline and bindgroups, then dispatches
  - Tests that finishing encoding fails on destroyed device
  - Tests that submitting command fails on destroyed device
  `
  )
  .unimplemented();

g.test('command,renderPass,draw')
  .desc(
    `
Tests encoding and finishing a simple valid render pass on destroyed device fails.
  - Binds valid pipeline and bindgroups, then draws
  - Tests that finishing encoding fails on destroyed device
  - Tests that submitting command fails on destroyed device
  `
  )
  .unimplemented();

g.test('command,renderPass,renderBundle')
  .desc(
    `
Tests encoding and drawing a render pass including a render bundle on destroyed device fails.
  - Binds valid pipeline and bindgroups, executes render bundle, then draws
  - Tests that finishing encoding fails on destroyed device
  - Tests that submitting command fails on destroyed device
  `
  )
  .unimplemented();
