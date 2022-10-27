export const description = `
Test operations of pushDebugGroup, popDebugGroup, and insertDebugMarker.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { kEncoderTypes } from '../../../util/command_buffer_maker.js';

export const g = makeTestGroup(GPUTest);

g.test('no_failure_without_debug_tool_attached')
  .desc(
    `
  Test that calling a marker API without a debugging tool attached doesn't cause a failure.
  `
  )
  .params(u =>
    u //
      .combine('encoderType', kEncoderTypes)
      .beginSubcases()
      .combine('pushLabel', ['', 'Event Start'])
      .combine('markerLabel', ['', 'Marker'])
  )
  .fn(async t => {
    const { encoderType, pushLabel, markerLabel } = t.params;

    const { encoder, validateFinishAndSubmit } = t.createEncoder(encoderType);
    encoder.pushDebugGroup(pushLabel);
    encoder.insertDebugMarker(markerLabel);
    encoder.popDebugGroup();
    validateFinishAndSubmit(true, true);
  });
