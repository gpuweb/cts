import { ParamSpec } from '../params_utils.js';

interface TestPathBase {
  readonly suite: string;
  readonly group: readonly string[];
}

export interface TestPath extends TestPathBase {
  readonly test?: readonly string[];
  readonly params?: ParamSpec;
}

export interface TestQuerySingleCase extends TestPathBase {
  readonly test: readonly string[];
  readonly params: ParamSpec;
  readonly endsWithWildcard: false;
}

export interface TestQueryMultiCase extends TestPathBase {
  readonly test: readonly string[];
  readonly params: ParamSpec;
  readonly endsWithWildcard: true;
}

export interface TestQueryMultiTest extends TestPathBase {
  readonly test: readonly string[];
  readonly endsWithWildcard: true;
}

export interface TestQueryMultiGroup extends TestPathBase {
  readonly endsWithWildcard: true;
}

export type TestQuery =
  | TestQuerySingleCase
  | TestQueryMultiCase
  | TestQueryMultiTest
  | TestQueryMultiGroup;

// Applies to group parts, test parts, params keys.
export const validQueryPart = /^[a-zA-Z0-9_]+$/;
