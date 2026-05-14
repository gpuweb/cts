export const description = `
Validation tests for the subgroup_size_control extension
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { UniqueFeaturesAndLimitsShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(UniqueFeaturesAndLimitsShaderValidationTest);

/**
 * Returns a subgroup size value that is valid for use in the @subgroup_size
 * attribute on the current adapter.
 *
 * On Intel gen-12lp, subgroupMinSize may be 8 in fragment stages, which is below the allowed range
 * for `[WaveSize]` on D3D12 (can only be 16). subgroupMaxSize (16) is always within the explicit
 * range, so it is returned for that architecture.
 * On all other adapters, subgroupMinSize is returned as the conservative choice as on many D3D12
 * drivers only `waveLaneCountMin` is reliable, while `waveLaneCountMax` is not.
 *
 * @param adapterInfo The GPUAdapterInfo of the current device's adapter.
 * @returns A power-of-two subgroup size valid for @subgroup_size on this adapter.
 */
export function getValidSubgroupSizeForSubgroupSizeAttribute(adapterInfo: GPUAdapterInfo): number {
  interface SubgroupAdapterInfo extends GPUAdapterInfo {
    subgroupMinSize: number;
    subgroupMaxSize: number;
  }
  const { vendor, architecture, subgroupMinSize, subgroupMaxSize } =
    adapterInfo as SubgroupAdapterInfo;
  return vendor === 'intel' && architecture === 'gen-12lp' ? subgroupMaxSize : subgroupMinSize;
}

g.test('enable_subgroup_size_control_requires_subgroups')
  .desc(
    `Checks that enabling the WGSL extension subgroup_size_control without also enabling the
     subgroups extension is a compilation error.`
  )
  .params(u => u.combine('enableSubgroups', [false, true] as const))
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase({
      requiredFeatures: ['subgroup-size-control' as GPUFeatureName],
    });
  })
  .fn(t => {
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

g.test('use_subgroup_size_attribute_requires_subgroup_size_control_extension_enabled')
  .desc(
    `Checks that the @subgroup_size attribute is only allowed with the WGSL extension
     subgroup_size_control enabled in the shader and the WebGPU extension subgroup-size-control
     supported on the device.`
  )
  .params(u => u.combine('enableExtension', [false, true] as const))
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase({
      requiredFeatures: ['subgroup-size-control' as GPUFeatureName],
    });
  })
  .fn(t => {
    const { enableExtension } = t.params;

    const subgroupSize = getValidSubgroupSizeForSubgroupSizeAttribute(t.device.adapterInfo);
    t.expectCompileResult(
      enableExtension,
      `
        ${enableExtension ? 'enable subgroups; enable subgroup_size_control;' : ''}
        @compute @workgroup_size(${subgroupSize}) @subgroup_size(${subgroupSize})
        fn main() {}
      `
    );
  });

const kStageShaders = {
  compute: (subgroupSize: number) => `
    enable subgroups;
    enable subgroup_size_control;
    @compute @workgroup_size(${subgroupSize}) @subgroup_size(${subgroupSize})
    fn main() {}
  `,
  vertex: (subgroupSize: number) => `
    enable subgroups;
    enable subgroup_size_control;
    @vertex @subgroup_size(${subgroupSize})
    fn main() -> @builtin(position) vec4f {
      return vec4f(0);
    }
  `,
  fragment: (subgroupSize: number) => `
    enable subgroups;
    enable subgroup_size_control;
    @fragment @subgroup_size(${subgroupSize})
    fn main() -> @location(0) vec4f {
      return vec4f(0);
    }
  `,
} as const;

g.test('subgroup_size_attribute_only_valid_in_compute_stage')
  .desc(
    `Checks that the @subgroup_size attribute is only valid on a compute shader entry point.
     Applying it to a vertex or fragment entry point must be a compilation error.`
  )
  .params(u => u.combine('stage', ['compute', 'vertex', 'fragment'] as const))
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase({
      requiredFeatures: ['subgroup-size-control' as GPUFeatureName],
    });
  })
  .fn(t => {
    const { stage } = t.params;
    const subgroupSize = getValidSubgroupSizeForSubgroupSizeAttribute(t.device.adapterInfo);

    t.expectCompileResult(stage === 'compute', kStageShaders[stage](subgroupSize));
  });
