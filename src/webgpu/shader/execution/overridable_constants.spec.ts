export const description = `Test that variables in the shader are zero initialized`;

import { makeTestGroup } from '../../../common/framework/test_group.js';
import { assert } from '../../../common/util/util.js';
import { GPUTest } from '../../gpu_test.js';
import { kScalarTypes, interestingValuesOf, wgslLiteralValue, typedArrayFor } from '../types.js';

export const g = makeTestGroup(GPUTest);
g.test('overridable_constants')
  .desc(`Test that pipeline overridable constants use the correct value.`)
  .params(u =>
    u
      // 'id' controls how the POC is identified (by name or numerical id)
      .combine('id', ['name', 'numeric'])
      // 'origin' controls how the POC value is specified:
      // * 'initializer' specifies a initializer value, but no override.
      // * 'override' specifies no initializer value, but an override.
      // * 'initializer-with-override' specifies an initializer value and an override.
      .combine('origin', ['initializer', 'override', 'initializer-with-override'])
      // 'type' is the data-type of the POC.
      .combine('type', kScalarTypes)
      // 'value' is the value to use for the POC test.
      .expandWithParams(function* (p) {
        for (const val of interestingValuesOf(p.type)) {
          yield { value: Number(val) };
        }
      })
  )
  .fn(async t => {
    const overridable_name = 'my_overridable';
    const overridable_numeric_id = '1234';
    const override =
      t.params.id === 'name' ? '[[override]]' : `[[override(${overridable_numeric_id})]]`;
    const value = t.params.value;
    const type = t.params.type;
    const storage_type = t.params.type === 'bool' ? 'i32' : t.params.type;
    const to_storage_type = (val: string) =>
      t.params.type === 'bool' ? `select(0, 1, ${val})` : val;
    const initializer = (() => {
      switch (t.params.origin) {
        case 'initializer':
          return ` = ${wgslLiteralValue(value, type)}`;
        case 'override':
          return '';
        case 'initializer-with-override':
          return ` = ${type}()`;
      }
      return '';
    })();
    const wgsl = `
      ${override} let ${overridable_name}: ${type}${initializer};

      [[block]]
      struct Result {
        value : ${storage_type};
      };
      [[group(0), binding(0)]] var<storage, read_write> output : Result;

      [[stage(compute), workgroup_size(1)]]
      fn main() {
        output.value = ${to_storage_type(overridable_name)};
      }
      `;

    const constant_values: Record<string, number> = {};
    if (t.params.origin !== 'initializer') {
      switch (t.params.id) {
        case 'name':
          constant_values[overridable_name] = value;
          break;
        case 'numeric':
          constant_values[overridable_numeric_id] = value;
          break;
        default:
          assert(false, `unhandled value for origin: ${t.params.origin}`);
          break;
      }
    }

    const pipeline = t.device.createComputePipeline({
      compute: {
        module: t.device.createShaderModule({
          code: wgsl,
        }),
        entryPoint: 'main',
        constants: constant_values,
      },
    });

    const resultBuffer = t.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    t.trackForCleanup(resultBuffer);

    const bindGroup = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: resultBuffer,
          },
        },
      ],
    });

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatch(1);
    pass.endPass();
    t.queue.submit([encoder.finish()]);
    t.expectGPUBufferValuesEqual(resultBuffer, typedArrayFor(value, type));
  });
