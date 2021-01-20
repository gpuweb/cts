export const description = '';

import { params, pbool, poptions } from '../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { ValidationTest } from '../../validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('create_query_set')
  .desc(
    `
Tests that create query set with the type of pipeline-statistics shouldn't be valid without pipeline
statistics query enabled.
- create query set with the type { occlusion, pipeline-statistics, timestamp }
- x = pipeline statistics query { enable, disable }
  `
  )
  .params(
    params()
      .combine(poptions('type', ['occlusion', 'pipeline-statistics', 'timestamp'] as const))
      .combine(pbool('pipelineStatisticsQueryEnable'))
      .expand(p =>
        poptions('_pipelineStatistics', [
          p.type === 'pipeline-statistics' ? (['clipper-invocations'] as const) : ([] as const),
        ])
      )
  )
  .fn(async t => {
    const { type, pipelineStatisticsQueryEnable, _pipelineStatistics } = t.params;

    if (pipelineStatisticsQueryEnable) {
      await t.selectDeviceOrSkipTestCase({
        extensions: ['pipeline-statistics-query'],
      });
    }

    t.expectValidationError(() => {
      t.device.createQuerySet({ type, count: 1, pipelineStatistics: _pipelineStatistics });
    }, type === 'timestamp' || (type === 'pipeline-statistics' && !pipelineStatisticsQueryEnable));
  });
