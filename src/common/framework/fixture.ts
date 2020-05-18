import { TestCaseRecorder } from './logging/test_case_recorder.js';
import { CaseParams } from './params_utils.js';
import { assert } from './util/util.js';

export class SkipTestCase extends Error {}

// A Fixture is a class used to instantiate each test case at run time.
// A new instance of the Fixture is created for every single test case
// (i.e. every time the test function is run).
export class Fixture {
  params: unknown;
  protected rec: TestCaseRecorder;
  private eventualExpectations: Array<Promise<unknown>> = [];
  private numOutstandingAsyncExpectations = 0;

  constructor(rec: TestCaseRecorder, params: CaseParams) {
    this.rec = rec;
    this.params = params;
  }

  // This has to be a member function instead of an async `createFixture` function, because
  // we need to be able to ergonomically override it in subclasses.
  async init(): Promise<void> {}

  debug(msg: string): void {
    this.rec.debug(new Error(msg));
  }

  skip(msg: string): never {
    throw new SkipTestCase(msg);
  }

  async finalize(): Promise<void> {
    assert(
      this.numOutstandingAsyncExpectations === 0,
      'there were outstanding asynchronous expectations (e.g. shouldReject) at the end of the test'
    );
    await Promise.all(this.eventualExpectations);
  }

  warn(msg?: string): void {
    this.rec.warn(new Error(msg));
  }

  fail(msg?: string): void {
    this.rec.expectationFailed(new Error(msg));
  }

  protected async immediateAsyncExpectation<T>(fn: () => Promise<T>): Promise<T> {
    this.numOutstandingAsyncExpectations++;
    const ret = await fn();
    this.numOutstandingAsyncExpectations--;
    return ret;
  }

  protected eventualAsyncExpectation<T>(fn: (niceStack: Error) => Promise<T>): Promise<T> {
    const promise = fn(new Error());
    this.eventualExpectations.push(promise);
    return promise;
  }

  private expectErrorValue(expectedName: string, ex: unknown, niceStack: Error): void {
    if (!(ex instanceof Error)) {
      niceStack.message = `THREW non-error value, of type ${typeof ex}: ${ex}`;
      this.rec.expectationFailed(niceStack);
      return;
    }
    const actualName = ex.name;
    if (actualName !== expectedName) {
      niceStack.message = `THREW ${actualName}, instead of ${expectedName}: ${ex}`;
      this.rec.expectationFailed(niceStack);
    } else {
      niceStack.message = `OK: threw ${actualName}${ex.message}`;
      this.rec.debug(niceStack);
    }
  }

  shouldReject(expectedName: string, p: Promise<unknown>, msg?: string): void {
    this.eventualAsyncExpectation(async niceStack => {
      const m = msg ? ': ' + msg : '';
      try {
        await p;
        niceStack.message = 'DID NOT REJECT' + m;
        this.rec.expectationFailed(niceStack);
      } catch (ex) {
        niceStack.message = m;
        this.expectErrorValue(expectedName, ex, niceStack);
      }
    });
  }

  shouldThrow(expectedName: string, fn: () => void, msg?: string): void {
    const m = msg ? ': ' + msg : '';
    try {
      fn();
      this.rec.expectationFailed(new Error('DID NOT THROW' + m));
    } catch (ex) {
      this.expectErrorValue(expectedName, ex, new Error(m));
    }
  }

  expect(cond: boolean, msg?: string): boolean {
    if (cond) {
      const m = msg ? ': ' + msg : '';
      this.rec.debug(new Error('expect OK' + m));
    } else {
      this.rec.expectationFailed(new Error(msg));
    }
    return cond;
  }
}
