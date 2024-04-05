export const description = `
Execution tests for operator precedence.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { keysOf } from '../../../../common/util/data_tables.js';
import { GPUTest } from '../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

// The list of test cases and their expected results.
interface Expression {
  expr: string;
  result: number;
}
const kExpressions: Record<string, Expression> = {
  add_mul: { expr: 'three + seven * eleven', result: 80 },
  mul_add: { expr: 'three * seven + eleven', result: 32 },
  sub_neg: { expr: 'three--seven', result: 10 },
  neg_shl: { expr: '- three << u32(seven)', result: -384 },
  neg_shr: { expr: '- three >> u32(seven)', result: -1 },
  neg_add: { expr: '- three + seven', result: 4 },
  neg_mul: { expr: '- three * seven', result: -21 },
  neg_and: { expr: '- three & seven', result: 5 },
  neg_or: { expr: '- three | seven', result: -1 },
  neg_xor: { expr: '- three ^ seven', result: -6 },
  comp_add: { expr: '~ three + seven', result: 3 },
  mul_deref: { expr: 'three**ptr_five', result: 15 },
  not_and: { expr: 'i32(! kFalse && kFalse)', result: 0 },
  not_or: { expr: 'i32(! kTrue || kTrue)', result: 1 },
  eq_and: { expr: 'i32(kFalse == kTrue && kFalse)', result: 0 },
  and_eq: { expr: 'i32(kFalse && kTrue == kFalse)', result: 0 },
  eq_or: { expr: 'i32(kFalse == kFalse || kTrue)', result: 1 },
  or_eq: { expr: 'i32(kTrue || kFalse == kFalse)', result: 1 },
  add_swizzle: { expr: '(vec + vec . y).z', result: 8 },
};

g.test('precedence')
  .desc(
    `
    Test that operator precedence rules are correctly implemented.
    `
  )
  .params(u =>
    u.combine('expr', keysOf(kExpressions)).combine('decl', ['const', 'override', 'var<private>'])
  )
  .fn(t => {
    const expr = kExpressions[t.params.expr];
    const wgsl = `
      @group(0) @binding(0) var<storage, read_write> buffer : i32;

      ${t.params.decl} kFalse = false;
      ${t.params.decl} kTrue = true;

      ${t.params.decl} three = 3;
      ${t.params.decl} seven = 7;
      ${t.params.decl} eleven = 11;

      @compute @workgroup_size(1)
      fn main() {
        var five = 5;
        var vec = vec4(1, three, 5, seven);
        let ptr_five = &five;

        buffer = ${expr.expr};
      }
    `;
    const pipeline = t.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: t.device.createShaderModule({ code: wgsl }),
      },
    });

    // Allocate a buffer and fill it with 0xdeadbeef.
    const outputBuffer = t.makeBufferWithContents(
      new Uint32Array([0xdeadbeef]),
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

    // Check that the result is as expected.
    t.expectGPUBufferValuesEqual(outputBuffer, new Int32Array([expr.result]));
  });
