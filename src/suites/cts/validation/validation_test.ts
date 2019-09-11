import { GPUTest } from '../gpu_test.js';

export class ValidationTest extends GPUTest {
  async init(): Promise<void> {
    await super.init();
    this.device.pushErrorScope('validation');
  }

  async expectValidationError(fn: Function): Promise<void> {
    return this.asyncExpectation(async () => {
      this.device.pushErrorScope('validation');

      fn();

      const gpuValidationError = await this.device.popErrorScope();
      if (!gpuValidationError) {
        this.fail('Validation error was expected.');
      }
    });
  }
}
