import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { assert, unreachable } from '../../../../common/util/util.js';
import { GPUConst } from '../../../constants.js';
import { GPUTest } from '../../../gpu_test.js';
import { getTextureCopyLayout } from '../../../util/texture/layout.js';

export const description = `
Test uninitialized buffers are initialized to zero when read
(or read-written, e.g. with depth write or atomics).

Note that:
-  We don't need 'copy_buffer_to_buffer_copy_destination' here because there has already been an
   operation test 'command_buffer.copyBufferToBuffer.single' that provides the same functionality.

TODO:
Test the buffers whose first usage is being used:
- as copy destination in a partial copy
- as uniform / read-only storage / storage buffer
- as vertex / index buffer
- as indirect buffer
`;

const kMapModeOptions = [GPUConst.MapMode.READ, GPUConst.MapMode.WRITE];
const kBufferUsagesForMappedAtCreationTests = [
  GPUConst.BufferUsage.COPY_DST | GPUConst.BufferUsage.MAP_READ,
  GPUConst.BufferUsage.COPY_SRC | GPUConst.BufferUsage.MAP_WRITE,
  GPUConst.BufferUsage.COPY_SRC,
];

class F extends GPUTest {
  GetBufferUsageFromMapMode(mapMode: GPUMapModeFlags): number {
    switch (mapMode) {
      case GPUMapMode.READ:
        return GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ;
      case GPUMapMode.WRITE:
        return GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE;
      default:
        unreachable();
        return 0;
    }
  }

  async CheckGPUBufferContent(
    buffer: GPUBuffer,
    bufferUsage: GPUBufferUsageFlags,
    expectedData: Uint8Array
  ): Promise<void> {
    // We can only check the buffer contents with t.expectGPUBufferValuesEqual() when the buffer
    // usage contains COPY_SRC.
    if (bufferUsage & GPUBufferUsage.MAP_READ) {
      await buffer.mapAsync(GPUMapMode.READ);
      this.expectBuffer(new Uint8Array(buffer.getMappedRange()), expectedData);
      buffer.unmap();
    } else {
      assert((bufferUsage & GPUBufferUsage.COPY_SRC) !== 0);
      this.expectGPUBufferValuesEqual(buffer, expectedData);
    }
  }
}

export const g = makeTestGroup(F);

g.test('partial_write_buffer')
  .desc(
    `Verify when we upload data to a part of a buffer with writeBuffer() just after the creation of
the buffer, the remaining part of that buffer will be initialized to 0.`
  )
  .paramsSubcasesOnly(u => u.combine('offset', [0, 8, -12]))
  .fn(async t => {
    const { offset } = t.params;
    const bufferSize = 32;
    const appliedOffset = offset >= 0 ? offset : bufferSize + offset;

    const buffer = t.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    const copySize = 12;
    const writeData = new Uint8Array(copySize);
    const expectedData = new Uint8Array(bufferSize);
    for (let i = 0; i < copySize; ++i) {
      expectedData[appliedOffset + i] = writeData[i] = i + 1;
    }
    t.queue.writeBuffer(buffer, appliedOffset, writeData, 0);

    t.expectGPUBufferValuesEqual(buffer, expectedData);
  });

g.test('map_whole_buffer')
  .desc(
    `Verify when we map the whole range of a mappable GPUBuffer to a typed array buffer just after
creating the GPUBuffer, the contents of both the typed array buffer and the GPUBuffer itself
have already been initialized to 0.`
  )
  .params(u => u.combine('mapMode', kMapModeOptions))
  .fn(async t => {
    const { mapMode } = t.params;

    const bufferSize = 32;
    const bufferUsage = t.GetBufferUsageFromMapMode(mapMode);
    const buffer = t.device.createBuffer({
      size: bufferSize,
      usage: bufferUsage,
    });

    await buffer.mapAsync(mapMode);
    const readData = new Uint8Array(buffer.getMappedRange());
    for (let i = 0; i < bufferSize; ++i) {
      t.expect(readData[i] === 0);
    }
    buffer.unmap();

    const expectedData = new Uint8Array(bufferSize);
    await t.CheckGPUBufferContent(buffer, bufferUsage, expectedData);
  });

g.test('map_partial_buffer')
  .desc(
    `Verify when we map a subrange of a mappable GPUBuffer to a typed array buffer just after the
creation of the GPUBuffer, the contents of both the typed array buffer and the GPUBuffer have
already been initialized to 0.`
  )
  .params(u => u.combine('mapMode', kMapModeOptions).beginSubcases().combine('offset', [0, 8, -16]))
  .fn(async t => {
    const { mapMode, offset } = t.params;
    const bufferSize = 32;
    const appliedOffset = offset >= 0 ? offset : bufferSize + offset;

    const bufferUsage = t.GetBufferUsageFromMapMode(mapMode);
    const buffer = t.device.createBuffer({
      size: bufferSize,
      usage: bufferUsage,
    });

    const expectedData = new Uint8Array(bufferSize);
    {
      const mapSize = 16;
      await buffer.mapAsync(mapMode, appliedOffset, mapSize);
      const mappedData = new Uint8Array(buffer.getMappedRange(appliedOffset, mapSize));
      for (let i = 0; i < mapSize; ++i) {
        t.expect(mappedData[i] === 0);
        if (mapMode === GPUMapMode.WRITE) {
          mappedData[i] = expectedData[appliedOffset + i] = i + 1;
        }
      }
      buffer.unmap();
    }

    await t.CheckGPUBufferContent(buffer, bufferUsage, expectedData);
  });

g.test('mapped_at_creation_whole_buffer')
  .desc(
    `Verify when we call getMappedRange() at the whole range of a GPUBuffer created with
mappedAtCreation === true just after its creation, the contents of both the returned typed
array buffer of getMappedRange() and the GPUBuffer itself have all been initialized to 0.`
  )
  .params(u => u.combine('bufferUsage', kBufferUsagesForMappedAtCreationTests))
  .fn(async t => {
    const { bufferUsage } = t.params;

    const bufferSize = 32;
    const buffer = t.device.createBuffer({
      mappedAtCreation: true,
      size: bufferSize,
      usage: bufferUsage,
    });

    const mapped = new Uint8Array(buffer.getMappedRange());
    for (let i = 0; i < bufferSize; ++i) {
      t.expect(mapped[i] === 0);
    }
    buffer.unmap();

    const expectedData = new Uint8Array(bufferSize);
    await t.CheckGPUBufferContent(buffer, bufferUsage, expectedData);
  });

g.test('mapped_at_creation_partial_buffer')
  .desc(
    `Verify when we call getMappedRange() at a subrange of a GPUBuffer created with
mappedAtCreation === true just after its creation, the contents of both the returned typed
array buffer of getMappedRange() and the GPUBuffer itself have all been initialized to 0.`
  )
  .params(u =>
    u
      .combine('bufferUsage', kBufferUsagesForMappedAtCreationTests)
      .beginSubcases()
      .combine('offset', [0, 8, -16])
  )
  .fn(async t => {
    const { bufferUsage, offset } = t.params;
    const bufferSize = 32;
    const appliedOffset = offset >= 0 ? offset : bufferSize + offset;

    const buffer = t.device.createBuffer({
      mappedAtCreation: true,
      size: bufferSize,
      usage: bufferUsage,
    });

    const expectedData = new Uint8Array(bufferSize);
    {
      const mappedSize = 12;
      const mapped = new Uint8Array(buffer.getMappedRange(appliedOffset, mappedSize));
      for (let i = 0; i < mappedSize; ++i) {
        t.expect(mapped[i] === 0);
        if (!(bufferUsage & GPUBufferUsage.MAP_READ)) {
          mapped[i] = expectedData[appliedOffset + i] = i + 1;
        }
      }
      buffer.unmap();
    }

    await t.CheckGPUBufferContent(buffer, bufferUsage, expectedData);
  });

g.test('copy_buffer_to_buffer_copy_source')
  .desc(
    `Verify when the first usage of a GPUBuffer is being used as the source buffer of
CopyBufferToBuffer(), the contents of the GPUBuffer have already been initialized to 0.`
  )
  .fn(async t => {
    const bufferSize = 32;
    const bufferUsage = GPUBufferUsage.COPY_SRC;
    const buffer = t.device.createBuffer({
      size: bufferSize,
      usage: bufferUsage,
    });

    const expectedData = new Uint8Array(bufferSize);
    // copyBufferToBuffer() is called inside t.CheckGPUBufferContent().
    await t.CheckGPUBufferContent(buffer, bufferUsage, expectedData);
  });

g.test('copy_buffer_to_texture')
  .desc(
    `Verify when the first usage of a GPUBuffer is being used as the source buffer of
CopyBufferToTexture(), the contents of the GPUBuffer have already been initialized to 0.`
  )
  .paramsSubcasesOnly(u => u.combine('bufferOffset', [0, 8]))
  .fn(async t => {
    const { bufferOffset } = t.params;
    const textureSize = { width: 8, height: 8, depthOrArrayLayers: 1 };
    const dstTextureFormat = 'rgba8unorm';

    const dstTexture = t.device.createTexture({
      size: textureSize,
      format: dstTextureFormat,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });
    const layout = getTextureCopyLayout(dstTextureFormat, '2d', [
      textureSize.width,
      textureSize.height,
      textureSize.depthOrArrayLayers,
    ]);
    const srcBufferSize = layout.byteLength + bufferOffset;
    const srcBufferUsage = GPUBufferUsage.COPY_SRC;
    const srcBuffer = t.device.createBuffer({
      size: srcBufferSize,
      usage: srcBufferUsage,
    });

    const encoder = t.device.createCommandEncoder();
    encoder.copyBufferToTexture(
      {
        buffer: srcBuffer,
        offset: bufferOffset,
        bytesPerRow: layout.bytesPerRow,
        rowsPerImage: layout.rowsPerImage,
      },
      { texture: dstTexture },
      textureSize
    );
    t.queue.submit([encoder.finish()]);

    // Verify the contents in srcBuffer are all 0.
    const expectedSrcBufferData = new Uint8Array(srcBufferSize);
    await t.CheckGPUBufferContent(srcBuffer, srcBufferUsage, expectedSrcBufferData);

    // Verify the texels in dstTexture are all 0.
    t.expectSingleColor(dstTexture, dstTextureFormat, {
      size: [textureSize.width, textureSize.height, textureSize.depthOrArrayLayers],
      exp: { R: 0.0, G: 0.0, B: 0.0, A: 0.0 },
    });
  });

g.test('resolve_query_set_to_partial_buffer')
  .desc(
    `Verify when we resolve a query set into a GPUBuffer just after creating that GPUBuffer, the
remaining part of it will be initialized to 0.`
  )
  .paramsSubcasesOnly(u => u.combine('bufferOffset', [0, 256]))
  .fn(async t => {
    const { bufferOffset } = t.params;
    const bufferSize = bufferOffset + 8;
    const bufferUsage = GPUBufferUsage.COPY_SRC | GPUBufferUsage.QUERY_RESOLVE;
    const dstBuffer = t.device.createBuffer({
      size: bufferSize,
      usage: bufferUsage,
    });

    const querySet = t.device.createQuerySet({ type: 'occlusion', count: 1 });
    const encoder = t.device.createCommandEncoder();
    encoder.resolveQuerySet(querySet, 0, 1, dstBuffer, bufferOffset);
    t.queue.submit([encoder.finish()]);

    const expectedBufferData = new Uint8Array(bufferSize);
    await t.CheckGPUBufferContent(dstBuffer, bufferUsage, expectedBufferData);
  });
