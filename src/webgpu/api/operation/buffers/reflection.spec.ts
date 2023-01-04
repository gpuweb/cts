export const description = `
Tests the reflected properties of buffers

TODO: uncomment mapState tests when mapState is supported.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUConst } from '../../../constants.js';

import { MappingTest } from './mapping_test.js';

export const g = makeTestGroup(MappingTest);

g.test('reflection')
  .desc(`Test that buffers have the correct reflected properties for size, usage, and mapState`)
  .params(u =>
    u //
      .combine('size', [128, 256])
      .combine('usage', [
        GPUConst.BufferUsage.COPY_DST | GPUConst.BufferUsage.MAP_READ,
        GPUConst.BufferUsage.COPY_SRC | GPUConst.BufferUsage.MAP_WRITE,
        GPUConst.BufferUsage.INDEX | GPUConst.BufferUsage.COPY_DST,
        GPUConst.BufferUsage.VERTEX | GPUConst.BufferUsage.COPY_SRC,
        GPUConst.BufferUsage.UNIFORM,
        GPUConst.BufferUsage.STORAGE,
      ])
      .beginSubcases()
      .combine('mappedAtCreation', [false, true])
  )
  .fn(async t => {
    const { size, usage, mappedAtCreation } = t.params;

    const buffer = t.device.createBuffer({
      mappedAtCreation,
      size,
      usage,
    });

    t.expect(buffer.size === size, 'buffer.size === ${size}');
    t.expect(buffer.usage === usage, 'buffer.usage === ${usage}');

    /* uncomment when mapState is supported
    const canMap = usage & (GPUConst.BufferUsage.MAP_READ | GPUConst.BufferUsage.MAP_WRITE);

    if (mappedAtCreation) {
      buffer.unmap();
    }

    if (canMap)
      const expectedMapState = mappedAtCreation ? 'mapped' : 'unmapped';
      t.expect(buffer.mapState === expectedMapState, `mapState === ${expectedMapState}`);

      t.expect(buffer.mapState === 'unmapped');
      const mapMode = (usage | GPUConst.BufferUsage.MAP_READ) ? GPUMapMode.READ : GPUMapMode.WRITE;
      const p = buffer.mapAsync(mapMode);
      t.expect(buffer.mapState === 'pending');
      await p;
      t.expect(buffer.mapState === 'mapped');
      buffer.unmap();
      t.expect(buffer.mapState === 'unmapped');
    }
    */

    buffer.destroy();
  });
