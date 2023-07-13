export const description = `
Tests that you can not create a render pipeline with a shader module that uses sample_mask in compat mode.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ValidationTest } from '../../../../webgpu/api/validation/validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('sample_mask')
  .desc(
    `
Tests that you can not create a render pipeline with a shader module that uses sample_mask in compat mode.

- Test that a pipeline with a shader that uses sample_mask fails.
- Test that a pipeline that references a module that has a shader that uses sample_mask
  but the pipeline does not reference that shader succeeds.
    `
  )
  .params(u =>
    u.combine('entryPoint', ['fsWithoutSampleMaskUsage', 'fsWithSampleMaskUsage'] as const)
  )
  .fn(t => {
    const { entryPoint } = t.params;

    const module = t.device.createShaderModule({
      code: `
       @vertex fn vs() -> @builtin(position) vec4f {
            return vec4f(1);
        }
        struct Output {
            @builtin(sample_mask) mask_out: u32,
            @location(0) color : vec4f,
        }
        @fragment fn fsWithoutSampleMaskUsage() -> @location(0) vec4f {
            return vec4f(1.0, 1.0, 1.0, 1.0);
        }
        @fragment fn fsWithSampleMaskUsage() -> Output {
            var o: Output;
            // We need to make sure this sample_mask isn't optimized out even its value equals "no op".
            o.mask_out = 0xFFFFFFFFu;
            o.color = vec4f(1.0, 1.0, 1.0, 1.0);
            return o;
        }
      `,
    });

    const pipelineDescriptor: GPURenderPipelineDescriptor = {
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs',
      },
      fragment: {
        module,
        entryPoint,
        targets: [
          {
            format: 'rgba8unorm',
          },
        ],
      },
      multisample: {
        count: 4,
      },
    };

    const isValid = entryPoint === 'fsWithoutSampleMaskUsage';
    t.expectGPUError(
      'validation',
      () => t.device.createRenderPipeline(pipelineDescriptor),
      !isValid
    );
  });
