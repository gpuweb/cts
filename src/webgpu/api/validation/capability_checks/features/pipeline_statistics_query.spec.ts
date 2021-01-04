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
      .expand(p =>
        poptions('_pipelineStatistics', [
          p.type === 'pipeline-statistics' ? (['clipper-invocations'] as const) : ([] as const),
        ])
      )
      .combine(pbool('pipelineStatisticsQueryEnable'))
      .expand(p =>
        poptions('_valid', [
          p.type === 'occlusion' ||
            (p.type === 'pipeline-statistics' && p.pipelineStatisticsQueryEnable),
        ])
      )
  )
  .fn(async t => {
    const { type, _pipelineStatistics, pipelineStatisticsQueryEnable, _valid } = t.params;

    if (pipelineStatisticsQueryEnable) {
      await t.selectDeviceOrSkipTestCase({
        extensions: ['pipeline-statistics-query'],
      });
    }

    const count = 1;

    if (_valid) {
      t.device.createQuerySet({ type, count, pipelineStatistics: _pipelineStatistics });
    } else {
      t.expectValidationError(() => {
        t.device.createQuerySet({ type, count, pipelineStatistics: _pipelineStatistics });
      });
    }
  });
