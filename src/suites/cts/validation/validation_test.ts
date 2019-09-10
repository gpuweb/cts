import { GPUTest } from '../gpu_test.js';

export class ValidationTest extends GPUTest {
  async init(): Promise<void> {
    await super.init();

    this.device.pushErrorScope('validation');
  }

  async finalize(): Promise<void> {
    await super.finalize();

    // TODO: Remove queue submission when not needed anymore.
    this.queue.submit([]);

    const gpuValidationError = await this.device.popErrorScope();
    if (gpuValidationError) {
      this.fail(`Unexpected validation error occured: ${gpuValidationError.message}`);
    }
  }

  async expectValidationError(fn: Function): Promise<void> {
    this.device.pushErrorScope('validation');

    fn();

    // TODO: Remove queue submission when not needed anymore.
    this.queue.submit([]);

    const gpuValidationError = await this.device.popErrorScope();
    if (!gpuValidationError) {
      this.fail('Validation error was expected.');
    }
  }
}
