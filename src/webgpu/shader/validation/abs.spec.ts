export const description = 'builtin functions';

import { makeTestGroup } from '../../../common/framework/test_group.js';
import { GPUTest } from '../../gpu_test.js';

//import { ShaderValidationTest } from './shader_validation_test.js';

export const g = makeTestGroup(GPUTest);

g.test('abs').fn(async t => {
  const data = new Int32Array([0xFFFFFFF6]);
  const out = new Int32Array([0x0000000A]);

  const src = t.makeBufferWithContents(data, GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE);

  const dst = t.device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE,
  });

  const pipeline = t.device.createComputePipeline({
    compute: {
      module: t.device.createShaderModule({
        code: `
          [[block]] struct Data {
              value : i32;
          };

          [[group(0), binding(0)]] var<storage, read> src : Data;
          [[group(0), binding(1)]] var<storage, read_write> dst : Data;

          [[stage(compute), workgroup_size(1)]] fn main() {
            dst.value = src.value;
            dst.value = abs(dst.value);
            return;
          }
        `,
      }),
      entryPoint: 'main',
    },
  });

  const bg = t.device.createBindGroup({
    entries: [
      { binding: 0, resource: { buffer: src, offset: 0, size: 4 } },
      { binding: 1, resource: { buffer: dst, offset: 0, size: 4 } },
    ],
    layout: pipeline.getBindGroupLayout(0),
  });

  const encoder = t.device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bg);
  pass.dispatch(1);
  pass.endPass();
  t.device.queue.submit([encoder.finish()]);

  t.expectGPUBufferValuesEqual(dst, out);
});
