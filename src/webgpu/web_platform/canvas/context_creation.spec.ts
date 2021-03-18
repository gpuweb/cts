export const description = '';

import { Fixture } from '../../../common/framework/fixture.js';
import { pbool } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';

export const g = makeTestGroup(Fixture);

g.test('return_type')
  .desc(
    `Test the return type of getContext for WebGPU.

TODO: Test all combinations of context creation attributes.`
  )
  .cases(pbool('offscreen'))
  .fn(async t => {
    let canvas: HTMLCanvasElement | OffscreenCanvas;
    if (t.params.offscreen) {
      if (typeof OffscreenCanvas === 'undefined') {
        // Skip if the current context doesn't have OffscreenCanvas (e.g. Node).
        t.skip('OffscreenCanvas is not available in this context');
      }

      canvas = new OffscreenCanvas(10, 10);
    } else {
      if (typeof document === 'undefined') {
        // Skip if there is no document (Workers, Node)
        t.skip('DOM is not available to create canvas element');
      }

      canvas = document.createElement('canvas');
      canvas.width = 10;
      canvas.height = 10;
    }

    const ctx = canvas.getContext('gpupresent');
    t.expect(ctx instanceof GPUCanvasContext);
  });

g.test('attributes_idl').desc('Tests invalid context creation attribute values.').unimplemented();
