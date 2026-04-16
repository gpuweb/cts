/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
API operations tests for timestamp queries.

Given the values returned are implementation defined
there is not much we can test except that there are no errors.

- test query with
  - compute pass
  - render pass
  - 64k query objects
  - resolving unused slots
`;import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { range } from '../../../../../common/util/util.js';
import { AllFeaturesMaxLimitsGPUTest } from '../../../../gpu_test.js';

export const g = makeTestGroup(AllFeaturesMaxLimitsGPUTest);

g.test('many_query_sets').
desc(
  `
Test creating and using 64k query objects.

This test is because there is a Metal limit of 32 MTLCounterSampleBuffers
Implementations are supposed to work around this limit by internally allocating
larger MTLCounterSampleBuffers and having the WebGPU sets be subsets of those
larger buffers.

This is particular important as the limit is 32 per process
so a few pages making a few queries would easily hit the limit
and prevent pages from running.
    `
).
params((u) =>
u.
combine('numQuerySets', [8, 16, 32, 64, 256, 65536]).
combine('stage', ['compute', 'render'])
).
fn(async (t) => {
  const { stage, numQuerySets } = t.params;

  t.skipIfDeviceDoesNotHaveFeature('timestamp-query');

  // At large numQuerySets, this test incurs a lot of validation, which can take several seconds.
  // Explicitly wrap the test in its own error scope to avoid triggering timeouts in test-cleanup.
  t.device.pushErrorScope('validation');
  try {
    const view = t.
    createTextureTracked({
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    }).
    createView();
    const encoder = t.device.createCommandEncoder();

    for (let i = 0; i < numQuerySets; ++i) {
      const querySet = t.createQuerySetTracked({
        type: 'timestamp',
        count: 2
      });

      switch (stage) {
        case 'compute':{
            const pass = encoder.beginComputePass({
              timestampWrites: {
                querySet,
                beginningOfPassWriteIndex: 0,
                endOfPassWriteIndex: 1
              }
            });
            pass.end();
            break;
          }
        case 'render':{
            const pass = encoder.beginRenderPass({
              colorAttachments: [{ view, loadOp: 'load', storeOp: 'store' }],
              timestampWrites: {
                querySet,
                beginningOfPassWriteIndex: 0,
                endOfPassWriteIndex: 1
              }
            });
            pass.end();
            break;
          }
      }
    }

    const shouldError = false; // just expect no error
    t.expectValidationError(() => t.device.queue.submit([encoder.finish()]), shouldError);
  } finally {
    const error = await t.device.popErrorScope();
    // Make sure there weren't any unexpected validation errors caught by the scope.
    t.expect(error === null, error?.message);
  }
});

function encoderQueryUsage(
t,
stage,
numQuerySets,
numSlots)
{
  const encoder = t.device.createCommandEncoder();

  const view = t.
  createTextureTracked({
    size: [1, 1, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT
  }).
  createView();

  const querySets = range(numQuerySets, (_) => {
    const querySet = t.createQuerySetTracked({
      type: 'timestamp',
      count: numSlots
    });

    switch (stage) {
      case 'compute':{
          for (let slot = 0; slot < numSlots; slot += 2) {
            const pass = encoder.beginComputePass({
              timestampWrites: {
                querySet,
                beginningOfPassWriteIndex: slot,
                endOfPassWriteIndex: slot + 1
              }
            });
            pass.end();
          }
          break;
        }
      case 'render':{
          for (let slot = 0; slot < numSlots; slot += 2) {
            const pass = encoder.beginRenderPass({
              colorAttachments: [{ view, loadOp: 'load', storeOp: 'store' }],
              timestampWrites: {
                querySet,
                beginningOfPassWriteIndex: slot,
                endOfPassWriteIndex: slot + 1
              }
            });
            pass.end();
          }
          break;
        }
    }

    return querySet;
  });
  return { encoder, querySets };
}

g.test('many_slots').
desc(
  `
Test creating and using 4k query slots.

Metal has the limit that a MTLCounterSampleBuffer can be max 32k which is 4k slots.
So, test we can use 4k slots across a few QuerySets
    `
).
params((u) => u.combine('stage', ['compute', 'render'])).
fn((t) => {
  const { stage } = t.params;

  t.skipIfDeviceDoesNotHaveFeature('timestamp-query');
  const kNumSlots = 4096;
  const kNumQuerySets = 4;

  const { encoder } = encoderQueryUsage(t, stage, kNumQuerySets, kNumSlots);
  t.device.queue.submit([encoder.finish()]);
});

g.test('resolve_unused_slots').
desc(
  `
Test resolving query sets with unused slots.

We create a command buffer that uses the slots but don't actually submit it
to make sure the implementation doesn't mistakenly mark them as used.
    `
).
params((u) => u.combine('stage', ['compute', 'render'])).
fn((t) => {
  const { stage } = t.params;

  t.skipIfDeviceDoesNotHaveFeature('timestamp-query');

  const kNumSlots = 4096;
  const kNumQuerySets = 2;

  // Create a encoder and encode usage of every query and slot but do not submit it.
  const querySets = (() => {
    const { encoder, querySets } = encoderQueryUsage(t, stage, kNumQuerySets, kNumSlots);
    encoder.finish();
    return querySets;
  })();

  // Read the slots, they should all be zero.
  const encoder = t.device.createCommandEncoder();
  const buffers = querySets.map((querySet, i) => {
    const resolveBuffer = t.createBufferTracked({
      size: kNumSlots * 8,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.QUERY_RESOLVE
    });
    encoder.resolveQuerySet(querySet, 0, kNumSlots, resolveBuffer, 0);
    return resolveBuffer;
  });
  t.device.queue.submit([encoder.finish()]);

  for (const buffer of buffers) {
    const expected = new Uint8Array(buffer.size);
    t.expectGPUBufferValuesEqual(buffer, expected);
  }
});
//# sourceMappingURL=timestampQuery.spec.js.map