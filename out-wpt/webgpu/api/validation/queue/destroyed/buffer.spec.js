/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ export const description = `
Tests using a destroyed buffer on a queue.

TODO:
- test renderPass/renderBundle (setVertexBuffer, setIndexBuffer)
- test renderPass (resolveQuerySet)
- test renderPass/computePass (setBindGroup)
`;
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { ValidationTest } from '../../validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('writeBuffer')
  .desc(
    `
Tests that using a destroyed buffer in writeBuffer fails.
- x= {destroyed, not destroyed (control case)}
  `
  )
  .paramsSubcasesOnly(u => u.combine('destroyed', [false, true]))
  .fn(t => {
    const { destroyed } = t.params;
    const buffer = t.trackForCleanup(
      t.device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.COPY_DST,
      })
    );

    if (destroyed) {
      buffer.destroy();
    }

    t.expectValidationError(() => t.queue.writeBuffer(buffer, 0, new Uint8Array(4)), destroyed);
  });

g.test('copyBufferToBuffer')
  .desc(
    `
Tests that using a destroyed buffer in copyBufferToBuffer fails.
- x= {not destroyed (control case), src destroyed, dst destroyed}
  `
  )
  .paramsSubcasesOnly(u => u.combine('destroyed', ['none', 'src', 'dst', 'both']))
  .fn(t => {
    const src = t.trackForCleanup(
      t.device.createBuffer({ size: 4, usage: GPUBufferUsage.COPY_SRC })
    );

    const dst = t.trackForCleanup(
      t.device.createBuffer({ size: 4, usage: GPUBufferUsage.COPY_DST })
    );

    const encoder = t.device.createCommandEncoder();
    encoder.copyBufferToBuffer(src, 0, dst, 0, dst.size);
    const commandBuffer = encoder.finish();

    let shouldError = true;
    switch (t.params.destroyed) {
      case 'none':
        shouldError = false;
        break;
      case 'src':
        src.destroy();
        break;
      case 'dst':
        dst.destroy();
        break;
      case 'both':
        src.destroy();
        dst.destroy();
        break;
    }

    t.expectValidationError(() => {
      t.queue.submit([commandBuffer]);
    }, shouldError);
  });

g.test('copyBufferToTexture')
  .desc(
    `
Tests that using a destroyed buffer in copyBufferToTexture fails.
- x= {not destroyed (control case), src destroyed}
  `
  )
  .paramsSubcasesOnly(u => u.combine('destroyed', [false, true]))
  .fn(t => {
    const { destroyed } = t.params;
    const buffer = t.trackForCleanup(
      t.device.createBuffer({ size: 4, usage: GPUBufferUsage.COPY_SRC })
    );

    const texture = t.trackForCleanup(
      t.device.createTexture({
        size: [1, 1, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.COPY_DST,
      })
    );

    const encoder = t.device.createCommandEncoder();
    encoder.copyBufferToTexture({ buffer }, { texture }, [1, 1, 1]);
    const commandBuffer = encoder.finish();

    if (destroyed) {
      buffer.destroy();
    }

    t.expectValidationError(() => {
      t.queue.submit([commandBuffer]);
    }, destroyed);
  });

g.test('copyTextureToBuffer')
  .desc(
    `
Tests that using a destroyed buffer in copyTextureToBuffer fails.
- x= {not destroyed (control case), dst destroyed}
  `
  )
  .paramsSubcasesOnly(u => u.combine('destroyed', [false, true]))
  .fn(t => {
    const { destroyed } = t.params;
    const texture = t.trackForCleanup(
      t.device.createTexture({
        size: [1, 1, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.COPY_SRC,
      })
    );

    const buffer = t.trackForCleanup(
      t.device.createBuffer({ size: 4, usage: GPUBufferUsage.COPY_DST })
    );

    const encoder = t.device.createCommandEncoder();
    encoder.copyTextureToBuffer({ texture }, { buffer }, [1, 1, 1]);
    const commandBuffer = encoder.finish();

    if (destroyed) {
      buffer.destroy();
    }

    t.expectValidationError(() => {
      t.queue.submit([commandBuffer]);
    }, destroyed);
  });
