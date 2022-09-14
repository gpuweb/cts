export const description = `
Compute pipeline using overridable constants test.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { range } from '../../../../common/util/util.js';
import { GPUTest } from '../../../gpu_test.js';

class F extends GPUTest {
  ExpectShaderOutputWithConstants(
    expected: Uint32Array | Float32Array,
    constants: Record<string, GPUPipelineConstantValue>,
    code: string
  ) {
    const dst = this.device.createBuffer({
      size: expected.byteLength,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE,
    });

    const pipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: this.device.createShaderModule({
          code,
        }),
        entryPoint: 'main',
        constants,
      },
    });

    const bindGroup = this.device.createBindGroup({
      entries: [{ binding: 0, resource: { buffer: dst, offset: 0, size: expected.byteLength } }],
      layout: pipeline.getBindGroupLayout(0),
    });

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();
    this.device.queue.submit([encoder.finish()]);

    this.expectGPUBufferValuesEqual(dst, expected);
  }
}

export const g = makeTestGroup(F);

g.test('basic')
  .desc(`Test that correct constants override values or default values are used.`)
  .fn(async t => {
    const count = 11;
    t.ExpectShaderOutputWithConstants(
      new Uint32Array(range(count, i => i)),
      {
        c0: 0,
        c1: 1,
        c2: 2,
        c3: 3,
        // c4 is using default value
        c5: 5,
        c6: 6,
        // c7 is using default value
        c8: 8,
        c9: 9,
        // c10 is using default value
      },
      `
      override c0: bool;              // type: bool
      override c1: bool = false;      // default override
      override c2: f32;               // type: float32
      override c3: f32 = 0.0;         // default override
      override c4: f32 = 4.0;         // default
      override c5: i32;               // type: int32
      override c6: i32 = 0;           // default override
      override c7: i32 = 7;           // default
      override c8: u32;               // type: uint32
      override c9: u32 = 0u;          // default override
      override c10: u32 = 10u;        // default
      
      struct Buf {
          data : array<u32, ${count}>
      }
      
      @group(0) @binding(0) var<storage, read_write> buf : Buf;
      
      @compute @workgroup_size(1) fn main() {
          buf.data[0] = u32(c0);
          buf.data[1] = u32(c1);
          buf.data[2] = u32(c2);
          buf.data[3] = u32(c3);
          buf.data[4] = u32(c4);
          buf.data[5] = u32(c5);
          buf.data[6] = u32(c6);
          buf.data[7] = u32(c7);
          buf.data[8] = u32(c8);
          buf.data[9] = u32(c9);
          buf.data[10] = u32(c10);
      }
    `
    );
  });

g.test('numeric_id')
  .desc(`Test that correct values are used for constants with numeric id.`)
  .fn(async t => {
    t.ExpectShaderOutputWithConstants(
      new Uint32Array([1, 2, 3]),
      {
        1001: 1,
        1: 2,
        // 1003 is using default value
      },
      `
        @id(1001) override c1: u32;            // some big numeric id
        @id(1) override c2: u32 = 0u;          // id == 1 might collide with some generated constant id
        @id(1003) override c3: u32 = 3u;       // default
        
        struct Buf {
            data : array<u32, 3>
        }
        
        @group(0) @binding(0) var<storage, read_write> buf : Buf;
        
        @compute @workgroup_size(1) fn main() {
            buf.data[0] = c1;
            buf.data[1] = c2;
            buf.data[2] = c3;
        }
      `
    );
  });

g.test('precision')
  .desc(`Test that float number precision is preserved for constants.`)
  .fn(async t => {
    const c1 = 3.14159;
    const c2 = 3.141592653589793238;
    t.ExpectShaderOutputWithConstants(
      new Float32Array([c1, c2]),
      {
        c1,
        c2,
      },
      `
        override c1: f32;
        override c2: f32;
        
        struct Buf {
            data : array<f32, 2>
        }
        
        @group(0) @binding(0) var<storage, read_write> buf : Buf;
        
        @compute @workgroup_size(1) fn main() {
            buf.data[0] = c1;
            buf.data[1] = c2;
        }
      `
    );
  });

g.test('workgroup_size')
  .desc(`Test that constants can be used as workgroup size correctly.`)
  .params(u =>
    u //
      .combine('x', [3, 16, 64])
  )
  .fn(async t => {
    const { x } = t.params;
    t.ExpectShaderOutputWithConstants(
      new Uint32Array([x]),
      {
        x,
      },
      `
        override x: u32;

        struct Buf {
            data : array<u32, 1>
        }
        
        @group(0) @binding(0) var<storage, read_write> buf : Buf;
        
        @compute @workgroup_size(x) fn main(
            @builtin(local_invocation_id) local_invocation_id : vec3<u32>
        ) {
            if (local_invocation_id.x >= x - 1) {
                buf.data[0] = local_invocation_id.x + 1;
            }
        }
      `
    );
  });

g.test('shared_shader_module')
  .desc(
    `Test that when the same shader module is shared by different pipelines, the correct constant values are used.`
  )
  .fn(async t => {
    const module = t.device.createShaderModule({
      code: `
      override a: u32;

      struct Buf {
          data : array<u32, 1>
      }
      
      @group(0) @binding(0) var<storage, read_write> buf : Buf;
      
      @compute @workgroup_size(1) fn main() {
          buf.data[0] = a;
      }`,
    });

    const pipeline1 = t.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module,
        entryPoint: 'main',
        constants: {
          a: 1,
        },
      },
    });
    const pipeline2 = t.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module,
        entryPoint: 'main',
        constants: {
          a: 2,
        },
      },
    });

    const expected1 = new Uint32Array([1]);
    const expected2 = new Uint32Array([2]);

    const buffer1 = t.device.createBuffer({
      size: Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE,
    });

    const buffer2 = t.device.createBuffer({
      size: Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE,
    });

    const bindGroup1 = t.device.createBindGroup({
      entries: [
        {
          binding: 0,
          resource: { buffer: buffer1, offset: 0, size: Uint32Array.BYTES_PER_ELEMENT },
        },
      ],
      layout: pipeline1.getBindGroupLayout(0),
    });
    const bindGroup2 = t.device.createBindGroup({
      entries: [
        {
          binding: 0,
          resource: { buffer: buffer2, offset: 0, size: Uint32Array.BYTES_PER_ELEMENT },
        },
      ],
      layout: pipeline2.getBindGroupLayout(0),
    });

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline1);
    pass.setBindGroup(0, bindGroup1);
    pass.dispatchWorkgroups(1);
    pass.setPipeline(pipeline2);
    pass.setBindGroup(0, bindGroup2);
    pass.dispatchWorkgroups(1);
    pass.end();
    t.device.queue.submit([encoder.finish()]);

    t.expectGPUBufferValuesEqual(buffer1, expected1);
    t.expectGPUBufferValuesEqual(buffer2, expected2);
  });

g.test('multi_entry_points')
  .desc(`Test that constants used for different entry points are handled correctly.`)
  .fn(async t => {
    const module = t.device.createShaderModule({
      code: `
    override c1: u32;
    override c2: u32;
    override c3: u32;
    
    struct Buf {
        data : array<u32, 1>
    }
    
    @group(0) @binding(0) var<storage, read_write> buf : Buf;
    
    @compute @workgroup_size(1) fn main1() {
        buf.data[0] = c1;
    }
    
    @compute @workgroup_size(1) fn main2() {
        buf.data[0] = c2;
    }
    
    @compute @workgroup_size(c3) fn main3() {
        buf.data[0] = 3u;
    }`,
    });

    const pipeline1 = t.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module,
        entryPoint: 'main1',
        constants: {
          c1: 1,
        },
      },
    });
    const pipeline2 = t.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module,
        entryPoint: 'main2',
        constants: {
          c2: 2,
        },
      },
    });
    const pipeline3 = t.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module,
        entryPoint: 'main3',
        constants: {
          // c3 is used as workgroup size
          c3: 1,
        },
      },
    });

    const expected1 = new Uint32Array([1]);
    const expected2 = new Uint32Array([2]);
    const expected3 = new Uint32Array([3]);

    const buffer1 = t.device.createBuffer({
      size: Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE,
    });

    const buffer2 = t.device.createBuffer({
      size: Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE,
    });

    const buffer3 = t.device.createBuffer({
      size: Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE,
    });

    const bindGroup1 = t.device.createBindGroup({
      entries: [
        {
          binding: 0,
          resource: { buffer: buffer1, offset: 0, size: Uint32Array.BYTES_PER_ELEMENT },
        },
      ],
      layout: pipeline1.getBindGroupLayout(0),
    });
    const bindGroup2 = t.device.createBindGroup({
      entries: [
        {
          binding: 0,
          resource: { buffer: buffer2, offset: 0, size: Uint32Array.BYTES_PER_ELEMENT },
        },
      ],
      layout: pipeline2.getBindGroupLayout(0),
    });
    const bindGroup3 = t.device.createBindGroup({
      entries: [
        {
          binding: 0,
          resource: { buffer: buffer3, offset: 0, size: Uint32Array.BYTES_PER_ELEMENT },
        },
      ],
      layout: pipeline3.getBindGroupLayout(0),
    });

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline1);
    pass.setBindGroup(0, bindGroup1);
    pass.dispatchWorkgroups(1);
    pass.setPipeline(pipeline2);
    pass.setBindGroup(0, bindGroup2);
    pass.dispatchWorkgroups(1);
    pass.setPipeline(pipeline3);
    pass.setBindGroup(0, bindGroup3);
    pass.dispatchWorkgroups(1);
    pass.end();
    t.device.queue.submit([encoder.finish()]);

    t.expectGPUBufferValuesEqual(buffer1, expected1);
    t.expectGPUBufferValuesEqual(buffer2, expected2);
    t.expectGPUBufferValuesEqual(buffer3, expected3);
  });
