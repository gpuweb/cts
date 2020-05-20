import { Fixture } from './fixture.js';
import { TestCaseRecorder } from './logging/test_case_recorder.js';
import {
  CaseParams,
  CaseParamsIterable,
  extractPublicParams,
  publicParamsEquals,
} from './params_utils.js';
import { kPathSeparator } from './query/separators.js';
import { stringifyPublicParams } from './query/stringify_params.js';
import { validQueryPart } from './query/validQueryPart.js';
import { assert } from './util/util.js';

export type RunFn = (rec: TestCaseRecorder) => Promise<void>;

export interface TestCaseID {
  readonly test: readonly string[];
  readonly params: CaseParams;
}

export interface RunCase {
  readonly id: TestCaseID;
  run: RunFn;
}

// Interface for defining tests
export interface TestGroupBuilder<F extends Fixture> {
  test(name: string): TestBuilderWithName<F, never>;
}
export function makeTestGroup<F extends Fixture>(fixture: FixtureClass<F>): TestGroupBuilder<F> {
  return new TestGroup(fixture);
}

// Interface for running tests
export interface RunCaseIterable {
  iterate(): Iterable<RunCase>;
  checkCaseNamesAndDuplicates(): void;
}
export function makeTestGroupForUnitTesting<F extends Fixture>(
  fixture: FixtureClass<F>
): TestGroup<F> {
  return new TestGroup(fixture);
}

type FixtureClass<F extends Fixture> = new (log: TestCaseRecorder, params: CaseParams) => F;
type TestFn<F extends Fixture, P extends {}> = (t: F & { params: P }) => Promise<void> | void;

class TestGroup<F extends Fixture> implements RunCaseIterable, TestGroupBuilder<F> {
  private fixture: FixtureClass<F>;
  private seen: Set<string> = new Set();
  private tests: Array<TestBuilder<F, never>> = [];

  constructor(fixture: FixtureClass<F>) {
    this.fixture = fixture;
  }

  *iterate(): Iterable<RunCase> {
    for (const test of this.tests) {
      yield* test.iterate();
    }
  }

  private checkName(name: string): void {
    assert(
      // Shouldn't happen due to the rule above. Just makes sure that treated
      // unencoded strings as encoded strings is OK.
      name === decodeURIComponent(name),
      `Not decodeURIComponent-idempotent: ${name} !== ${decodeURIComponent(name)}`
    );
    assert(!this.seen.has(name), `Duplicate test name: ${name}`);

    this.seen.add(name);
  }

  // TODO: This could take a fixture, too, to override the one for the group.
  test(name: string): TestBuilderWithName<F, never> {
    this.checkName(name);

    const parts = name.split(kPathSeparator);
    for (const p of parts) {
      assert(validQueryPart.test(p), `Invalid test name part ${p}; must match ${validQueryPart}`);
    }

    const test = new TestBuilder<F, never>(parts, this.fixture);
    this.tests.push(test);
    return test;
  }

  checkCaseNamesAndDuplicates(): void {
    for (const test of this.tests) {
      test.checkCaseNamesAndDuplicates();
    }
  }
}

interface TestBuilderWithName<F extends Fixture, P extends {}> extends TestBuilderWithParams<F, P> {
  params<NewP extends {}>(specs: Iterable<NewP>): TestBuilderWithParams<F, NewP>;
}

interface TestBuilderWithParams<F extends Fixture, P extends {}> {
  fn(fn: TestFn<F, P>): void;
}

class TestBuilder<F extends Fixture, P extends {}> {
  private readonly testPath: string[];
  private readonly fixture: FixtureClass<F>;
  private testFn: TestFn<F, P> | undefined;
  private cases?: CaseParamsIterable = undefined;

  constructor(testPath: string[], fixture: FixtureClass<F>) {
    this.testPath = testPath;
    this.fixture = fixture;
  }

  fn(fn: TestFn<F, P>): void {
    this.testFn = fn;
  }

  checkCaseNamesAndDuplicates(): void {
    if (this.cases === undefined) {
      return;
    }

    // This is n^2.
    const seen: CaseParams[] = [];
    for (const testcase of this.cases) {
      // stringifyPublicParams also checks for invalid params values
      const testcaseString = stringifyPublicParams(testcase);
      assert(
        !seen.some(x => publicParamsEquals(x, testcase)),
        `Duplicate public test case params: ${testcaseString}`
      );
      seen.push(testcase);
    }
  }

  params<NewP extends {}>(casesIterable: Iterable<NewP>): TestBuilderWithParams<F, NewP> {
    assert(this.cases === undefined, 'test case is already parameterized');
    this.cases = Array.from(casesIterable);

    return (this as unknown) as TestBuilderWithParams<F, NewP>;
  }

  *iterate(): IterableIterator<RunCase> {
    assert(this.testFn !== undefined, 'No test function (.fn()) for test');
    for (const params of this.cases || [{}]) {
      yield new RunCaseSpecific(this.testPath, params, this.fixture, this.testFn);
    }
  }
}

class RunCaseSpecific<F extends Fixture> implements RunCase {
  readonly id: TestCaseID;

  private readonly params: CaseParams | null;
  private readonly fixture: FixtureClass<F>;
  private readonly fn: TestFn<F, never>;

  constructor(
    testPath: string[],
    params: CaseParams,
    fixture: FixtureClass<F>,
    fn: TestFn<F, never>
  ) {
    this.id = { test: testPath, params: extractPublicParams(params) };
    this.params = params;
    this.fixture = fixture;
    this.fn = fn;
  }

  async run(rec: TestCaseRecorder): Promise<void> {
    rec.start();
    try {
      const inst = new this.fixture(rec, this.params || {});

      try {
        await inst.init();
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        await this.fn(inst as any);
      } finally {
        // Runs as long as constructor succeeded, even if initialization or the test failed.
        await inst.finalize();
      }
    } catch (ex) {
      // There was an exception from constructor, init, test, or finalize.
      // An error from init or test may have been a SkipTestCase.
      // An error from finalize may have been an eventualAsyncExpectation failure
      // or unexpected validation/OOM error from the GPUDevice.
      rec.threw(ex);
    }
    rec.finish();
  }
}
