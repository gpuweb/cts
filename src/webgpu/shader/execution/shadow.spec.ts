export const description = `
Execution Tests for shadowing
`;

import { makeTestGroup } from '../../../common/framework/test_group.js';
import { iterRange } from '../../../common/util/util.js';
import { GPUTest } from '../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

/**
 * Run a shader and check that the buffer output matches expectations.
 *
 * @param t The test object
 * @param wgsl The shader source
 * @param expected The array of expected values after running the shader
 */
function runShaderTest(t: GPUTest, wgsl: string, expected: Uint32Array): void {
  const pipeline = t.device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: t.device.createShaderModule({ code: wgsl }),
      entryPoint: 'main',
    },
  });

  // Allocate a buffer and fill it with 0xdeadbeef words.
  const outputBuffer = t.makeBufferWithContents(
    new Uint32Array([...iterRange(expected.length, x => 0xdeadbeef)]),
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
  );
  const bindGroup = t.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: outputBuffer } }],
  });

  // Run the shader.
  const encoder = t.device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(1);
  pass.end();
  t.queue.submit([encoder.finish()]);

  // Check that only the non-padding bytes were modified.
  t.expectGPUBufferValuesEqual(outputBuffer, expected);
}

g.test('shadow')
  .desc(`Test that shadowing is handled correctly`)
  .fn(t => {
    const wgsl = `
      struct S {
        my_var_start: u32,
        my_var_block_shadow: u32,
        my_var_unshadow: u32,
        my_var_param_shadow: u32,
        my_var_param_reshadow: u32,
        my_var_after_func: u32,

        my_const_start: u32,
        my_const_block_shadow: u32,
        my_const_unshadow: u32,
        my_const_param_shadow: u32,
        my_const_param_reshadow: u32,
        my_const_after_func: u32,

        my_let_block_shadow: u32,
        my_let_param_reshadow: u32,
        my_let_after_func: u32,

        my_func_param_shadow: u32,
        my_func_shadow: u32,

        my_max_shadow: u32,

        my_idx_before: u32,
        my_idx_loop: array<u32, 2>,
        my_idx_after: u32,
      }
      @group(0) @binding(0) var<storage, read_write> buffer : S;

      var<private> my_var: u32  = 1;
      const my_const: u32 = 100;

      @compute @workgroup_size(1)
      fn main() {
        let my_let = 200u;

        buffer.my_var_start = my_var;  // 1
        buffer.my_const_start = my_const;  // 100

        {
            var my_var: u32 = 10;
            const my_const: u32 = 110;

            buffer.my_var_block_shadow = my_var;  // 10
            buffer.my_const_block_shadow = my_const;  // 110

            let my_let = 210u;
            buffer.my_let_block_shadow = my_let;  // 210
        }

        // For loop shadowing
        var my_idx = 500u;
        buffer.my_idx_before = my_idx; // 500;
        for (var my_idx = 0u; my_idx < 2u; my_idx++) {
          let pos = my_idx;
          var my_idx = 501u + my_idx;
          buffer.my_idx_loop[pos] = my_idx;  // 501, 502
        }
        buffer.my_idx_after = my_idx; // 500;

        buffer.my_var_unshadow = my_var;  // 1
        buffer.my_const_unshadow = my_const;  // 100

        my_func(20, 120, my_let, 300);

        buffer.my_var_after_func = my_var;  // 1
        buffer.my_const_after_func = my_const;  // 100
        buffer.my_let_after_func = my_let;  // 200;

        let max = 400u;
        buffer.my_max_shadow = max;
      };

      // Note, defined after |main|
      fn my_func(my_var: u32, my_const: u32, my_let: u32, my_func: u32) {
        buffer.my_var_param_shadow = my_var;  // 20
        buffer.my_const_param_shadow = my_const;  // 120

        buffer.my_func_param_shadow = my_func; // 300

        // Need block here because of scoping rules for parameters
        {
          var my_var = 30u;
          const my_const = 130u;

          buffer.my_var_param_reshadow = my_var; // 30
          buffer.my_const_param_reshadow = my_const; // 130

          let my_let = 220u;
          buffer.my_let_param_reshadow = my_let; // 220

          let my_func: u32 = 310;
          buffer.my_func_shadow = my_func;  // 310
        }
      }
    `;
    runShaderTest(
      t,
      wgsl,
      new Uint32Array([
        // my_var
        1, // my_var_start
        10, // my_var_block_shadow
        1, // my_var_unshadow
        20, // my_var_param_shadow
        30, // my_var_param_reshadow
        1, // my_var_after_func
        // my_const
        100, // my_const_start
        110, // my_const_block_shadow
        100, // my_const_unshadow
        120, // my_const_param_shadow
        130, // my_const_param_reshadow
        100, // my_const_after_func
        // my_let
        210, // my_let_block_shadow
        220, // my_let_param_reshadow
        200, // my_let_after_func
        // my_func
        300, // my_func_param_shadow
        310, // my_func_shadow
        // my_max
        400, // my_max_shadow
        // my_idx
        500, // my_idx_before
        501, // my_idx_loop[0]
        502, // my_idx_loop[1]
        500, // my_idx_after
      ])
    );
  });
