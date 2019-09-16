export const description = `
fences validation tests.
`;

import { TestGroup } from '../../../framework/index.js';

import { ValidationTest } from './validation_test.js';

export const g = new TestGroup(ValidationTest);

g.test('fence creation succeeds', t => {
  t.queue.createFence();
});

g.test('fence starts at initial value', t => {
  const fence = t.queue.createFence({ initialValue: 1 });
  t.expect(fence.getCompletedValue() === 1);
});

g.test('onCompletion resolves immediately for completed fence values', async t => {
  const fence = t.queue.createFence({ initialValue: 1 });

  await Promise.all([fence.onCompletion(0), fence.onCompletion(1)]);
});

// TODO: Remove if https://github.com/gpuweb/gpuweb/issues/377 is decided
g.test('set onCompletion for values greater than signaled value', async t => {
  const fence = t.queue.createFence({ initialValue: 1 });

  await t.shouldReject('OperationError', fence.onCompletion(2));

  t.queue.signal(fence, 2);
  await fence.onCompletion(2);
});

g.test('get completed value inside callback', async t => {
  const fence = t.queue.createFence({ initialValue: 1 });

  t.queue.signal(fence, 3);
  await fence.onCompletion(2);

  t.expect(fence.getCompletedValue() === 3);
});

g.test('get completed value after callback', async t => {
  const fence = t.queue.createFence({ initialValue: 1 });

  t.queue.signal(fence, 2);
  await fence.onCompletion(2);

  t.expect(fence.getCompletedValue() === 2);
});

g.test('value lower than signaled value raises error', async t => {
  const fence = t.queue.createFence({ initialValue: 1 });

  await t.expectValidationError(() => {
    t.queue.signal(fence, 0);
  });
});

g.test('value equal to signaled value raises error', async t => {
  const fence = t.queue.createFence({ initialValue: 1 });

  await t.expectValidationError(() => {
    t.queue.signal(fence, 1);
  });
});

g.test('increasing fence value by more than 1 succeeds', async t => {
  const fence = t.queue.createFence({ initialValue: 1 });

  t.queue.signal(fence, 2);
  await fence.onCompletion(2);

  t.queue.signal(fence, 6);
  await fence.onCompletion(6);
});

g.test('signal a fence on a different queue than it was created on raises error', async t => {
  const fence = t.queue.createFence({ initialValue: 1 });

  const anotherDevice = await t.device.adapter.requestDevice();
  const anotherQueue = anotherDevice.getQueue();

  await t.expectValidationError(() => {
    anotherQueue.signal(fence, 2);
  });
});

g.test('signal a fence on a wrong queue does not update fence signaled value', async t => {
  const fence = t.queue.createFence({ initialValue: 1 });

  const anotherDevice = await t.device.adapter.requestDevice();
  const anotherQueue = anotherDevice.getQueue();

  await t.expectValidationError(() => {
    anotherQueue.signal(fence, 2);
  });

  t.expect(fence.getCompletedValue() === 1);

  t.queue.signal(fence, 2);
  t.expect(fence.getCompletedValue() === 2);
});
