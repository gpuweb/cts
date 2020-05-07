import { Fixture } from './fixture.js';
import { TestCaseID } from './id.js';
import { TestCaseRecorder } from './logging/test_case_recorder.js';
import { ParamSpec, ParamSpecIterable, extractPublicParams, paramsEquals } from './params_utils.js';
import { validQueryPart } from './query/query.js';
import { checkPublicParamType } from './url_query.js';
import { assert } from './util/util.js';

export type RunFn = (rec: TestCaseRecorder) => Promise<void>;

export interface RunCase {
  readonly id: TestCaseID;
  run: RunFn;
}

export interface RunCaseIterable {
  iterate(): Iterable<RunCase>;
}

type FixtureClass<F extends Fixture> = new (log: TestCaseRecorder, params: ParamSpec) => F;
type TestFn<F extends Fixture, P extends {}> = (t: F & { params: P }) => Promise<void> | void;

export class TestGroup<F extends Fixture> implements RunCaseIterable {
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
  test(...name: string[]): TestBuilderWithName<F, never> {
    // TODO: hard-apply these replacements to all tests
    name = name.map(n => n.replace(/ /g, '_'));

    for (const n of name) {
      assert(validQueryPart.test(n), `Invalid test name part ${n}; must match ${validQueryPart}`);
    }
    this.checkName(name.join(';'));

    const test = new TestBuilder<F, never>(name, this.fixture);
    this.tests.push(test);
    return test;
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
  private cases?: ParamSpecIterable = undefined;

  constructor(testPath: string[], fixture: FixtureClass<F>) {
    this.testPath = testPath;
    this.fixture = fixture;
  }

  fn(fn: TestFn<F, P>): void {
    this.testFn = fn;
  }

  params<NewP extends {}>(specs: Iterable<NewP>): TestBuilderWithParams<F, NewP> {
    assert(this.cases === undefined, 'test case is already parameterized');
    const cases = Array.from(specs);
    const seen: ParamSpec[] = [];
    // This is n^2.
    for (const spec of cases) {
      const publicParams = extractPublicParams(spec);

      // Check type of public params: can only be (currently):
      // number, string, boolean, undefined, number[]
      for (const v of Object.values(publicParams)) {
        checkPublicParamType(v);
      }

      assert(
        !seen.some(x => paramsEquals(x, publicParams)),
        'Duplicate test case params: ' + JSON.stringify(publicParams)
      );
      seen.push(publicParams);
    }
    this.cases = cases;

    return (this as unknown) as TestBuilderWithParams<F, NewP>;
  }

  *iterate(): IterableIterator<RunCase> {
    assert(this.testFn !== undefined, 'internal error');
    for (const params of this.cases || [{}]) {
      yield new RunCaseSpecific(this.testPath, params, this.fixture, this.testFn);
    }
  }
}

class RunCaseSpecific<F extends Fixture> implements RunCase {
  readonly id: TestCaseID;

  private readonly params: ParamSpec | null;
  private readonly fixture: FixtureClass<F>;
  private readonly fn: TestFn<F, never>;

  constructor(
    testPath: string[],
    params: ParamSpec,
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
