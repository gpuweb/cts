import { CaseParams } from '../params_utils.js';
import { assert } from '../util/util.js';

import { encodeURLSelectively } from './encodeURLSelectively.js';
import { kBigSeparator, kPathSeparator, kWildcard, kParamSeparator } from './separators.js';
import { stringifyPublicParams } from './stringify_params.js';

export class TestQueryMultiFile {
  readonly suite: string;
  readonly file: readonly string[];

  constructor(suite: string, file: readonly string[]) {
    this.suite = suite;
    this.file = [...file];
  }

  toString(): string {
    return encodeURLSelectively(this.toStringHelper().join(kBigSeparator));
  }

  toHTML(): string {
    return this.toStringHelper().join(kBigSeparator + '<wbr>');
  }

  protected toStringHelper(): string[] {
    return [this.suite, [...this.file, kWildcard].join(kPathSeparator)];
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

  protected toStringHelper(): string[] {
    return [
      this.suite,
      this.file.join(kPathSeparator),
      [...this.test, kWildcard].join(kPathSeparator),
    ];
  }
}

export class TestQueryMultiCase extends TestQueryMultiTest {
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

  protected toStringHelper(): string[] {
    const paramsParts = stringifyPublicParams(this.params);
    return [
      this.suite,
      this.file.join(kPathSeparator),
      this.test.join(kPathSeparator),
      [...paramsParts, kWildcard].join(kParamSeparator),
    ];
  }
}

export class TestQuerySingleCase extends TestQueryMultiCase {
  get endsWithWildcard(): boolean {
    return false;
  }

  protected toStringHelper(): string[] {
    const paramsParts = stringifyPublicParams(this.params);
    return [
      this.suite,
      this.file.join(kPathSeparator),
      this.test.join(kPathSeparator),
      paramsParts.join(kParamSeparator),
    ];
  }
}

// TODO?: Change TestQuery to classes, so toString and endsWithWildcard can be implicit.
// Also cloneQuery.
export type TestQuery =
  | TestQuerySingleCase
  | TestQueryMultiCase
  | TestQueryMultiTest
  | TestQueryMultiFile;
