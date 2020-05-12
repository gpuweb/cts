import { TestGroupID, TestCaseID } from '../id.js';

type TestPathBase = TestGroupID;

export type TestQueryMultiFile = TestPathBase;

export interface TestQueryMultiTest extends TestPathBase {
  readonly test: readonly string[];
}

export interface TestQueryMultiCase extends TestPathBase, TestCaseID {
  readonly endsWithWildcard: true;
}

export interface TestQuerySingleCase extends TestPathBase, TestCaseID {
  readonly endsWithWildcard: false;
}

// TODO?: Change TestQuery to classes, so toString and endsWithWildcard can be implicit.
// Also cloneQuery.
export type TestQuery =
  | TestQuerySingleCase
  | TestQueryMultiCase
  | TestQueryMultiTest
  | TestQueryMultiFile;
