export const description = `
Validation tests for setPipeline on render pass and render bundle.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { kRenderEncodeTypes } from '../../../../../util/command_buffer_maker.js';
import { ValidationTest } from '../../../validation_test.js';

import { kRenderEncodeTypeParams } from './render.js';

class F extends ValidationTest {
  createRenderPipelineForMismatch(device: GPUDevice) {
    return device.createRenderPipeline({
      vertex: {
        module: device.createShaderModule({
          code: `@stage(vertex) fn main() -> @builtin(position) vec4<f32> { return vec4<f32>(); }`,
        }),
        entryPoint: 'main',
      },
      fragment: {
        module: device.createShaderModule({
          code: '@stage(fragment) fn main() {}',
        }),
        entryPoint: 'main',
        targets: [{ format: 'rgba8unorm', writeMask: 0 }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }
}

export const g = makeTestGroup(F);

g.test('invalid_pipeline')
  .desc(
    `
Tests setPipeline should generate an error iff using an 'invalid' pipeline.
  `
  )
  .paramsSubcasesOnly(u =>
    u.combine('encoderType', kRenderEncodeTypes).combine('state', ['valid', 'invalid'] as const)
  )
  .fn(t => {
    const { encoderType, state } = t.params;
    const pipeline = t.createRenderPipelineWithState(state);

    const { encoder, validateFinish } = t.createEncoder(encoderType);
    encoder.setPipeline(pipeline);
    validateFinish(state !== 'invalid');
  });

g.test('pipeline,device_mismatch')
  .desc('Tests setPipeline cannot be called with a render pipeline created from another device')
  .paramsSubcasesOnly(kRenderEncodeTypeParams.combine('mismatched', [true, false]))
  .fn(async t => {
    const { encoderType, mismatched } = t.params;

    const pipeline = mismatched
      ? t.createRenderPipelineForMismatch(t.mismatchedDevice)
      : t.createRenderPipelineForMismatch(t.device);

    const { encoder, validateFinish } = t.createEncoder(encoderType);
    encoder.setPipeline(pipeline);
    validateFinish(!mismatched);
  });
