import { SkipTestCase, UnexpectedPassError } from '../../framework/fixture.js';
import { now, assert } from '../../util/util.js';

import { LogMessageWithStack } from './log_message.js';
import { Expectation, LiveTestCaseResult } from './result.js';

enum LogSeverity {
  Pass = 0,
  Skip = 1,
  Warn = 2,
  ExpectFailed = 3,
  ValidationFailed = 4,
  ThrewException = 5,
}

const kMaxLogStacks = 2;
const kMinSeverityForStack = LogSeverity.Warn;

export class CaseRecorder {
  protected inSubCase: boolean = false;
  protected finalStatus = LogSeverity.Pass;
  protected hideStacksBelowSeverity = kMinSeverityForStack;
  protected logLinesAtCurrentSeverity = 0;
  protected debugging = false;
  protected logs: (LogMessageWithStack | LogMessageWithStack[])[];

  constructor(debugging: boolean, logs: LogMessageWithStack[]) {
    this.debugging = debugging;
    this.logs = logs;
  }

  debug(ex: Error): void {
    if (!this.debugging) return;
    this.logImpl(LogSeverity.Pass, 'DEBUG', ex);
  }

  info(ex: Error): void {
    this.logImpl(LogSeverity.Pass, 'INFO', ex);
  }

  skipped(ex: SkipTestCase): void {
    this.logImpl(LogSeverity.Skip, 'SKIP', ex);
  }

  warn(ex: Error): void {
    this.logImpl(LogSeverity.Warn, 'WARN', ex);
  }

  expectationFailed(ex: Error): void {
    this.logImpl(LogSeverity.ExpectFailed, 'EXPECTATION FAILED', ex);
  }

  validationFailed(ex: Error): void {
    this.logImpl(LogSeverity.ValidationFailed, 'VALIDATION FAILED', ex);
  }

  threw(ex: unknown): void {
    if (ex instanceof SkipTestCase) {
      this.skipped(ex);
      return;
    }
    this.logImpl(LogSeverity.ThrewException, 'EXCEPTION', ex);
  }

  /** @internal */
  updateStatus(level: LogSeverity) {
    // Final case status should be the "worst" of all log entries.
    if (level > this.finalStatus) this.finalStatus = level;
  }

  private logImpl(level: LogSeverity, name: string, baseException: unknown): void {
    assert(baseException instanceof Error, 'test threw a non-Error object');
    const logMessage = new LogMessageWithStack(name, baseException);

    this.updateStatus(level);

    // setFirstLineOnly for all logs except `kMaxLogStacks` stacks at the highest severity
    if (level > this.hideStacksBelowSeverity) {
      this.logLinesAtCurrentSeverity = 0;
      this.hideStacksBelowSeverity = level;

      // Go back and setFirstLineOnly for everything of a lower log level
      for (const log of this.logs) {
        if (!(log instanceof Array)) {
          log.setStackHidden('below max severity');
        }
      }
    }
    if (level === this.hideStacksBelowSeverity) {
      this.logLinesAtCurrentSeverity++;
    } else if (level < kMinSeverityForStack) {
      logMessage.setStackHidden('');
    } else if (level < this.hideStacksBelowSeverity) {
      logMessage.setStackHidden('below max severity');
    }
    if (this.logLinesAtCurrentSeverity > kMaxLogStacks) {
      logMessage.setStackHidden(`only ${kMaxLogStacks} shown`);
    }

    this.logs.push(logMessage);
  }
}

export class SubCaseRecorder extends CaseRecorder {
  private parent: CaseRecorder;

  constructor(parent: CaseRecorder, debugging: boolean, logs: LogMessageWithStack[] = []) {
    super(debugging, logs);
    this.parent = parent;
  }

  finishSubCase(expectedStatus: Expectation) {
    try {
      if (expectedStatus === 'fail') {
        if (this.finalStatus <= LogSeverity.Warn) {
          throw new UnexpectedPassError();
        } else {
          this.finalStatus = LogSeverity.Pass;
        }
      }
    } finally {
      this.parent.updateStatus(this.finalStatus);
    }
  }
}

/** Holds onto a LiveTestCaseResult owned by the Logger, and writes the results into it. */
export class TestCaseRecorder extends CaseRecorder {
  private result: LiveTestCaseResult;
  private startTime = -1;

  constructor(result: LiveTestCaseResult, debugging: boolean) {
    super(debugging, []);
    this.result = result;
  }

  start(): void {
    assert(this.startTime < 0, 'TestCaseRecorder cannot be reused');
    this.startTime = now();
  }

  finish(): void {
    assert(this.startTime >= 0, 'finish() before start()');

    const timeMilliseconds = now() - this.startTime;
    // Round to next microsecond to avoid storing useless .xxxx00000000000002 in results.
    this.result.timems = Math.ceil(timeMilliseconds * 1000) / 1000;

    // Convert numeric enum back to string (but expose 'exception' as 'fail')
    this.result.status =
      this.finalStatus === LogSeverity.Pass
        ? 'pass'
        : this.finalStatus === LogSeverity.Skip
        ? 'skip'
        : this.finalStatus === LogSeverity.Warn
        ? 'warn'
        : 'fail'; // Everything else is an error

    this.result.logs = this.logs.reduce((acc: LogMessageWithStack[], val) => acc.concat(val), []);
  }

  injectResult(injectedResult: LiveTestCaseResult): void {
    Object.assign(this.result, injectedResult);
  }

  recordSubCase(): SubCaseRecorder {
    const logs: LogMessageWithStack[] = [];
    this.logs.push(logs);
    return new SubCaseRecorder(this, this.debugging, logs);
  }
}
