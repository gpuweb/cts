export const description = `
TODO:
- interface matching between pipeline layout and shader
    - x= {compute, vertex, fragment, vertex+fragment}, visibilities
    - x= bind group index values, binding index values, multiple bindings
    - x= types of bindings
    - x= {equal, superset, subset}
`;

import { makeTestGroup } from '../../../common/framework/test_group.js';
import { kBindableResources } from '../../capability_info.js';

import { ValidationTest } from './validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('pipeline_layout_shader_match')
  .desc('')
  .params(u =>
    u
      .combine('bindingInPipeline', kBindableResources)
      .combine('bindingInShader', kBindableResources)
  )
  .fn(async t => {});
