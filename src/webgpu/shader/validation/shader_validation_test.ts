import { keysOf } from '../../../common/util/data_tables.js';
import { ErrorWithExtra } from '../../../common/util/util.js';
import { AllFeaturesMaxLimitsGPUTest, UniqueFeaturesOrLimitsGPUTest } from '../../gpu_test.js';

/**
 * Base fixture for WGSL shader validation tests.
 */
export class ShaderValidationTest extends AllFeaturesMaxLimitsGPUTest {
  /**
   * Add a test expectation for whether a createShaderModule call succeeds or not.
   *
   * @example
   * ```ts
   * t.expectCompileResult(true, `wgsl code`); // Expect success
   * t.expectCompileResult(false, `wgsl code`); // Expect validation error with any error string
   * ```
   */
  expectCompileResult(expectedResult: boolean, code: string) {
    let shaderModule: GPUShaderModule;
    this.expectGPUError(
      'validation',
      () => {
        shaderModule = this.device.createShaderModule({ code });
      },
      expectedResult !== true
    );

    const error = new ErrorWithExtra('', () => ({ shaderModule }));
    this.eventualAsyncExpectation(async () => {
      const compilationInfo = await shaderModule!.getCompilationInfo();

      // MAINTENANCE_TODO: Pretty-print error messages with source context.
      const messagesLog =
        compilationInfo.messages
          .map(m => `${m.lineNum}:${m.linePos}: ${m.type}: ${m.message}`)
          .join('\n') +
        '\n\n---- shader ----\n' +
        code;
      error.extra.compilationInfo = compilationInfo;

      if (compilationInfo.messages.some(m => m.type === 'error')) {
        if (expectedResult) {
          error.message = `Unexpected compilationInfo 'error' message.\n` + messagesLog;
          this.rec.validationFailed(error);
        } else {
          error.message = `Found expected compilationInfo 'error' message.\n` + messagesLog;
          this.rec.debug(error);
        }
      } else {
        if (!expectedResult) {
          error.message = `Missing expected compilationInfo 'error' message.\n` + messagesLog;
          this.rec.validationFailed(error);
        } else {
          error.message = `No compilationInfo 'error' messages, as expected.\n` + messagesLog;
          this.rec.debug(error);
        }
      }
    });
  }

  /**
   * Add a test expectation for whether a createShaderModule call issues a warning.
   *
   * @example
   * ```ts
   * t.expectCompileWarning(true, `wgsl code`); // Expect compile success and any warning message
   * t.expectCompileWarning(false, `wgsl code`); // Expect compile success and no warning messages
   * ```
   */
  expectCompileWarning(expectWarning: boolean, code: string) {
    let shaderModule: GPUShaderModule;
    this.expectGPUError(
      'validation',
      () => {
        shaderModule = this.device.createShaderModule({ code });
      },
      false
    );

    const error = new ErrorWithExtra('', () => ({ shaderModule }));
    this.eventualAsyncExpectation(async () => {
      const compilationInfo = await shaderModule!.getCompilationInfo();

      // MAINTENANCE_TODO: Pretty-print error messages with source context.
      const messagesLog = compilationInfo.messages
        .map(m => `${m.lineNum}:${m.linePos}: ${m.type}: ${m.message}`)
        .join('\n');
      error.extra.compilationInfo = compilationInfo;

      if (compilationInfo.messages.some(m => m.type === 'warning')) {
        if (expectWarning) {
          error.message = `No 'warning' message as expected.\n` + messagesLog;
          this.rec.debug(error);
        } else {
          error.message = `Missing expected compilationInfo 'warning' message.\n` + messagesLog;
          this.rec.validationFailed(error);
        }
      } else {
        if (expectWarning) {
          error.message = `Missing expected 'warning' message.\n` + messagesLog;
          this.rec.validationFailed(error);
        } else {
          error.message = `Found a 'warning' message as expected.\n` + messagesLog;
          this.rec.debug(error);
        }
      }
    });
  }

  /**
   * Add a test expectation for whether a createComputePipeline call succeeds or not.
   */
  expectPipelineResult(args: {
    // True if the pipeline should build without error
    expectedResult: boolean;
    // The WGSL shader code
    code: string;
    // Pipeline overridable constants
    constants?: Record<string, GPUPipelineConstantValue>;
    // List of additional module-scope variable the entrypoint needs to reference
    reference?: string[];
    // List of additional statements to insert in the entry point.
    statements?: string[];
  }) {
    const phonies: Array<string> = [];

    if (args.statements !== undefined) {
      phonies.push(...args.statements);
    }
    if (args.constants !== undefined) {
      phonies.push(...keysOf(args.constants).map(c => `_ = ${c};`));
    }
    if (args.reference !== undefined) {
      phonies.push(...args.reference.map(c => `_ = ${c};`));
    }

    const code =
      args.code +
      `
@compute @workgroup_size(1)
fn main() {
  ${phonies.join('\n')}
}`;

    let shaderModule: GPUShaderModule;
    this.expectGPUError(
      'validation',
      () => {
        shaderModule = this.device.createShaderModule({ code });
      },
      false
    );

    this.expectGPUError(
      'validation',
      () => {
        this.device.createComputePipeline({
          layout: 'auto',
          compute: { module: shaderModule!, entryPoint: 'main', constants: args.constants },
        });
      },
      !args.expectedResult
    );
  }

  /**
   * Wraps the code fragment into an entry point.
   *
   * @example
   * ```ts
   * t.wrapInEntryPoint(`var i = 0;`);
   * ```
   */
  wrapInEntryPoint(code: string, enabledExtensions: string[] = []) {
    const enableDirectives = enabledExtensions.map(x => `enable ${x};`).join('\n      ');

    return `
      ${enableDirectives}

      @compute @workgroup_size(1)
      fn main() {
        ${code}
      }`;
  }
}

// MAINTENANCE_TODO: Merge this with implementation above.
// NOTE: These things should probably not inherit. There is no relationship between
// these functions and a test. They could just as easily take a GPUTest as the first
// argument and then the all the problems associated with inheritance would disappear.
export class UniqueFeaturesAndLimitsShaderValidationTest extends UniqueFeaturesOrLimitsGPUTest {
  /**
   * Add a test expectation for whether a createShaderModule call succeeds or not.
   *
   * @example
   * ```ts
   * t.expectCompileResult(true, `wgsl code`); // Expect success
   * t.expectCompileResult(false, `wgsl code`); // Expect validation error with any error string
   * ```
   */
  expectCompileResult(expectedResult: boolean, code: string) {
    let shaderModule: GPUShaderModule;
    this.expectGPUError(
      'validation',
      () => {
        shaderModule = this.device.createShaderModule({ code });
      },
      expectedResult !== true
    );

    const error = new ErrorWithExtra('', () => ({ shaderModule }));
    this.eventualAsyncExpectation(async () => {
      const compilationInfo = await shaderModule!.getCompilationInfo();

      // MAINTENANCE_TODO: Pretty-print error messages with source context.
      const messagesLog =
        compilationInfo.messages
          .map(m => `${m.lineNum}:${m.linePos}: ${m.type}: ${m.message}`)
          .join('\n') +
        '\n\n---- shader ----\n' +
        code;
      error.extra.compilationInfo = compilationInfo;

      if (compilationInfo.messages.some(m => m.type === 'error')) {
        if (expectedResult) {
          error.message = `Unexpected compilationInfo 'error' message.\n` + messagesLog;
          this.rec.validationFailed(error);
        } else {
          error.message = `Found expected compilationInfo 'error' message.\n` + messagesLog;
          this.rec.debug(error);
        }
      } else {
        if (!expectedResult) {
          error.message = `Missing expected compilationInfo 'error' message.\n` + messagesLog;
          this.rec.validationFailed(error);
        } else {
          error.message = `No compilationInfo 'error' messages, as expected.\n` + messagesLog;
          this.rec.debug(error);
        }
      }
    });
  }

  /**
   * Add a test expectation for whether a createShaderModule call issues a warning.
   *
   * @example
   * ```ts
   * t.expectCompileWarning(true, `wgsl code`); // Expect compile success and any warning message
   * t.expectCompileWarning(false, `wgsl code`); // Expect compile success and no warning messages
   * ```
   */
  expectCompileWarning(expectWarning: boolean, code: string) {
    let shaderModule: GPUShaderModule;
    this.expectGPUError(
      'validation',
      () => {
        shaderModule = this.device.createShaderModule({ code });
      },
      false
    );

    const error = new ErrorWithExtra('', () => ({ shaderModule }));
    this.eventualAsyncExpectation(async () => {
      const compilationInfo = await shaderModule!.getCompilationInfo();

      // MAINTENANCE_TODO: Pretty-print error messages with source context.
      const messagesLog = compilationInfo.messages
        .map(m => `${m.lineNum}:${m.linePos}: ${m.type}: ${m.message}`)
        .join('\n');
      error.extra.compilationInfo = compilationInfo;

      if (compilationInfo.messages.some(m => m.type === 'warning')) {
        if (expectWarning) {
          error.message = `No 'warning' message as expected.\n` + messagesLog;
          this.rec.debug(error);
        } else {
          error.message = `Missing expected compilationInfo 'warning' message.\n` + messagesLog;
          this.rec.validationFailed(error);
        }
      } else {
        if (expectWarning) {
          error.message = `Missing expected 'warning' message.\n` + messagesLog;
          this.rec.validationFailed(error);
        } else {
          error.message = `Found a 'warning' message as expected.\n` + messagesLog;
          this.rec.debug(error);
        }
      }
    });
  }

  /**
   * Add a test expectation for whether a createComputePipeline call succeeds or not.
   */
  expectPipelineResult(args: {
    // True if the pipeline should build without error
    expectedResult: boolean;
    // The WGSL shader code
    code: string;
    // Pipeline overridable constants
    constants?: Record<string, GPUPipelineConstantValue>;
    // List of additional module-scope variable the entrypoint needs to reference
    reference?: string[];
    // List of additional statements to insert in the entry point.
    statements?: string[];
  }) {
    const phonies: Array<string> = [];

    if (args.statements !== undefined) {
      phonies.push(...args.statements);
    }
    if (args.constants !== undefined) {
      phonies.push(...keysOf(args.constants).map(c => `_ = ${c};`));
    }
    if (args.reference !== undefined) {
      phonies.push(...args.reference.map(c => `_ = ${c};`));
    }

    const code =
      args.code +
      `
@compute @workgroup_size(1)
fn main() {
  ${phonies.join('\n')}
}`;

    let shaderModule: GPUShaderModule;
    this.expectGPUError(
      'validation',
      () => {
        shaderModule = this.device.createShaderModule({ code });
      },
      false
    );

    this.expectGPUError(
      'validation',
      () => {
        this.device.createComputePipeline({
          layout: 'auto',
          compute: { module: shaderModule!, entryPoint: 'main', constants: args.constants },
        });
      },
      !args.expectedResult
    );
  }

  /**
   * Wraps the code fragment into an entry point.
   *
   * @example
   * ```ts
   * t.wrapInEntryPoint(`var i = 0;`);
   * ```
   */
  wrapInEntryPoint(code: string, enabledExtensions: string[] = []) {
    const enableDirectives = enabledExtensions.map(x => `enable ${x};`).join('\n      ');

    return `
      ${enableDirectives}

      @compute @workgroup_size(1)
      fn main() {
        ${code}
      }`;
  }
}
