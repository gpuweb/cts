import { TestFileLoader } from './loader.js';
import { stringifySingleParam } from './params_utils.js';
import { comparePaths, Ordering, compareParams } from './query/compare_paths.js';
import { TestQuery } from './query/query.js';
import { kSmallSeparator, kBigSeparator, kWildcard } from './query/separators.js';
import { RunCase } from './test_group.js';
import { stringifyQuery } from './query/stringifyQuery.js';

export interface FilterResultSubtree {
  readonly query: TestQuery;
  description?: string;
  readonly children: Map<string, FilterResultTreeNode>;
}

export interface FilterResultTreeLeaf {
  readonly query: TestQuery;
  readonly runCase: RunCase;
}

export interface FilterResult {
  readonly name: string;
  readonly runCase: RunCase;
}

export type FilterResultTreeNode = FilterResultSubtree | FilterResultTreeLeaf;

export class FilterResultTree {
  readonly root: FilterResultSubtree;

  constructor(root: FilterResultSubtree) {
    this.root = root;
  }

  iterate(): IterableIterator<FilterResult> {
    return iterateSubtree(this.root);
  }

  // For debugging
  print(tree: FilterResultTreeNode = this.root, indent: string = ''): void {
    if (!('children' in tree)) {
      return;
    }
    for (const [name, child] of tree.children) {
      // eslint-disable-next-line no-console
      console.log(indent + name);
      this.print(child, indent + ' ');
    }
  }
}

function* iterateSubtree(subtree: FilterResultSubtree): IterableIterator<FilterResult> {
  for (const [name, child] of subtree.children) {
    if ('children' in child) {
      yield* iterateSubtree(child);
    } else {
      yield { name, runCase: child.runCase };
    }
  }
}

export async function loadTreeForQuery(
  loader: TestFileLoader,
  query: TestQuery
): Promise<FilterResultTree> {
  const suite = query.suite;
  const specs = await loader.listing(suite);

  const [suiteSubtree, suitePath] = makeTreeForSuite(suite);
  for (const entry of specs) {
    const group = entry.path;

    const ordering1 = comparePaths(group, query.group);
    // TODO: skipping on Superset means that parent dirs don't get their description set to README
    if (ordering1 === Ordering.Unordered || ordering1 === Ordering.Superset) {
      // Group path is not matched by this filter.
      continue;
    }

    // Subtree for suite of this entry
    // Subtree for group path of this entry
    const [groupSubtree, groupPath] = subtreeForGroupPath(suitePath, suiteSubtree, group);

    if ('readme' in entry) {
      // Entry is a readme file.
      groupSubtree.description = entry.readme.trim();
      continue;
    }

    // Entry is a spec file.
    const spec = await loader.importSpecFile(query.suite, group);

    for (const t of spec.g.iterate()) {
      const ordering2 = 'test' in query ? comparePaths(t.id.test, query.test) : Ordering.Subset;
      if (ordering2 === Ordering.Unordered || ordering2 === Ordering.Superset) {
        // Test path is not matched by this filter.
        continue;
      }

      // Subtree for test path
      const [testSubtree, testPath] = subtreeForTestPath(groupPath, groupSubtree, t);

      const ordering3 =
        'params' in query ? compareParams(t.id.params, query.params) : Ordering.Subset;
      if (ordering3 === Ordering.Unordered || ordering3 === Ordering.Superset) {
        // Case is not matched by this filter.
        continue;
      }

      // Subtree for case
      subtreeForCase(testPath, testSubtree, t);
    }
  }
  return new FilterResultTree(suiteSubtree);
}

function makeTreeForSuite(suite: string): [FilterResultSubtree, string] {
  const path = suite + kBigSeparator;
  const tree: FilterResultSubtree = {
    query: { suite, group: [], endsWithWildcard: true },
    children: new Map(),
  };
  return [tree, path];
}

function subtreeForGroupPath(
  path: string,
  tree: FilterResultSubtree,
  group: string[]
): [FilterResultSubtree, string] {
  for (const part of pathPartsWithSeparators(group)) {
    path += part;
    tree = getOrInsertSubtree(tree, path + kWildcard);
  }
  return [tree, path];
}

function subtreeForTestPath(
  path: string,
  tree: FilterResultSubtree,
  t: RunCase
): [FilterResultSubtree, string] {
  for (const part of pathPartsWithSeparators(t.id.test)) {
    path += part;
    tree = getOrInsertSubtree(tree, path + kWildcard);
  }
  return [tree, path];
}

function subtreeForCaseExceptLeaf(
  path: string,
  tree: FilterResultSubtree,
  paramsParts: string[]
): [FilterResultSubtree, string] {
  for (const part of nonLastPathPartsWithSeparators(paramsParts)) {
    path += part;
    tree = getOrInsertSubtree(tree, path + kWildcard);
  }
  return [tree, path];
}

function subtreeForCase(path: string, tree: FilterResultSubtree, t: RunCase): void {
  const paramsParts = Object.entries(t.id.params).map(([k, v]) => stringifySingleParam(k, v));
  const [caseBranch, caseBranchPath] = subtreeForCaseExceptLeaf(path, tree, paramsParts);

  // Single case
  const lastPart = paramsParts[paramsParts.length - 1];
  caseBranch.children.set(caseBranchPath + lastPart, { runCase: t });
}

function getOrInsertSubtree(n: FilterResultSubtree, query: TestQuery): FilterResultSubtree {
  const k = stringifyQuery(query);

  const children = n.children;
  const child = children.get(k);
  if (child !== undefined) {
    return child as FilterResultSubtree;
  }

  const v = { query, children: new Map() };
  children.set(k, v);
  return v;
}

function* nonLastPathPartsWithSeparators(path: string[]): IterableIterator<string> {
  for (let i = 0; i < path.length - 1; ++i) {
    yield path[i] + kSmallSeparator;
  }
}

function* pathPartsWithSeparators(path: string[]): IterableIterator<string> {
  yield* nonLastPathPartsWithSeparators(path);
  yield path[path.length - 1] + kBigSeparator;
}
