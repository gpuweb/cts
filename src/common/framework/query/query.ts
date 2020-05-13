import { TestGroupID, TestCaseID } from '../id.js';
import { CaseParams, stringifyPublicParams } from '../params_utils.js';
import { assert } from '../util/util.js';

import { kBigSeparator, kPathSeparator, kWildcard, kParamSeparator } from './separators.js';

// XXX: method returning enum for level?

export class TestQueryMultiFile implements TestGroupID {
  readonly suite: string;
  readonly file: readonly string[];

  constructor(suite: string, file: readonly string[]) {
    this.suite = suite;
    this.file = [...file];
  }

  toString(): string {
    let s = this.suite;
    s += kBigSeparator + [...this.file, kWildcard].join(kPathSeparator);
    return s;
  }

  // Prevents object literals from coercing to these class types.
  protected readonly _: void;
}

export class TestQueryMultiTest extends TestQueryMultiFile {
  readonly test: readonly string[];

  constructor(suite: string, file: readonly string[], test: readonly string[]) {
    assert(file.length > 0, 'multi-test (or finer) query must have file-path');
    super(suite, file);
    this.test = [...test];
  }

  toString(): string {
    let s = this.suite;
    s += kBigSeparator + this.file.join(kPathSeparator);
    s += kBigSeparator + [...this.test, kWildcard].join(kPathSeparator);
    return s;
  }
}

export class TestQueryMultiCase extends TestQueryMultiTest implements TestCaseID {
  readonly params: CaseParams;

  constructor(suite: string, file: readonly string[], test: readonly string[], params: CaseParams) {
    assert(test.length > 0, 'multi-case (or finer) query must have test-path');
    super(suite, file, test);
    this.params = { ...params };
  }

  // maybe rename
  get endsWithWildcard(): boolean {
    return true;
  }

  toString(): string {
    const paramsParts = stringifyPublicParams(this.params);
    let s = this.suite;
    s += kBigSeparator + this.file.join(kPathSeparator);
    s += kBigSeparator + this.test.join(kPathSeparator);
    s += kBigSeparator + [...paramsParts, kWildcard].join(kParamSeparator);
    return s;
  }
}

export class TestQuerySingleCase extends TestQueryMultiCase {
  get endsWithWildcard(): boolean {
    return false;
  }

  toString(): string {
    const paramsParts = stringifyPublicParams(this.params);
    let s = this.suite;
    s += kBigSeparator + this.file.join(kPathSeparator);
    s += kBigSeparator + this.test.join(kPathSeparator);
    s += kBigSeparator + paramsParts.join(kParamSeparator);
    return s;
  }
}

// TODO?: Change TestQuery to classes, so toString and endsWithWildcard can be implicit.
// Also cloneQuery.
export type TestQuery =
  | TestQuerySingleCase
  | TestQueryMultiCase
  | TestQueryMultiTest
  | TestQueryMultiFile;
