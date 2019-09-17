export const description = `
error scope validation tests.
`;

import { getGPU } from '../../../framework/gpu/implementation.js';
import { Fixture, TestGroup } from '../../../framework/index.js';

class F extends Fixture {
  device: GPUDevice = undefined!;

  async init(): Promise<void> {
    super.init();
    const gpu = getGPU();
    const adapter = await gpu.requestAdapter();
    this.device = await adapter.requestDevice();
  }

  createErrorBuffer(): void {
    this.device.createBuffer({
      size: 1024,
      usage: 0xffff, // Invalid GPUBufferUsage
    });
  }

  async expectUncapturedError(fn: Function): Promise<void> {
    return this.asyncExpectation(async () => {
      const promise = new Promise(resolve => {
        this.device.addEventListener('uncapturederror', resolve, { once: true });
      });

      fn();

      await promise;
    });
  }
}

export const g = new TestGroup(F);

g.test('simple case where the error scope catches an error', async t => {
  t.device.pushErrorScope('validation');

  t.createErrorBuffer();

  const error = await t.device.popErrorScope();
  t.expect(error instanceof GPUValidationError);
});

g.test('errors bubble to the parent scope if not handled by the current scope', async t => {
  t.device.pushErrorScope('validation');
  t.device.pushErrorScope('out-of-memory');

  t.createErrorBuffer();

  {
    const error = await t.device.popErrorScope();
    t.expect(error === null);
  }
  {
    const error = await t.device.popErrorScope();
    t.expect(error instanceof GPUValidationError);
  }
});

g.test('if an error scope matches an error it does not bubble to the parent scope', async t => {
  t.device.pushErrorScope('out-of-memory');
  t.device.pushErrorScope('validation');

  t.createErrorBuffer();

  {
    const error = await t.device.popErrorScope();
    t.expect(error instanceof GPUValidationError);
  }
  {
    const error = await t.device.popErrorScope();
    t.expect(error === null);
  }
});

g.test('if no error scope handles an error it fires an uncapturederror event', async t => {
  t.device.pushErrorScope('out-of-memory');

  t.expectUncapturedError(() => {
    t.createErrorBuffer();
  });

  const error = await t.device.popErrorScope();
  t.expect(error === null);
});

g.test('push/popping error scopes must be balanced', async t => {
  {
    const promise = t.device.popErrorScope();
    await t.shouldReject('OperationError', promise);
  }
  t.device.pushErrorScope('validation');
  {
    const error = await t.device.popErrorScope();
    t.expect(error === null);
  }
  {
    const promise = t.device.popErrorScope();
    await t.shouldReject('OperationError', promise);
  }
});
