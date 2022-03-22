/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ export const description = `
Tests for device lost induced via destroy.
  - Tests that prior to device destruction, valid APIs do not generate errors (control case).
  - After device destruction, runs the same APIs. No expected observable results, so test crash or future failures are the only current failure indicators.
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
   * Expects that `fn` does not produce any errors before the device is destroyed, and then calls
   * `fn` after the device is destroyed without any specific expectation. If `awaitLost` is true, we
   * also wait for device.lost to resolve before executing `fn` in the destroy case.
   */
  async executeAfterDestroy(fn, awaitLost) {
    this.expectDeviceLost('destroyed');

    this.expectValidationError(fn, false);
    this.device.destroy();
    if (awaitLost) {
      const lostInfo = await this.device.lost;
      this.expect(lostInfo.reason === 'destroyed');
    }
    fn();
  }
}

export const g = makeTestGroup(DeviceDestroyTests);

g.test('createBuffer')
  .desc(
    `
Tests creating buffers on destroyed device. Tests valid combinations of:
  - Various usages
  - Mapped at creation or not
  `
  )
  .params(u =>
    u
      .combine('usageType', kBufferUsageKeys)
      .beginSubcases()
      .combine('usageCopy', kBufferUsageCopy)
      .combine('awaitLost', [true, false])
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
    const { awaitLost, usageType, usageCopy, mappedAtCreation } = t.params;
    await t.executeAfterDestroy(() => {
      t.device.createBuffer({
        size: 16,
        usage: kBufferUsageInfo[usageType] | kBufferUsageCopyInfo[usageCopy],
        mappedAtCreation,
      });
    }, awaitLost);
  });

g.test('createTexture,2d,uncompressed_format')
  .desc(
    `
Tests creating 2d uncompressed textures on destroyed device. Tests valid combinations of:
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
      .combine('awaitLost', [true, false])
      .filter(({ format, usageType }) => {
        const info = kTextureFormatInfo[format];
        return !(
          (!info.renderable && usageType === 'render') ||
          (!info.storage && usageType === 'storage')
        );
      })
  )
  .fn(async t => {
    const { awaitLost, format, usageType, usageCopy } = t.params;
    const { blockWidth, blockHeight } = kTextureFormatInfo[format];
    await t.executeAfterDestroy(() => {
      t.device.createTexture({
        size: { width: blockWidth, height: blockHeight },
        usage: kTextureUsageTypeInfo[usageType] | kTextureUsageCopyInfo[usageCopy],
        format,
      });
    }, awaitLost);
  });

g.test('createTexture,2d,compressed_format')
  .desc(
    `
Tests creating 2d compressed textures on destroyed device. Tests valid combinations of:
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
      .combine('awaitLost', [true, false])
      .filter(({ format, usageType }) => {
        const info = kTextureFormatInfo[format];
        return !(
          (!info.renderable && usageType === 'render') ||
          (!info.storage && usageType === 'storage')
        );
      })
  )
  .fn(async t => {
    const { awaitLost, format, usageType, usageCopy } = t.params;
    const { blockWidth, blockHeight, feature } = kTextureFormatInfo[format];
    await t.selectDeviceOrSkipTestCase(feature);
    await t.executeAfterDestroy(() => {
      t.device.createTexture({
        size: { width: blockWidth, height: blockHeight },
        usage: kTextureUsageTypeInfo[usageType] | kTextureUsageCopyInfo[usageCopy],
        format,
      });
    }, awaitLost);
  });

g.test('createView,2d,uncompressed_format')
  .desc(
    `
Tests creating texture views on 2d uncompressed textures from destroyed device. Tests valid combinations of:
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
      .combine('awaitLost', [true, false])
      .filter(({ format, usageType }) => {
        const info = kTextureFormatInfo[format];
        return !(
          (!info.renderable && usageType === 'render') ||
          (!info.storage && usageType === 'storage')
        );
      })
  )
  .fn(async t => {
    const { awaitLost, format, usageType, usageCopy } = t.params;
    const { blockWidth, blockHeight } = kTextureFormatInfo[format];
    const texture = t.device.createTexture({
      size: { width: blockWidth, height: blockHeight },
      usage: kTextureUsageTypeInfo[usageType] | kTextureUsageCopyInfo[usageCopy],
      format,
    });

    await t.executeAfterDestroy(() => {
      texture.createView({ format });
    }, awaitLost);
  });

g.test('createView,2d,compressed_format')
  .desc(
    `
Tests creating texture views on 2d compressed textures from destroyed device. Tests valid combinations of:
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
      .combine('awaitLost', [true, false])
      .filter(({ format, usageType }) => {
        const info = kTextureFormatInfo[format];
        return !(
          (!info.renderable && usageType === 'render') ||
          (!info.storage && usageType === 'storage')
        );
      })
  )
  .fn(async t => {
    const { awaitLost, format, usageType, usageCopy } = t.params;
    const { blockWidth, blockHeight, feature } = kTextureFormatInfo[format];
    await t.selectDeviceOrSkipTestCase(feature);
    const texture = t.device.createTexture({
      size: { width: blockWidth, height: blockHeight },
      usage: kTextureUsageTypeInfo[usageType] | kTextureUsageCopyInfo[usageCopy],
      format,
    });

    await t.executeAfterDestroy(() => {
      texture.createView({ format });
    }, awaitLost);
  });

g.test('createSampler')
  .desc(
    `
Tests creating samplers on destroyed device.
  `
  )
  .params(u => u.beginSubcases().combine('awaitLost', [true, false]))
  .fn(async t => {
    const { awaitLost } = t.params;
    await t.executeAfterDestroy(() => {
      t.device.createSampler();
    }, awaitLost);
  });

g.test('createBindGroupLayout')
  .desc(
    `
Tests creating bind group layouts on destroyed device. Tests valid combinations of:
  - Various valid binding entries
  - Maximum set of visibility for each binding entry
  `
  )
  .params(u =>
    u.combine('entry', allBindingEntries(false)).beginSubcases().combine('awaitLost', [true, false])
  )
  .fn(async t => {
    const { awaitLost, entry } = t.params;
    const visibility = bindingTypeInfo(entry).validStages;
    await t.executeAfterDestroy(() => {
      t.device.createBindGroupLayout({
        entries: [{ binding: 0, visibility, ...entry }],
      });
    }, awaitLost);
  });

g.test('createBindGroup')
  .desc(
    `
Tests creating bind group on destroyed device. Tests valid combinations of:
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
      .beginSubcases()
      .combine('awaitLost', [true, false])
  )
  .fn(async t => {
    const { awaitLost, resourceType, entry } = t.params;
    const visibility = bindingTypeInfo(entry).validStages;
    const layout = t.device.createBindGroupLayout({
      entries: [{ binding: 0, visibility, ...entry }],
    });

    const resource = t.getBindingResource(resourceType);
    await t.executeAfterDestroy(() => {
      t.device.createBindGroup({ layout, entries: [{ binding: 0, resource }] });
    }, awaitLost);
  });

g.test('createPipelineLayout')
  .desc(
    `
Tests creating pipeline layouts on destroyed device. Tests valid combinations of:
  - Various bind groups with valid binding entries
  - Maximum set of visibility for each binding entry
  `
  )
  .params(u =>
    u.combine('entry', allBindingEntries(false)).beginSubcases().combine('awaitLost', [true, false])
  )
  .fn(async t => {
    const { awaitLost, entry } = t.params;
    const visibility = bindingTypeInfo(entry).validStages;
    const bindGroupLayout = t.device.createBindGroupLayout({
      entries: [{ binding: 0, visibility, ...entry }],
    });

    await t.executeAfterDestroy(() => {
      t.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      });
    }, awaitLost);
  });

g.test('createShaderModule')
  .desc(
    `
Tests creating shader modules on destroyed device.
  - Tests all shader stages: vertex, fragment, compute
  `
  )
  .params(u =>
    u.combine('stage', kShaderStageKeys).beginSubcases().combine('awaitLost', [true, false])
  )
  .fn(async t => {
    const { awaitLost, stage } = t.params;
    await t.executeAfterDestroy(() => {
      t.device.createShaderModule({ code: t.getNoOpShaderCode(stage) });
    }, awaitLost);
  });

g.test('createComputePipeline')
  .desc(
    `
Tests creating compute pipeline on destroyed device.
  - Tests with a valid no-op compute shader
  `
  )
  .params(u => u.beginSubcases().combine('awaitLost', [true, false]))
  .fn(async t => {
    const { awaitLost } = t.params;
    const cShader = t.device.createShaderModule({ code: t.getNoOpShaderCode('COMPUTE') });
    await t.executeAfterDestroy(() => {
      t.device.createComputePipeline({
        compute: { module: cShader, entryPoint: 'main' },
      });
    }, awaitLost);
  });

g.test('createRenderPipeline')
  .desc(
    `
Tests creating render pipeline on destroyed device.
  - Tests with valid no-op vertex and fragment shaders
  `
  )
  .params(u => u.beginSubcases().combine('awaitLost', [true, false]))
  .fn(async t => {
    const { awaitLost } = t.params;
    const vShader = t.device.createShaderModule({ code: t.getNoOpShaderCode('VERTEX') });
    const fShader = t.device.createShaderModule({ code: t.getNoOpShaderCode('FRAGMENT') });
    await t.executeAfterDestroy(() => {
      t.device.createRenderPipeline({
        vertex: { module: vShader, entryPoint: 'main' },
        fragment: {
          module: fShader,
          entryPoint: 'main',
          targets: [{ format: 'rgba8unorm', writeMask: 0 }],
        },
      });
    }, awaitLost);
  });

g.test('createCommandEncoder')
  .desc(
    `
Tests creating command encoders on destroyed device.
  `
  )
  .params(u => u.beginSubcases().combine('awaitLost', [true, false]))
  .fn(async t => {
    const { awaitLost } = t.params;
    await t.executeAfterDestroy(() => {
      t.device.createCommandEncoder();
    }, awaitLost);
  });

g.test('createRenderBundleEncoder')
  .desc(
    `
Tests creating render bundle encoders on destroyed device.
  - Tests various renderable texture color formats
  `
  )
  .params(u =>
    u
      .combine('format', kRenderableColorTextureFormats)
      .beginSubcases()
      .combine('awaitLost', [true, false])
  )
  .fn(async t => {
    const { awaitLost, format } = t.params;
    await t.executeAfterDestroy(() => {
      t.device.createRenderBundleEncoder({ colorFormats: [format] });
    }, awaitLost);
  });

g.test('createQuerySet')
  .desc(
    `
Tests creating query sets on destroyed device.
  - Tests various query set types
  `
  )
  .params(u => u.combine('type', kQueryTypes).beginSubcases().combine('awaitLost', [true, false]))
  .fn(async t => {
    const { awaitLost, type } = t.params;
    await t.selectDeviceForQueryTypeOrSkipTestCase(type);
    await t.executeAfterDestroy(() => {
      t.device.createQuerySet({ type, count: 4 });
    }, awaitLost);
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

g.test('command,copyBufferToTexture')
  .desc(
    `
Tests copyBufferToTexture command on destroyed device fails.
  - Tests that finishing encoding fails on destroyed device
  - Tests that submitting command fails on destroyed device
  `
  )
  .unimplemented();

g.test('command,copyTextureToBuffer')
  .desc(
    `
Tests copyTextureToBuffer command on destroyed device fails.
  - Tests that finishing encoding fails on destroyed device
  - Tests that submitting command fails on destroyed device
  `
  )
  .unimplemented();

g.test('command,copyTextureToTexture')
  .desc(
    `
Tests copyTextureToTexture command on destroyed device fails.
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

g.test('queue,writeBuffer')
  .desc(
    `
Tests writeBuffer on queue on destroyed device fails.
  `
  )
  .unimplemented();

g.test('queue,writeTexture')
  .desc(
    `
Tests writeTexture on queue on destroyed device fails.
  `
  )
  .unimplemented();

g.test('queue,copyExternalImageToTexture')
  .desc(
    `
Tests copyExternalImageToTexture on queue on destroyed device fails.
  `
  )
  .unimplemented();
