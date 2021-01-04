export const description = '';

import { params, pbool, poptions } from '../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { ValidationTest } from '../../validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('create_query_set')
  .desc(
    `
Tests that create query set with the type of timestamp shouldn't be valid without timestamp query
enabled.
- create query set with the type { occlusion, pipeline-statistics, timestamp }
- x = timestamp query { enable, disable }
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
      .combine(pbool('timestampQueryEnable'))
      .expand(p =>
        poptions('_valid', [
          p.type === 'occlusion' || (p.type === 'timestamp' && p.timestampQueryEnable),
        ])
      )
  )
  .fn(async t => {
    const { type, _pipelineStatistics, timestampQueryEnable, _valid } = t.params;

    if (timestampQueryEnable) {
      await t.selectDeviceOrSkipTestCase({
        extensions: ['timestamp-query'],
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
