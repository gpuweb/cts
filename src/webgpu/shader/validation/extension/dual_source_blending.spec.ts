export const description = `
Validation tests for the dual_source_blending extension
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('use_blend_src_requires_extension_enabled')
  .desc(
    `Checks that the blend_src attribute is only allowed with the WGSL extension
     dual_source_blending enabled in shader and the WebGPU extension dual-source-blending supported
     on the device.`
  )
  .params(u =>
    u.combine('requireExtension', [true, false]).combine('enableExtension', [true, false])
  )
  .beforeAllSubcases(t => {
    if (t.params.requireExtension) {
      t.selectDeviceOrSkipTestCase({ requiredFeatures: ['dual-source-blending'] });
    }
  })
  .fn(t => {
    const { requireExtension, enableExtension } = t.params;

    t.expectCompileResult(
      requireExtension && enableExtension,
      `
        ${enableExtension ? 'enable dual_source_blending;' : ''}
        struct FragOut {
          @location(0) @blend_src(0) color : vec4f,
          @location(0) @blend_src(1) blend : vec4f,
        }
        @fragment fn main() -> FragOut {
          var output : FragOut;
          output.color = vec4f(1.0, 0.0, 0.0, 1.0);
          output.blend = vec4f(0.0, 1.0, 0.0, 1.0);
          return output;
        }
    `
    );
  });
