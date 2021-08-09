export const description = `
Note: render pass 'occlusionQuerySet' validation is tested in queries/general.spec.ts

TODO: check for duplication (render_pass/, etc.), plan, and implement.
Note possibly a lot of this should be operation tests instead.
Notes:
> - color attachments {zero, one, multiple}
>     - many different formats (some are non-renderable)
>     - is a view on a texture with multiple mip levels or array layers
>     - two attachments use the same view, or views of {intersecting, disjoint} ranges
>     - {without, with} resolve target
>         - resolve format compatibility with multisampled format
>     - {all possible load ops, load color {in range, negative, too large}}
>     - all possible store ops
> - depth/stencil attachment
>     - {unset, all possible formats}
>     - {all possible {depth, stencil} load ops, load values {in range, negative, too large}}
>     - all possible {depth, stencil} store ops
>     - depthReadOnly {t,f}, stencilReadOnly {t,f}
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ValidationTest } from '../validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('color_attachments,device_mismatch')
  .desc(
    `
    Tests beginRenderPass cannot be called with color attachments whose texure view or resolve target is created from another device
    The 'view' and 'resolveTarget' are:
    - created from {same, different} device in same color attachment
    - created from same device in same color attachment, but different in another color attachment
    `
  )
  .paramsSubcasesOnly(u =>
    u.combine('sameAttachment', [true, false]).combine('mismatched', [true, false])
  )
  .unimplemented();

g.test('depth_stencil_attachment,device_mismatch')
  .desc(
    'Tests beginRenderPass cannot be called with a depth stencil attachment whose texure view is created from another device'
  )
  .paramsSubcasesOnly(u => u.combine('mismatched', [true, false]))
  .unimplemented();

g.test('occlusion_query_set,device_mismatch')
  .desc(
    'Tests beginRenderPass cannot be called with an occlusion query set created from another device'
  )
  .paramsSubcasesOnly(u => u.combine('mismatched', [true, false]))
  .unimplemented();
