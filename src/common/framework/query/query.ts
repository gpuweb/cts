import { ParamSpec } from '../params_utils.js';

interface TestPathBase {
  suite: string;
  group: string[];
}

export interface TestPath extends TestPathBase {
  test?: string[];
  params?: ParamSpec;
}

export interface TestQuerySingleCase extends TestPathBase {
  test: string[];
  params: ParamSpec;
  endsWithWildcard: false;
}

export interface TestQueryMultiCase extends TestPathBase {
  test: string[];
  params: ParamSpec;
  endsWithWildcard: true;
}

export interface TestQueryMultiTest extends TestPathBase {
  test: string[];
  endsWithWildcard: true;
}

export interface TestQueryMultiGroup extends TestPathBase {
  endsWithWildcard: true;
}

export type TestQuery =
  | TestQuerySingleCase
  | TestQueryMultiCase
  | TestQueryMultiTest
  | TestQueryMultiGroup;

// Applies to group parts, test parts, params keys.
export const validQueryPart = /^[a-zA-Z0-9_]+$/;
