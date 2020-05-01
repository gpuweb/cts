import { ParamSpec } from '../params_utils.js';

export interface TestPath {
  suite: string;
  group: string[];
  test?: string[];
  params?: ParamSpec;
}

export interface TestQuery extends TestPath {
  endsWithWildcard: boolean;
}

// Applies to group parts, test parts, params keys.
export const validQueryPart = /^[a-zA-Z0-9_]+$/;
