import { ParamSpec, ParamArgument, extractPublicParams } from '../params_utils.js';

import { TestQuery } from './query.js';

export enum Ordering {
  Unordered,
  Superset,
  Equal,
  Subset,
}

export enum IsSubset {
  No = 0,
  YesEqual,
  YesStrict,
}

export function querySubsetOfQuery(sub: TestQuery, sup: TestQuery): IsSubset {
  if (sub.suite !== sup.suite) {
    return IsSubset.No;
  }

  const groupOrdering = comparePaths(sub.group, sup.group);
  if (groupOrdering === Ordering.Unordered || groupOrdering === Ordering.Superset) {
    return IsSubset.No;
  }
  // sub.group <= sup.group
  if (!('test' in sup && 'test' in sub)) {
    if (!('test' in sub)) {
      if (!('test' in sup)) {
        return groupOrdering === Ordering.Equal ? IsSubset.YesEqual : IsSubset.YesStrict;
      } else {
        return IsSubset.No;
      }
    } else {
      return IsSubset.YesStrict;
    }
  }

  const testOrdering = comparePaths(sub.test, sup.test);
  if (testOrdering === Ordering.Unordered || testOrdering === Ordering.Superset) {
    return IsSubset.No;
  }
  // sub.test <= sup.test
  if (!('params' in sup && 'params' in sub)) {
    if (!('params' in sub)) {
      if (!('params' in sup)) {
        return testOrdering === Ordering.Equal ? IsSubset.YesEqual : IsSubset.YesStrict;
      } else {
        return IsSubset.No;
      }
    } else {
      return IsSubset.YesStrict;
    }
  }

  const paramsOrdering = compareParamsPaths(sub.params, sup.params);
  if (paramsOrdering === Ordering.Unordered || paramsOrdering === Ordering.Superset) {
    return IsSubset.No;
  } else if (paramsOrdering === Ordering.Equal) {
    return IsSubset.YesEqual;
  } else {
    return IsSubset.YesStrict;
  }
}

export function comparePaths(a: readonly string[], b: readonly string[]): Ordering {
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
export function compareParamsPaths(p1: ParamSpec, p2: ParamSpec): Ordering {
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
