import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { assert, unreachable } from '../../../../common/util/util.js';
import { GPUConst } from '../../../constants.js';
import { GPUTest } from '../../../gpu_test.js';

export const description = `
Test uninitialized buffers are initialized to zero when read
(or read-written, e.g. with depth write or atomics).

TODO:
Test the buffers whose first usage is being used:
- as copy source
- as copy destination in a partial copy
- in ResolveQuerySet()
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
    // We can only check the buffer contents with t.expectContents() when the buffer usage contains
    // COPY_SRC.
    if (bufferUsage & GPUBufferUsage.MAP_READ) {
      await buffer.mapAsync(GPUMapMode.READ);
      this.expectBuffer(new Uint8Array(buffer.getMappedRange()), expectedData);
      buffer.unmap();
    } else {
      assert((bufferUsage & GPUBufferUsage.COPY_SRC) !== 0);
      this.expectContents(buffer, expectedData);
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

    t.expectContents(buffer, expectedData);
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
