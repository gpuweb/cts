export const description = `
Tests for validation in createQuerySet.
`;

import { poptions } from '../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ValidationTest } from '../validation_test.js';

export const g = makeTestGroup(ValidationTest);

const kMaxQueryCount = 8192;

// Test with these query counts.
const kQueryCounts: number[] = [
  // valid
  0,
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
  - pipelineStatistics is undefined or empty
- invalid cases:
  - count > kMaxQueryCount
  - pipelineStatistics is set with pipeline statistic names
  `
  )
  .params([
    ...poptions('count', kQueryCounts),
    ...poptions('pipelineStatistics', [
      // valid
      undefined,
      [],
      // invalid
      ['clipper-invocations'],
    ]),
  ])
  .fn(t => {
    const { count = 1, pipelineStatistics } = t.params as {
      count?: number;
      pipelineStatistics?: GPUPipelineStatisticName[];
    };

    t.expectValidationError(() => {
      t.device.createQuerySet({ type: 'occlusion', count, pipelineStatistics });
    }, count > kMaxQueryCount || (pipelineStatistics !== undefined && pipelineStatistics.length > 0));
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
  - pipelineStatistics is undefined, empty or duplicated
  `
  )
  .params([
    ...poptions('count', kQueryCounts),
    ...poptions('pipelineStatistics', [
      // valid
      ['clipper-invocations'],
      // invalid
      undefined,
      [],
      ['clipper-invocations', 'clipper-invocations'],
    ]),
  ])
  .fn(async t => {
    await t.selectDeviceOrSkipTestCase({
      extensions: ['pipeline-statistics-query'],
    });

    const { count = 1, pipelineStatistics = ['vertex-shader-invocations'] } = t.params as {
      count?: number;
      pipelineStatistics?: GPUPipelineStatisticName[];
    };

    // If the pipelineStatistics is passed as undefined, the default value 'vertex-shader-invocations'
    // is got here, test it with undefined seperately.
    if (count === 1 && pipelineStatistics[0] === 'vertex-shader-invocations') {
      t.expectValidationError(() => {
        t.device.createQuerySet({ type: 'pipeline-statistics', count });
      });
    } else {
      const shouldError =
        count > kMaxQueryCount ||
        pipelineStatistics.length === 0 ||
        pipelineStatistics.length !== Array.from(new Set(pipelineStatistics)).length;

      t.expectValidationError(() => {
        t.device.createQuerySet({ type: 'pipeline-statistics', count, pipelineStatistics });
      }, shouldError);
    }
  });

g.test('timestamp')
  .desc(
    `
Tests that create query set with the type of timestamp.
- control cases:
  - count <= kMaxQueryCount
  - pipelineStatistics is undefined or empty
- invalid cases:
  - count > kMaxQueryCount
  - pipelineStatistics is set with pipeline statistic names
  `
  )
  .params([
    ...poptions('count', kQueryCounts),
    ...poptions('pipelineStatistics', [
      // valid
      undefined,
      [],
      // invalid
      ['clipper-invocations'],
    ]),
  ])
  .fn(async t => {
    await t.selectDeviceOrSkipTestCase({
      extensions: ['timestamp-query'],
    });

    const { count = 1, pipelineStatistics } = t.params as {
      count?: number;
      pipelineStatistics?: GPUPipelineStatisticName[];
    };

    t.expectValidationError(() => {
      t.device.createQuerySet({ type: 'timestamp', count, pipelineStatistics });
    }, count > kMaxQueryCount || (pipelineStatistics !== undefined && pipelineStatistics.length > 0));
  });
