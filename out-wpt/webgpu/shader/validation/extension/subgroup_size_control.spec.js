/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Validation tests for the subgroup_size_control extension
`;import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { UniqueFeaturesAndLimitsShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(UniqueFeaturesAndLimitsShaderValidationTest);

g.test('enable_subgroup_size_control_requires_subgroups').
desc(
  `Checks that enabling the WGSL extension subgroup_size_control without also enabling the
     subgroups extension is a compilation error.`
).
params((u) => u.combine('enableSubgroups', [false, true])).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase({
    requiredFeatures: ['subgroup-size-control']
  });
}).
fn((t) => {
  const { enableSubgroups } = t.params;

  t.expectCompileResult(
    enableSubgroups,
    `
        ${enableSubgroups ? 'enable subgroups;' : ''}
        enable subgroup_size_control;
        @compute @workgroup_size(1)
        fn main() {}
      `
  );
});

g.test('use_subgroup_size_attribute_requires_subgroup_size_control_extension_enabled').
desc(
  `Checks that the @subgroup_size attribute is only allowed with the WGSL extension
     subgroup_size_control enabled in the shader and the WebGPU extension subgroup-size-control
     supported on the device.`
).
params((u) => u.combine('enableExtension', [false, true])).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase({
    requiredFeatures: ['subgroup-size-control']
  });
}).
fn((t) => {
  const { enableExtension } = t.params;

  const kSubgroupSize = 4;
  t.expectCompileResult(
    enableExtension,
    `
        enable subgroups;
        ${enableExtension ? 'enable subgroup_size_control;' : ''}
        @compute @workgroup_size(${kSubgroupSize}) @subgroup_size(${kSubgroupSize})
        fn main() {}
      `
  );
});

g.test('subgroup_size_attribute_only_valid_in_compute_stage').
desc(
  `Checks that the @subgroup_size attribute is only valid on a compute shader entry point.
     Applying it to a vertex or fragment entry point must be a compilation error.`
).
params((u) => u.combine('stage', ['compute', 'vertex', 'fragment'])).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase({
    requiredFeatures: ['subgroup-size-control']
  });
}).
fn((t) => {
  const { stage } = t.params;
  const kSubgroupSize = 4;

  const kStageShaders = {
    compute: `
    enable subgroups;
    enable subgroup_size_control;
    @compute @workgroup_size(${kSubgroupSize}) @subgroup_size(${kSubgroupSize})
    fn main() {}
  `,
    vertex: `
    enable subgroups;
    enable subgroup_size_control;
    @vertex @subgroup_size(${kSubgroupSize})
    fn main() -> @builtin(position) vec4f {
      return vec4f(0);
    }
  `,
    fragment: `
    enable subgroups;
    enable subgroup_size_control;
    @fragment @subgroup_size(${kSubgroupSize})
    fn main() -> @location(0) vec4f {
      return vec4f(0);
    }
  `
  };

  t.expectCompileResult(stage === 'compute', kStageShaders[stage]);
});