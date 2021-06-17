import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

export const description = `
Test uninitialized buffers are initialized to zero when read
(or read-written, e.g. with depth write or atomics).

Here lists all the buffer usages to test:
- in writeBuffer()
- in map async (read and partial write)
- created with mappedAtCreation === true
- as copy source (TODO)
- as copy destination in a partial copy (TODO)
- in ResolveQuerySet() (TODO)
- as uniform / read-only storage / storage buffer (TODO)
- as vertex / index buffe (TODO)
- as indirect buffer (TODO)
`;

export const g = makeTestGroup(GPUTest);

g.test('partial_write_buffer')
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

g.test('map_read_whole_buffer').fn(async t => {
  const bufferSize = 32;

  const buffer = t.device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  await buffer.mapAsync(GPUMapMode.READ);
  const readData = new Uint8Array(buffer.getMappedRange());
  for (let i = 0; i < readData.length; ++i) {
    t.expect(readData[i] === 0);
  }
  buffer.unmap();
});

g.test('map_read_partial_buffer')
  .paramsSubcasesOnly(u => u.combine('offset', [0, 8, -16]))
  .fn(async t => {
    const { offset } = t.params;
    const bufferSize = 32;
    const appliedOffset = offset >= 0 ? offset : bufferSize + offset;

    const buffer = t.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    {
      const mapSize = 16;
      await buffer.mapAsync(GPUMapMode.READ, appliedOffset, mapSize);
      const readData = new Uint8Array(buffer.getMappedRange(appliedOffset, mapSize));
      for (let i = 0; i < mapSize; ++i) {
        t.expect(readData[i] === 0);
      }
      buffer.unmap();
    }

    {
      await buffer.mapAsync(GPUMapMode.READ);
      const readData = new Uint8Array(buffer.getMappedRange());
      for (let i = 0; i < bufferSize; ++i) {
        t.expect(readData[i] === 0);
      }
      buffer.unmap();
    }
  });

g.test('map_write_whole_buffer').fn(async t => {
  const bufferSize = 32;
  const buffer = t.device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
  });

  await buffer.mapAsync(GPUMapMode.WRITE);
  const writeData = new Uint8Array(buffer.getMappedRange());
  for (let i = 0; i < bufferSize; ++i) {
    t.expect(writeData[i] === 0);
  }
  buffer.unmap();
});

g.test('map_write_partial_buffer')
  .paramsSubcasesOnly(u => u.combine('offset', [0, 8, -16]))
  .fn(async t => {
    const { offset } = t.params;
    const bufferSize = 32;
    const appliedOffset = offset >= 0 ? offset : bufferSize + offset;

    const buffer = t.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
    });

    {
      const mappedSize = 12;
      await buffer.mapAsync(GPUMapMode.WRITE, appliedOffset, mappedSize);
      const writeData = new Uint8Array(buffer.getMappedRange(appliedOffset, mappedSize));
      for (let i = 0; i < mappedSize; ++i) {
        t.expect(writeData[i] === 0);
      }
      buffer.unmap();
    }

    {
      const expectedData = new Uint8Array(bufferSize);
      t.expectContents(buffer, expectedData);
    }
  });

g.test('mapped_at_creation_map_readable_whole_buffer').fn(async t => {
  const bufferSize = 32;
  const buffer = t.device.createBuffer({
    mappedAtCreation: true,
    size: bufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  const mapped = new Uint8Array(buffer.getMappedRange());
  for (let i = 0; i < bufferSize; ++i) {
    t.expect(mapped[i] === 0);
  }
  buffer.unmap();
});

g.test('mapped_at_creation_map_readable_partial_buffer')
  .paramsSubcasesOnly(u => u.combine('offset', [0, 8, -16]))
  .fn(async t => {
    const { offset } = t.params;
    const bufferSize = 32;
    const appliedOffset = offset >= 0 ? offset : bufferSize + offset;

    const buffer = t.device.createBuffer({
      mappedAtCreation: true,
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    {
      const mappedSize = 12;
      const mapped = new Uint8Array(buffer.getMappedRange(appliedOffset, mappedSize));
      for (let i = 0; i < mappedSize; ++i) {
        t.expect(mapped[i] === 0);
      }
      buffer.unmap();
    }

    {
      await buffer.mapAsync(GPUMapMode.READ);
      const readData = new Uint8Array(buffer.getMappedRange());
      const expectedData = new Uint8Array(bufferSize);
      t.expectBuffer(readData, expectedData);
      buffer.unmap();
    }
  });

g.test('mapped_at_creation_map_writable_whole_buffer').fn(async t => {
  const bufferSize = 32;
  const buffer = t.device.createBuffer({
    mappedAtCreation: true,
    size: bufferSize,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
  });

  {
    const writeData = new Uint8Array(buffer.getMappedRange());
    for (let i = 0; i < bufferSize; ++i) {
      t.expect(writeData[i] === 0);
    }
    buffer.unmap();
  }

  {
    const expectedData = new Uint8Array(bufferSize);
    t.expectContents(buffer, expectedData);
  }
});

g.test('mapped_at_creation_map_writable_partial_buffer')
  .paramsSubcasesOnly(u => u.combine('offset', [0, 8, -16]))
  .fn(async t => {
    const { offset } = t.params;
    const bufferSize = 32;
    const appliedOffset = offset >= 0 ? offset : bufferSize + offset;

    const buffer = t.device.createBuffer({
      mappedAtCreation: true,
      size: bufferSize,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
    });

    {
      const mappedSize = 12;
      const writeData = new Uint8Array(buffer.getMappedRange(appliedOffset, mappedSize));
      for (let i = 0; i < mappedSize; ++i) {
        t.expect(writeData[i] === 0);
      }
      buffer.unmap();
    }

    {
      const expectedData = new Uint8Array(bufferSize);
      t.expectContents(buffer, expectedData);
    }
  });

g.test('mapped_at_creation_no_map_usage_whole_buffer').fn(async t => {
  const bufferSize = 32;
  const buffer = t.device.createBuffer({
    mappedAtCreation: true,
    size: bufferSize,
    usage: GPUBufferUsage.COPY_SRC,
  });

  {
    const writeData = new Uint8Array(buffer.getMappedRange());
    for (let i = 0; i < bufferSize; ++i) {
      t.expect(writeData[i] === 0);
    }
    buffer.unmap();
  }

  {
    const expectedData = new Uint8Array(bufferSize);
    t.expectContents(buffer, expectedData);
  }
});

g.test('mapped_at_creation_no_map_usage_partial_buffer')
  .paramsSubcasesOnly(u => u.combine('offset', [0, 8, -16]))
  .fn(async t => {
    const { offset } = t.params;
    const bufferSize = 32;
    const appliedOffset = offset >= 0 ? offset : bufferSize + offset;

    const buffer = t.device.createBuffer({
      mappedAtCreation: true,
      size: bufferSize,
      usage: GPUBufferUsage.COPY_SRC,
    });

    {
      const mappedSize = 12;
      const writeData = new Uint8Array(buffer.getMappedRange(appliedOffset, mappedSize));
      for (let i = 0; i < mappedSize; ++i) {
        t.expect(writeData[i] === 0);
      }
      buffer.unmap();
    }

    {
      const expectedData = new Uint8Array(bufferSize);
      t.expectContents(buffer, expectedData);
    }
  });
