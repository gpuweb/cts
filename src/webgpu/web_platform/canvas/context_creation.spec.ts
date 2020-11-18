export const description = '';

import { Fixture } from '../../../common/framework/fixture.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';

export const g = makeTestGroup(Fixture);

// TODO: Test all possible combinations of context creation attributes.
g.test('return_type')
  .desc(
    `Test the return type of getContext for WebGPU.

TODO: Test all combinations of context creation attributes.`
  )
  .fn(async t => {
    if (typeof document === 'undefined') {
      // Skip if there is no document (Workers, Node)
      t.skip('DOM is not available to create canvas element');
    }

    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;

    // TODO: fix types so these aren't necessary
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const ctx: any = canvas.getContext('gpupresent');
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    t.expect(ctx instanceof (window as any).GPUCanvasContext);
  });

g.test('attributes_idl').desc('Tests invalid context creation attribute values.').unimplemented();
