export const description = `
Tests for validation in createQuerySet.
`;

import { params, poptions } from '../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ValidationTest } from '../validation_test.js';
import { kQueryTypes, kMaxQueryCount } from '../../../capability_info.js';

export const g = makeTestGroup(ValidationTest);

g.test('count')
  .desc(
    `
Tests that create query set with the count for all query types:
- count {<, =, >} kMaxQueryCount
- x= {occlusion, pipeline-statistics, timestamp} query
  `
  )
  .params(
    params()
      .combine(poptions('type', kQueryTypes))
      .combine(poptions('count', [0, kMaxQueryCount, kMaxQueryCount + 1]))
  )
  .fn(async t => {
    const { type, count } = t.params;

    if (type === 'pipeline-statistics') {
      await t.selectDeviceOrSkipTestCase({
        extensions: ['pipeline-statistics-query'],
      });
    } else if (type === 'timestamp') {
      await t.selectDeviceOrSkipTestCase({
        extensions: ['timestamp-query'],
      });
    }

    const pipelineStatistics =
      type === 'pipeline-statistics' ? (['clipper-invocations'] as const) : ([] as const);

    t.expectValidationError(() => {
      t.device.createQuerySet({ type, count, pipelineStatistics });
    }, count > kMaxQueryCount);
  });

g.test('pipelineStatistics')
  .desc(
    `
Tests that create query set with the GPUPipelineStatisticName for all query types:
- pipelineStatistics is undefined or empty
- pipelineStatistics is a sequence of valid values
- pipelineStatistics is a sequence of duplicate values
- x= {occlusion, pipeline-statistics, timestamp} query
  `
  )
  .params(
    params()
      .combine(poptions('type', kQueryTypes))
      .combine(
        poptions('pipelineStatistics', [
          undefined,
          [] as const,
          ['clipper-invocations'] as const,
          ['clipper-invocations', 'clipper-invocations'] as const,
          [
            'clipper-invocations',
            'clipper-primitives-out',
            'compute-shader-invocations',
            'fragment-shader-invocations',
            'vertex-shader-invocations',
          ] as const,
        ])
      )
      // Except pipeline statistics query, there is no need to test duplicate values and all values of GPUPipelineStatisticName
      .unless(
        ({ type, pipelineStatistics }) =>
          type !== 'pipeline-statistics' &&
          pipelineStatistics !== undefined &&
          pipelineStatistics.length >= 2
      )
  )
  .fn(async t => {
    const { type, pipelineStatistics } = t.params;

    if (type === 'pipeline-statistics') {
      await t.selectDeviceOrSkipTestCase({
        extensions: ['pipeline-statistics-query'],
      });
    } else if (type === 'timestamp') {
      await t.selectDeviceOrSkipTestCase({
        extensions: ['timestamp-query'],
      });
    }

    const count = 1;

    const shouldError =
      (type !== 'pipeline-statistics' &&
        pipelineStatistics !== undefined &&
        pipelineStatistics.length > 0) ||
      (type === 'pipeline-statistics' &&
        (pipelineStatistics === undefined ||
          pipelineStatistics.length === 0 ||
          pipelineStatistics.length !== Array.from(new Set(pipelineStatistics)).length));

    t.expectValidationError(() => {
      t.device.createQuerySet({ type, count, pipelineStatistics });
    }, shouldError);
  });
