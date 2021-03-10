export const description = `
Validation for encoding begin/endable queries.

TODO:
- balance: {
    - begin 0, end 1
    - begin 1, end 0
    - begin 1, end 1
    - begin 2, end 2
    - }
    - x= {
        - render pass + pipeline statistics
        - compute pass + pipeline statistics
        - }
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { ValidationTest } from '../../validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('occlusion_query,begin_end')
  .desc(
    `
Tests that begin/end occlusion query on render pass:
- begin 0
- begin 0, end (control case)
- begin 0, begin 1, end
- begin 0, end, end
- end
  `
  )
  .unimplemented();

g.test('occlusion_query,begin_with_same_query_index')
  .desc(
    `
Tests that begin occlusion query with same query index twice:
- on {same, different (control case)} render pass
  `
  )
  .unimplemented();

g.test('nesting')
  .desc(
    `
Tests that whether it's allowed to nest various types of queries:
- beginOcclusionQuery, writeTimestamp, endOcclusionQuery
- beginOcclusionQuery, beginPipelineStatisticsQuery, endPipelineStatisticsQuery, endOcclusionQuery
- beginOcclusionQuery, beginPipelineStatisticsQuery, endOcclusionQuery, endPipelineStatisticsQuery
- beginPipelineStatisticsQuery, writeTimestamp, endPipelineStatisticsQuery
- beginPipelineStatisticsQuery, beginOcclusionQuery, endOcclusionQuery, endPipelineStatisticsQuery
- beginPipelineStatisticsQuery, beginOcclusionQuery, endPipelineStatisticsQuery, endOcclusionQuery
- writeTimestamp, beginOcclusionQuery, writeTimestamp, endOcclusionQuery
- writeTimestamp, beginPipelineStatisticsQuery, writeTimestamp, endPipelineStatisticsQuery
  `
  )
  .unimplemented();
