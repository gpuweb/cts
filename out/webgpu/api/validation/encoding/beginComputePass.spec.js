/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Tests for validation in beginComputePass and GPUComputePassDescriptor as its optional descriptor.
`;import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ValidationTest } from '../validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('timestampWrites,same_location').
desc(
`
  Test that entries in timestampWrites do not have the same location in GPUComputePassDescriptor.
  `).

params((u) =>
u //
.combine('locationA', ['beginning', 'end']).
combine('locationB', ['beginning', 'end'])).

beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase(['timestamp-query']);
}).
fn(async (t) => {
  const { locationA, locationB } = t.params;

  const querySet = t.device.createQuerySet({
    type: 'timestamp',
    count: 2 });


  const timestampWriteA = {
    querySet,
    queryIndex: 0,
    location: locationA };


  const timestampWriteB = {
    querySet,
    queryIndex: 1,
    location: locationB };


  const isValid = locationA !== locationB;

  const descriptor = {
    timestampWrites: [timestampWriteA, timestampWriteB] };


  const encoder = t.device.createCommandEncoder();
  const computePass = encoder.beginComputePass(descriptor);
  computePass.end();

  t.expectValidationError(() => {
    encoder.finish();
  }, !isValid);
});
//# sourceMappingURL=beginComputePass.spec.js.map