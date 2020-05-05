import { allowedTestNameCharacters } from './allowed_characters.js';
import { Fixture } from './fixture.js';
import { TestCaseID } from './id.js';
import { LiveTestCaseResult, TestCaseRecorder, TestSpecRecorder } from './logger.js';
import { ParamSpec, ParamSpecIterable, extractPublicParams, paramsEquals } from './params_utils.js';
import { checkPublicParamType } from './url_query.js';
import { assert } from './util/util.js';

export interface RunCase {
  readonly id: TestCaseID;
  run(debug?: boolean): Promise<LiveTestCaseResult>;
  injectResult(result: LiveTestCaseResult): void;
}

export interface RunCaseIterable {
  iterate(rec: TestSpecRecorder): Iterable<RunCase>;
}

type FixtureClass<F extends Fixture> = new (log: TestCaseRecorder, params: ParamSpec) => F;
type TestFn<F extends Fixture, P extends {}> = (t: F & { params: P }) => Promise<void> | void;

const validNames = new RegExp('^[' + allowedTestNameCharacters + ']+$');

export class TestGroup<F extends Fixture> implements RunCaseIterable {
  private fixture: FixtureClass<F>;
  private seen: Set<string> = new Set();
  private tests: Array<TestBuilder<F, never>> = [];

  constructor(fixture: FixtureClass<F>) {
    this.fixture = fixture;
  }

  *iterate(log: TestSpecRecorder): Iterable<RunCase> {
    for (const test of this.tests) {
      yield* test.iterate(log);
    }
  }

  private checkName(name: string): void {
    assert(validNames.test(name), `Invalid test name ${name}; must match [${validNames}]+`);
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
    // Replace spaces with underscores for readability.
    assert(name.indexOf('_') === -1, 'Invalid test name ${name}: contains underscore (use space)');
    name = name.replace(/ /g, '_');

    this.checkName(name);

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
  private readonly name: string;
  private readonly fixture: FixtureClass<F>;
  private testFn: TestFn<F, P> | undefined;
  private cases: ParamSpecIterable | null = null;

  constructor(name: string, fixture: FixtureClass<F>) {
    this.name = name;
    this.fixture = fixture;
  }

  fn(fn: TestFn<F, P>): void {
    this.testFn = fn;
  }

  params<NewP extends {}>(specs: Iterable<NewP>): TestBuilderWithParams<F, NewP> {
    assert(this.cases === null, 'test case is already parameterized');
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

  *iterate(rec: TestSpecRecorder): IterableIterator<RunCase> {
    assert(this.testFn !== undefined, 'internal error');
    for (const params of this.cases || [null]) {
      yield new RunCaseSpecific(rec, this.name, params, this.fixture, this.testFn);
    }
  }
}

class RunCaseSpecific<F extends Fixture> implements RunCase {
  readonly id: TestCaseID;
  private readonly params: ParamSpec | null;
  private readonly recorder: TestSpecRecorder;
  private readonly fixture: FixtureClass<F>;
  private readonly fn: TestFn<F, never>;

  constructor(
    recorder: TestSpecRecorder,
    test: string,
    params: ParamSpec | null,
    fixture: FixtureClass<F>,
    fn: TestFn<F, never>
  ) {
    this.id = { test, params: params ? extractPublicParams(params) : null };
    this.params = params;
    this.recorder = recorder;
    this.fixture = fixture;
    this.fn = fn;
  }

  async run(debug: boolean): Promise<LiveTestCaseResult> {
    const [rec, res] = this.recorder.record(this.id.test, this.id.params);
    rec.start(debug);

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
    return res;
  }

  injectResult(result: LiveTestCaseResult): void {
    const [, res] = this.recorder.record(this.id.test, this.id.params);
    Object.assign(res, result);
  }
}
