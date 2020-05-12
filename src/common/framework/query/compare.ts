import { ParamSpec, ParamArgument, extractPublicParams } from '../params_utils.js';
import { assert } from '../util/util.js';

import { TestQuery } from './query.js';

export const enum Ordering {
  Unordered,
  Superset,
  Equal,
  Subset,
}

export const enum IsSubset {
  No = 0,
  YesEqual,
  YesStrict,
}

export function querySubsetOfQuery(sub: TestQuery, sup: TestQuery): IsSubset {
  switch (compareQueries(sub, sup)) {
    case Ordering.Unordered:
    case Ordering.Superset:
      return IsSubset.No;
    case Ordering.Equal:
      return IsSubset.YesEqual;
    case Ordering.Subset:
      return IsSubset.YesStrict;
  }
}

export function compareQueries(a: TestQuery, b: TestQuery): Ordering {
  if (a.suite !== b.suite) {
    return Ordering.Unordered;
  }

  const groupOrdering = cmpLevel(comparePaths(a.file, b.file), !('test' in a), !('test' in b));
  if (groupOrdering !== undefined) {
    return groupOrdering;
  }
  assert('test' in a && 'test' in b);

  const testOrdering = cmpLevel(comparePaths(a.test, b.test), !('params' in a), !('params' in b));
  if (testOrdering !== undefined) {
    return testOrdering;
  }
  assert('params' in a && 'params' in b);

  const paramsOrdering = cmpLevel(
    compareParamsPaths(a.params, b.params),
    a.endsWithWildcard,
    b.endsWithWildcard
  );
  if (paramsOrdering !== undefined) {
    return paramsOrdering;
  }
  return Ordering.Equal;
}

function cmpLevel(ordering: Ordering, aBig: boolean, bBig: boolean): Ordering | undefined {
  if (!aBig && !bBig) {
    return ordering === Ordering.Equal ? undefined : Ordering.Unordered;
  }
  switch (ordering) {
    case Ordering.Unordered:
      return Ordering.Unordered;
    case Ordering.Superset:
      return aBig || !bBig ? Ordering.Superset : Ordering.Unordered;
    case Ordering.Subset:
      return !aBig || bBig ? Ordering.Subset : Ordering.Unordered;
  }
  if (aBig && bBig) return Ordering.Equal;
  if (aBig) return Ordering.Superset;
  if (bBig) return Ordering.Subset;
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
    return Ordering.Superset;
  } else {
    return Ordering.Subset;
  }
}

// TODO: eventually, perhaps params should be grouped for hierarchy, like:
//   [{a: 1}, {b: 2, c: 3}, {d: 4}]
// Not sure if this will conflict badly with actual param generation.
// Alternatively, tree.ts could just detect when a param subtree has only one child.
function compareParamsPaths(p1: ParamSpec, p2: ParamSpec): Ordering {
  const a: Array<[string, ParamArgument]> = Object.entries(extractPublicParams(p1));
  const b: Array<[string, ParamArgument]> = Object.entries(extractPublicParams(p2));
  const shorter = Math.min(a.length, b.length);

  for (let i = 0; i < shorter; ++i) {
    const [ak, av] = a[i];
    const [bk, bv] = b[i];
    if (ak !== bk || av !== bv) {
      return Ordering.Unordered;
    }
  }
  if (a.length === b.length) {
    return Ordering.Equal;
  } else if (a.length < b.length) {
    return Ordering.Superset;
  } else {
    return Ordering.Subset;
  }
}
