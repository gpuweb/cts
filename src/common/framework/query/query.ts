import { CaseParams } from '../params_utils.js';
import { assert } from '../util/util.js';

import { encodeURIComponentSelectively } from './encode_selectively.js';
import { kBigSeparator, kPathSeparator, kWildcard, kParamSeparator } from './separators.js';
import { stringifyPublicParams } from './stringify_params.js';

export type TestQuery =
  | TestQuerySingleCase
  | TestQueryMultiCase
  | TestQueryMultiTest
  | TestQueryMultiFile;

export class TestQueryMultiFile {
  readonly isMultiFile: boolean = true;
  readonly suite: string;
  readonly filePathParts: readonly string[];

  constructor(suite: string, file: readonly string[]) {
    this.suite = suite;
    this.filePathParts = [...file];
  }

  toString(): string {
    return encodeURIComponentSelectively(this.toStringHelper().join(kBigSeparator));
  }

  toHTML(): string {
    return this.toStringHelper().join(kBigSeparator + '<wbr>');
  }

  protected toStringHelper(): string[] {
    return [this.suite, [...this.filePathParts, kWildcard].join(kPathSeparator)];
  }
}

export class TestQueryMultiTest extends TestQueryMultiFile {
  readonly isMultiFile: false = false;
  readonly isMultiTest: boolean = true;
  readonly testPathParts: readonly string[];

  constructor(suite: string, file: readonly string[], test: readonly string[]) {
    super(suite, file);
    assert(file.length > 0, 'multi-test (or finer) query must have file-path');
    this.testPathParts = [...test];
  }

  protected toStringHelper(): string[] {
    return [
      this.suite,
      this.filePathParts.join(kPathSeparator),
      [...this.testPathParts, kWildcard].join(kPathSeparator),
    ];
  }
}

export class TestQueryMultiCase extends TestQueryMultiTest {
  readonly isMultiTest: false = false;
  readonly isMultiCase: boolean = true;
  readonly params: CaseParams;

  constructor(suite: string, file: readonly string[], test: readonly string[], params: CaseParams) {
    super(suite, file, test);
    assert(test.length > 0, 'multi-case (or finer) query must have test-path');
    this.params = { ...params };
  }

  protected toStringHelper(): string[] {
    const paramsParts = stringifyPublicParams(this.params);
    return [
      this.suite,
      this.filePathParts.join(kPathSeparator),
      this.testPathParts.join(kPathSeparator),
      [...paramsParts, kWildcard].join(kParamSeparator),
    ];
  }
}

export class TestQuerySingleCase extends TestQueryMultiCase {
  readonly isMultiCase: false = false;

  protected toStringHelper(): string[] {
    const paramsParts = stringifyPublicParams(this.params);
    return [
      this.suite,
      this.filePathParts.join(kPathSeparator),
      this.testPathParts.join(kPathSeparator),
      paramsParts.join(kParamSeparator),
    ];
  }
}
