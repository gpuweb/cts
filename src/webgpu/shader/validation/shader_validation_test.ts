import { GPUTest } from '../../gpu_test.js';

/**
 * Base fixture for WGSL shader validation tests.
 */
export class ShaderValidationTest extends GPUTest {
  /**
   * Add a test expectation for whether a createShaderModule call succeeds or not.
   *
   * @example
   * ```ts
   * t.expectCompileResult(true, `wgsl code`); // Expect success
   * t.expectCompileResult(false, `wgsl code`); // Expect validation error with any error string
   * ```
   */
  expectCompileResult(result: boolean, code: string) {
    // If an error is expected, push an error scope to catch it.
    // Otherwise, the test harness will catch unexpected errors.
    if (result !== true) {
      this.device.pushErrorScope('validation');
    }

    const shaderModule = this.device.createShaderModule({ code });

    if (result !== true) {
      const promise = this.device.popErrorScope();

      this.eventualAsyncExpectation(async niceStack => {
        // TODO: This is a non-compliant fallback path for Chrome, which doesn't
        // implement .compilationInfo() yet. Remove it.
        if (!shaderModule.compilationInfo) {
          const gpuValidationError = await promise;
          if (!gpuValidationError) {
            niceStack.message = 'Compilation succeeded unexpectedly.';
            this.rec.validationFailed(niceStack);
          } else if (gpuValidationError instanceof GPUValidationError) {
            niceStack.message = `Compilation failed, as expected - ${gpuValidationError.message}`;
            this.rec.debug(niceStack);
          }
          return;
        }
      });
    }
  }
}
