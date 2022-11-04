export const description = `
Tests for capabilities added by rg11b10ufloat-renderable flag.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ValidationTest } from '../validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('create_texture_render_attachment')
  .desc(
    `
Test that it is valid to create texture with rg11b10ufloat texture format and
RENDER_ATTACHMENT usage is valid if rg11b10ufloat-renderable feature is enabled.
`
  )
  .unimplemented();

g.test('create_texture_multisampling')
  .desc(
    `
Test that it is valid to create texture with rg11b10ufloat texture format and
sampleCount > 1 if rg11b10ufloat-renderable feature is enabled.
`
  )
  .unimplemented();

g.test('begin_render_pass')
  .desc(
    `
Test that it is valid to begin render pass with rg11b10ufloat texture format
if rg11b10ufloat-renderable feature is enabled.
`
  )
  .unimplemented();

g.test('begin_render_bundle_encoder')
  .desc(
    `
Test that it is valid to begin render bundle encoder with rg11b10ufloat texture
format iff rg11b10ufloat-renderable feature is enabled.
`
  )
  .unimplemented();

g.test('create_render_pipeline')
  .desc(
    `
Test that it is valid to create render pipeline with rg11b10ufloat texture format
in descriptor.fragment.targets iff rg11b10ufloat-renderable feature is enabled.
`
  )
  .unimplemented();
