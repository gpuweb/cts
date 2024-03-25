export const description = `
Unittests for helpers in format_info.ts.
`;

import { Fixture } from '../common/framework/fixture.js';
import { makeTestGroup } from '../common/framework/test_group.js';
import { assert, objectEquals } from '../common/util/util.js';

import { kDepthStencilFormats, kTextureFormatInfo, resolvePerAspectFormat } from './format_info.js';

export const g = makeTestGroup(Fixture);

g.test('resolvePerAspectFormat')
  .desc(
    `Test that resolvePerAspectFormat works and kTextureFormatInfo contains identical
    information for the combined and separate versions of that aspect.`
  )
  .fn(t => {
    for (const format of kDepthStencilFormats) {
      const info = kTextureFormatInfo[format];
      if (info.depth) {
        const depthFormatInfo = kTextureFormatInfo[resolvePerAspectFormat(format, 'depth-only')];
        assert(objectEquals(info.depth, depthFormatInfo.depth), 'Error in texture format table');
      }
      if (info.stencil) {
        const stencilFormatInfo =
          kTextureFormatInfo[resolvePerAspectFormat(format, 'stencil-only')];
        assert(
          objectEquals(info.stencil, stencilFormatInfo.stencil),
          'Error in texture format table'
        );
      }
    }
  });
