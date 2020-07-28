export const description = '';

import { params, pbool, poptions } from '../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';

import { MappingTest } from './mapping_test.js';

function getBufferDesc(size: number, usage: GPUBufferUsageFlags): GPUBufferDescriptor {
  return {
    size,
    usage
  };
}

export const g = makeTestGroup(MappingTest);

g.test('createBufferMapped')
  .params(
    params()
      .combine(poptions('size', [12, 512 * 1024]))
      .combine(pbool('mappable'))
  )
  .fn( t => {
    const { size, mappable } = t.params;

    const [buffer, arrayBuffer] = t.device.createBufferMapped( getBufferDesc(size, GPUBufferUsage.COPY_SRC | (mappable ? GPUBufferUsage.MAP_WRITE : 0)));

    t.checkMapWrite(buffer, arrayBuffer, size);
  });
