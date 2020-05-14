import { CaseParams, ParamArgument, extractPublicParams } from '../params_utils.js';
import { assert, objectEquals } from '../util/util.js';

import { TestQuery } from './query.js';

export const enum Ordering {
  Unordered,
  StrictSuperset,
  Equal,
  StrictSubset,
}

// Compares two queries for their ordering (which is used to build the tree).
// See src/unittests/query_compare.spec.ts for examples.
export function compareQueries(a: TestQuery, b: TestQuery): Ordering {
  if (a.suite !== b.suite) {
    return Ordering.Unordered;
  }

  const fileOrdering = compareOneLevel(comparePaths(a.file, b.file), a.isMultiFile, b.isMultiFile);
  if (fileOrdering !== undefined) {
    return fileOrdering;
  }
  assert('test' in a && 'test' in b);

  const testOrdering = compareOneLevel(comparePaths(a.test, b.test), a.isMultiTest, b.isMultiTest);
  if (testOrdering !== undefined) {
    return testOrdering;
  }
  assert('params' in a && 'params' in b);

  const paramsOrdering = compareOneLevel(
    comparePublicParamsPaths(a.params, b.params),
    a.isMultiCase,
    b.isMultiCase
  );
  if (paramsOrdering !== undefined) {
    return paramsOrdering;
  }
  return Ordering.Equal;
}

// Compares a single level of a query.
// "IsBig" means the query is big relative to the level, e.g. for test-level:
//   anything >= suite:a,* is big
//   anything <= suite:a:* is small
function compareOneLevel(
  ordering: Ordering,
  aIsBig: boolean,
  bIsBig: boolean
): Ordering | undefined {
  if (!aIsBig && !bIsBig) {
    return ordering === Ordering.Equal ? undefined : Ordering.Unordered;
  }
  switch (ordering) {
    case Ordering.Unordered:
      return Ordering.Unordered;
    case Ordering.StrictSuperset:
      return aIsBig || !bIsBig ? Ordering.StrictSuperset : Ordering.Unordered;
    case Ordering.StrictSubset:
      return !aIsBig || bIsBig ? Ordering.StrictSubset : Ordering.Unordered;
  }
  if (aIsBig && bIsBig) return Ordering.Equal;
  if (aIsBig) return Ordering.StrictSuperset;
  if (bIsBig) return Ordering.StrictSubset;
  return undefined;
}

function comparePaths(a: readonly string[], b: readonly string[]): Ordering {
  const shorter = Math.min(a.length, b.length);

  for (let i = 0; i < shorter; ++i) {
    if (a[i] !== b[i]) {
      return Ordering.Unordered;
    }
  }
  if (a.length === b.length) {
    return Ordering.Equal;
  } else if (a.length < b.length) {
    return Ordering.StrictSuperset;
  } else {
    return Ordering.StrictSubset;
  }
}

export function comparePublicParamsPaths(p1: CaseParams, p2: CaseParams): Ordering {
  const a: Array<[string, ParamArgument]> = Object.entries(extractPublicParams(p1));
  const b: Array<[string, ParamArgument]> = Object.entries(extractPublicParams(p2));
  const shorter = Math.min(a.length, b.length);

  for (let i = 0; i < shorter; ++i) {
    const [ak, av] = a[i];
    const [bk, bv] = b[i];
    if (ak !== bk || !objectEquals(av, bv)) {
      return Ordering.Unordered;
    }
  }
  if (a.length === b.length) {
    return Ordering.Equal;
  } else if (a.length < b.length) {
    return Ordering.StrictSuperset;
  } else {
    return Ordering.StrictSubset;
  }
}
