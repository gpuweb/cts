export const description = `
Tests for validation in createQuerySet.
`;

import { params, poptions } from '../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ValidationTest } from '../validation_test.js';

export const g = makeTestGroup(ValidationTest);

const kMaxQueryCount = 8192;

// Test with these query counts.
const kQueryCounts: number[] = [
  // valid
  0,
  1,
  128,
  kMaxQueryCount,
  // invalid
  kMaxQueryCount + 1,
];

g.test('occlusion')
  .desc(
    `
Tests that create query set with the type of occlusion.
- control cases:
  - count <= kMaxQueryCount
  - pipelineStatistics is undefined
- invalid cases:
  - count > kMaxQueryCount
  - pipelineStatistics is set with pipeline statistic names
  `
  )
  .params(
    params()
      .combine(poptions('count', kQueryCounts))
      .combine(
        poptions('pipelineStatistics', [
          // valid
          undefined,
          [] as const,
          // invalid
          ['clipper-invocations'] as const,
        ])
      )
      .expand(p =>
        poptions('_valid', [
          p.count <= kMaxQueryCount &&
            (p.pipelineStatistics === undefined || p.pipelineStatistics.length === 0),
        ])
      )
      // TODO(hao.x.li@intel.com): zero-sized query set is not implemented.
      .filter(({ count }) => count !== 0)
  )
  .fn(t => {
    const { count, pipelineStatistics, _valid } = t.params;
    const type = 'occlusion';

    if (_valid) {
      t.device.createQuerySet({ type, count, pipelineStatistics });
    } else {
      t.expectValidationError(() => {
        t.device.createQuerySet({ type, count, pipelineStatistics });
      });
    }
  });

g.test('pipeline_statistics')
  .desc(
    `
Tests that create query set with the type of pipeline-statistics.
- control cases:
  - count <= kMaxQueryCount
  - pipelineStatistics is set with pipeline statistic names
- invalid cases:
  - count > kMaxQueryCount
  - pipelineStatistics is undefined or duplicated
  `
  )
  .params(
    params()
      .combine(poptions('count', kQueryCounts))
      .combine(
        poptions('pipelineStatistics', [
          // invalid
          undefined,
          [] as const,
          ['clipper-invocations', 'clipper-invocations'] as const,
          // valid
          ['clipper-invocations'] as const,
          [
            'clipper-invocations',
            'clipper-primitives-out',
            'compute-shader-invocations',
            'fragment-shader-invocations',
            'vertex-shader-invocations',
          ] as const,
        ])
      )
      .expand(p =>
        poptions('_valid', [
          p.count <= kMaxQueryCount &&
            p.pipelineStatistics !== undefined &&
            p.pipelineStatistics.length > 0 &&
            p.pipelineStatistics.length === Array.from(new Set(p.pipelineStatistics)).length,
        ])
      )
      // TODO(hao.x.li@intel.com): zero-sized query set is not implemented.
      .filter(({ count }) => count !== 0)
  )
  .fn(async t => {
    await t.selectDeviceOrSkipTestCase({
      extensions: ['pipeline-statistics-query'],
    });

    const { count, pipelineStatistics, _valid } = t.params;
    const type = 'pipeline-statistics';

    if (_valid) {
      t.device.createQuerySet({ type, count, pipelineStatistics });
    } else {
      t.expectValidationError(() => {
        t.device.createQuerySet({ type, count, pipelineStatistics });
      });
    }
  });

g.test('timestamp')
  .desc(
    `
Tests that create query set with the type of timestamp.
- control cases:
  - count <= kMaxQueryCount
  - pipelineStatistics is undefined
- invalid cases:
  - count > kMaxQueryCount
  - pipelineStatistics is set with pipeline statistic names
  `
  )
  .params(
    params()
      .combine(poptions('count', kQueryCounts))
      .combine(
        poptions('pipelineStatistics', [
          // valid
          undefined,
          [] as const,
          // invalid
          ['clipper-invocations'] as const,
        ])
      )
      .expand(p =>
        poptions('_valid', [
          p.count <= kMaxQueryCount &&
            (p.pipelineStatistics === undefined || p.pipelineStatistics.length === 0),
        ])
      )
      // TODO(hao.x.li@intel.com): zero-sized query set is not implemented.
      .filter(({ count }) => count !== 0)
  )
  .fn(async t => {
    await t.selectDeviceOrSkipTestCase({
      extensions: ['timestamp-query'],
    });

    const { count, pipelineStatistics, _valid } = t.params;
    const type = 'timestamp';

    if (_valid) {
      t.device.createQuerySet({ type, count, pipelineStatistics });
    } else {
      t.expectValidationError(() => {
        t.device.createQuerySet({ type, count, pipelineStatistics });
      });
    }
  });
