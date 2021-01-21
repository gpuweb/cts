import { GPUTest } from '../../gpu_test.js';

export class ShaderValidationTest extends GPUTest {
  /**
   * Add a test expectation for whether a createShaderModule call succeeds or not.
   *
   * @example
   * ```ts
   * t.expectCompileResult(true, `wgsl code`); // Expect success
   * t.expectCompileResult(false, `wgsl code`); // Expect validation error with any error string
   * t.expectCompileResult('v-0000', `wgsl code`); // Expect validation error containing 'v-0000'
   * ```
   */
  expectCompileResult(result: boolean | string, code: string) {
    // If no result is expected, we let the scope surrounding the test catch it.
    if (result !== true) {
      this.device.pushErrorScope('validation');
    }

    this.device.createShaderModule({ code });

    if (result !== true) {
      const promise = this.device.popErrorScope();

      this.eventualAsyncExpectation(async niceStack => {
        const gpuValidationError = await promise;
        if (!gpuValidationError) {
          niceStack.message = 'Compilation succeeded unexpectedly.';
          this.rec.validationFailed(niceStack);
        } else if (gpuValidationError instanceof GPUValidationError) {
          if (typeof result === 'string' && gpuValidationError.message.indexOf(result) === -1) {
            niceStack.message = `Compilation failed, but message missing expected substring «${result}» - ${gpuValidationError.message}`;
            this.rec.validationFailed(niceStack);
          } else {
            niceStack.message = `Compilation failed, as expected - ${gpuValidationError.message}`;
            this.rec.debug(niceStack);
          }
        }
      });
    }
  }
}
