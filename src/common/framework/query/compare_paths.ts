import { ParamSpec, ParamArgument, extractPublicParams } from '../params_utils';

// TODO: Simplify if full ordering info isn't needed
export enum Ordering {
  Unordered,
  Superset,
  Equal,
  Subset,
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
export function compareParams(p1: ParamSpec, p2: ParamSpec): Ordering {
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
