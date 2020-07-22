export const description = '';

import { params, pbool, poptions } from '../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';

import { MappingTest } from './mapping_test.js';

export const g = makeTestGroup(MappingTest);

g.test('mappedAtCreation')
  .params(
    params()
      .combine(poptions('size', [12, 512 * 1024]))
      .combine(pbool('mappable'))
  )
  .fn(t => {
    const { size, mappable } = t.params;
    const buffer = t.device.createBuffer({
      mappedAtCreation: true,
      size,
      usage: GPUBufferUsage.COPY_SRC | (mappable ? GPUBufferUsage.MAP_WRITE : 0),
    });
    const arrayBuffer = buffer.getMappedRange();
    t.checkMapWrite(buffer, arrayBuffer, size);
  });
