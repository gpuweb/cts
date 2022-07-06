export const description = `
Tests for GPUCanvasContext.getPreferredFormat.
`;

import { Fixture } from '../../../common/framework/fixture.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';

export const g = makeTestGroup(Fixture);

g.test('value')
  .desc(
    `
    Ensure getPreferredCanvasFormat returns one of the valid values.
    `
  )
  .fn(async t => {
    const preferredFormat = navigator.gpu.getPreferredCanvasFormat();
    t.expect(preferredFormat === 'bgra8unorm' || preferredFormat === 'rgba8unorm');
  });
