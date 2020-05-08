import { SkipTestCase } from '../fixture.js';
import { now, assert } from '../util/util.js';

import { LogMessageWithStack } from './log_message.js';
import { LiveTestCaseResult, Status } from './result.js';

enum PassState {
  pass = 0,
  skip = 1,
  warn = 2,
  fail = 3,
}

export class TestCaseRecorder {
  private result: LiveTestCaseResult;
  private state = PassState.pass;
  private startTime = -1;
  private logs: LogMessageWithStack[] = [];
  private debugging = false;

  constructor(result: LiveTestCaseResult) {
    this.result = result;
  }

  start(debug: boolean): void {
    this.startTime = now();
    this.logs = [];
    this.state = PassState.pass;
    this.debugging = debug;
  }

  finish(): void {
    assert(this.startTime >= 0, 'finish() before start()');

    const endTime = now();
    // Round to next microsecond to avoid storing useless .xxxx00000000000002 in results.
    this.result.timems = Math.ceil((endTime - this.startTime) * 1000) / 1000;
    this.result.status = PassState[this.state] as Status;

    this.result.logs = this.logs;
    this.debugging = false;
  }

  debug(ex: Error): void {
    if (!this.debugging) {
      return;
    }
    this.logs.push(new LogMessageWithStack('DEBUG', ex, false));
  }

  warn(ex: Error): void {
    this.setState(PassState.warn);
    this.logs.push(new LogMessageWithStack('WARN', ex));
  }

  fail(ex: Error): void {
    this.setState(PassState.fail);
    this.logs.push(new LogMessageWithStack('FAIL', ex));
  }

  skipped(ex: SkipTestCase): void {
    this.setState(PassState.skip);
    this.logs.push(new LogMessageWithStack('SKIP', ex));
  }

  threw(ex: Error): void {
    if (ex instanceof SkipTestCase) {
      this.skipped(ex);
      return;
    }

    this.setState(PassState.fail);
    this.logs.push(new LogMessageWithStack('EXCEPTION', ex));
  }

  private setState(state: PassState): void {
    this.state = Math.max(this.state, state);
  }
}
