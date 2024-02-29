export const description = `
Execution tests for the 'dpdxFine' builtin function

T is f32 or vecN<f32>
fn dpdxFine(e:T) ->T
Returns the partial derivative of e with respect to window x coordinates.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';

import { d } from './derivatives.cache.js';
import { runDerivativeTest } from './derivatives.js';

export const g = makeTestGroup(GPUTest);

const builtin = 'dpdxFine';

g.test('f32')
  .specURL('https://www.w3.org/TR/WGSL/#derivative-builtin-functions')
  .params(u => u.combine('vectorize', [undefined, 2, 3, 4] as const))
  .fn(async t => {
    const cases = await d.get('scalar');
    runDerivativeTest(t, cases, builtin, t.params.vectorize);
  });
