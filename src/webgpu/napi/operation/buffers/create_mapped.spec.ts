export const description = '';

import { params, pbool, poptions } from '../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';

import { MappingTest } from './mapping_test.js';



export const g = makeTestGroup(MappingTest);

g.test('createBufferMapped')
  .params(
    params()
      .combine(poptions('size', [12, 512 * 1024]))
      .combine(pbool('mappable'))
  )
  .fn(t => {
    const { size, mappable } = t.params;

    const desc = {
      size,
      usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
    };

    const [buffer, arrayBuffer] = t.device.createBufferMapped(desc);

    t.checkMapWrite(buffer, arrayBuffer, size);
  });
