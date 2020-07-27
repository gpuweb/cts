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
    /* eslint-disable-next-line no-console */
    console.log('ENTER: POLYFILL:createBufferMapped');
    const [buffer, arrayBuffer] = t.device.createBufferMapped({
      size,
      usage: GPUBufferUsage.COPY_SRC | (mappable ? GPUBufferUsage.MAP_WRITE : 0),
    });
    /* eslint-disable-next-line no-console */
    console.log('EXIT: POLYFILL:createBufferMapped');
    t.checkMapWrite(buffer, arrayBuffer, size);
  });
