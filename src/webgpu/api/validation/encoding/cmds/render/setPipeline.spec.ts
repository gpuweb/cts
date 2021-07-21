export const description = `
Validation tests for setPipeline on render pass and render bundle.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { kRenderEncodeTypes } from '../../../util/command_buffer_maker.js';
import { ValidationTest } from '../../../validation_test.js';

export const g = makeTestGroup(ValidationTest);

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
