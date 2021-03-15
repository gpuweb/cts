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

import { pbool } from '../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { ValidationTest } from '../../validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('occlusion_query,begin_end_balance')
  .desc(
    `
Tests that begin/end occlusion queries mismatch on render pass:
- begin 0, end 1 (begin no queries, then end one query)
- begin 1, end 0 (begin one query, then end no queries)
- begin 1, end 1 (begin one query, then end one query)(control case)
- begin 1, end 2 (begin one query, then end two queries)
- begin 2, end 1 (begin two queries, then end one query)
  `
  )
  .subcases(
    () =>
      [
        { begin: 0, end: 1 },
        { begin: 1, end: 0 },
        { begin: 1, end: 1 },
        { begin: 1, end: 2 },
        { begin: 2, end: 1 },
      ] as const
  )
  .unimplemented();

g.test('occlusion_query,begin_end_invalid_nesting')
  .desc(
    `
Tests the invalid nesting of begin/end occlusion queries:
- begin index 0, begin index 0, end, end
- begin index 0, begin index 1, end, end
  `
  )
  .subcases(() => [{ calls: [0, 0, 'end', 'end'] }, { calls: [0, 1, 'end', 'end'] }] as const)
  .unimplemented();

g.test('occlusion_query,disjoint_queries_with_same_query_index')
  .desc(
    `
Tests that two disjoint occlusion queries cannot be begun with same query index on same render pass:
- begin index 0, end, begin index 0, end
- call on {same (invalid), different (control case)} render pass
  `
  )
  .subcases(() => pbool('isOnSameRenderPass'))
  .unimplemented();

g.test('nesting')
  .desc(
    `
Tests that whether it's allowed to nest various types of queries:
- beginOcclusionQuery, writeTimestamp, endOcclusionQuery
- beginOcclusionQuery, beginOcclusionQuery, endOcclusionQuery, endOcclusionQuery
- beginOcclusionQuery, beginPipelineStatisticsQuery, endPipelineStatisticsQuery, endOcclusionQuery
- beginOcclusionQuery, beginPipelineStatisticsQuery, endOcclusionQuery, endPipelineStatisticsQuery
- beginPipelineStatisticsQuery, writeTimestamp, endPipelineStatisticsQuery
- beginPipelineStatisticsQuery, beginPipelineStatisticsQuery, endPipelineStatisticsQuery, endPipelineStatisticsQuery
- beginPipelineStatisticsQuery, beginOcclusionQuery, endOcclusionQuery, endPipelineStatisticsQuery
- beginPipelineStatisticsQuery, beginOcclusionQuery, endPipelineStatisticsQuery, endOcclusionQuery
- writeTimestamp, beginOcclusionQuery, writeTimestamp, endOcclusionQuery
- writeTimestamp, beginPipelineStatisticsQuery, writeTimestamp, endPipelineStatisticsQuery
  `
  )
  .subcases(
    () =>
      [
        { begin: 'occlusion', nest: 'timestamp', end: 'occlusion', _valid: true },
        { begin: 'occlusion', nest: 'occlusion', end: 'occlusion', _valid: false },
        { begin: 'occlusion', nest: 'pipeline-statistcs', end: 'occlusion', _valid: true },
        { begin: 'occlusion', nest: 'pipeline-statistcs', end: 'pipeline-statistcs', _valid: true },
        { begin: 'pipeline-statistcs', nest: 'timestamp', end: 'pipeline-statistcs', _valid: true },
        {
          begin: 'pipeline-statistcs',
          nest: 'pipeline-statistcs',
          end: 'pipeline-statistcs',
          _valid: false,
        },
        { begin: 'pipeline-statistcs', nest: 'occlusion', end: 'pipeline-statistcs', _valid: true },
        { begin: 'pipeline-statistcs', nest: 'occlusion', end: 'occlusion', _valid: true },
        { begin: 'timestamp', nest: 'occlusion', end: 'occlusion', _valid: true },
        { begin: 'timestamp', nest: 'pipeline-statistcs', end: 'pipeline-statistcs', _valid: true },
      ] as const
  )
  .unimplemented();
