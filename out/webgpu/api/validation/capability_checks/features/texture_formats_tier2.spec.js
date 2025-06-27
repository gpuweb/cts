/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Tests for capability checking for the 'texture-formats-tier2' feature.

Test that enabling texture-formats-tier2 also enables rg11b10ufloat-renderable and texture-formats-tier1

Tests that abilities enabled by 'texture-formats-tier2' correctly generate validation errors
when the feature is not enabled. This includes:
- read-write stoorage access formats gaining this capability.
`;import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { kTextureFormatsTier2EnablesStorageReadWrite } from '../../../../format_info.js';
import { UniqueFeaturesOrLimitsGPUTest } from '../../../../gpu_test.js';

export const g = makeTestGroup(UniqueFeaturesOrLimitsGPUTest);

g.test('enables_rg11b10ufloat_renderable_and_texture_formats_tier1').
desc(
  `
  Test that enabling texture-formats-tier2 also enables rg11b10ufloat-renderable and  texture-formats-tier1
  `
).
beforeAllSubcases((t) => t.selectDeviceOrSkipTestCase('texture-formats-tier2')).
fn((t) => {
  t.expect(() => t.device.features.has('rg11b10ufloat-renderable'));
  t.expect(() => t.device.features.has('texture-formats-tier1'));
});

g.test('bind_group_layout,storage_binding_read_write_access').
desc(
  `
  Test a bindGroupLayout with access 'read-write' and a format enabled by
  'texture-formats-tier2' fails if the feature is not enabled and succeeds
  if it is enabled.
  `
).
params((u) =>
u.
combine('format', kTextureFormatsTier2EnablesStorageReadWrite).
combine('enable_feature', [true, false])
).
beforeAllSubcases((t) => {
  const { enable_feature } = t.params;
  if (enable_feature) {
    t.selectDeviceOrSkipTestCase('texture-formats-tier2');
  }
}).
fn((t) => {
  const { format, enable_feature } = t.params;

  t.expectValidationError(() => {
    t.device.createBindGroupLayout({
      entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: {
          access: 'read-write',
          format
        }
      }]

    });
  }, !enable_feature);
});
//# sourceMappingURL=texture_formats_tier2.spec.js.map