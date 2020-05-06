import { TestFileLoader } from './loader.js';
import { ParamSpec } from './params_utils.js';
import { comparePaths, Ordering, compareParamsPaths } from './query/compare_paths.js';
import {
  TestQuery,
  TestQueryMultiCase,
  TestQueryMultiTest,
  TestQueryMultiGroup,
  TestQuerySingleCase,
} from './query/query.js';
import { kSmallSeparator, kBigSeparator } from './query/separators.js';
import { stringifyQuery } from './query/stringifyQuery.js';
import { RunCase } from './test_group.js';
import { assert } from './util/util.js';

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

  let foundCase = false;
  const [suiteSubtree, suitePath] = makeTreeForSuite(suite);
  for (const entry of specs) {
    const groupOrdering = comparePaths(entry.path, query.group);
    if (groupOrdering === Ordering.Unordered) {
      // Group path is not matched by this filter.
      continue;
    }

    if ('readme' in entry) {
      // Entry is a readme that is an ancestor or descendant of the query.
      const [readmeSubtree] = subtreeForGroupPath(suitePath, suiteSubtree, entry.path);
      readmeSubtree.description = entry.readme.trim();
      continue;
    }
    // Entry is a spec file.

    // No spec file's group path should be a superset of the query's group path.
    assert(groupOrdering !== Ordering.Superset, 'Query does not match any tests');

    const [groupSubtree, groupPath] = subtreeForGroupPath(suitePath, suiteSubtree, entry.path);
    const spec = await loader.importSpecFile(query.suite, entry.path);

    for (const t of spec.g.iterate()) {
      const testOrdering = 'test' in query ? comparePaths(t.id.test, query.test) : Ordering.Subset;
      if (testOrdering === Ordering.Unordered || testOrdering === Ordering.Superset) {
        // Test path is not matched by this filter.
        continue;
      }

      // Subtree for test path
      const [testSubtree, testPath] = subtreeForTestPath(groupPath, groupSubtree, t);

      const caseOrdering =
        'params' in query ? compareParamsPaths(t.id.params, query.params) : Ordering.Subset;
      if (caseOrdering === Ordering.Unordered || caseOrdering === Ordering.Superset) {
        // Case is not matched by this filter.
        continue;
      }

      // Subtree for case
      subtreeForCase(testPath, testSubtree, t);
      foundCase = true;
    }
  }
  assert(foundCase, 'Query does not match any cases');
  return new FilterResultTree(suiteSubtree);
}

function makeTreeForSuite(suite: string): [FilterResultSubtree, TestQueryMultiGroup] {
  const tree: FilterResultSubtree = {
    query: { suite, group: [], endsWithWildcard: true },
    children: new Map(),
  };
  return [tree, { suite, group: [], endsWithWildcard: true }];
}

function subtreeForGroupPath(
  query: TestQueryMultiGroup,
  tree: FilterResultSubtree,
  group: string[]
): [FilterResultSubtree, TestQueryMultiTest] {
  const subquery = { ...query, group: [] as string[] };
  for (const part of pathPartsWithSeparators(group)) {
    subquery.group.push(part);
    tree = getOrInsertSubtree(tree, subquery);
  }
  return [tree, { ...subquery, test: [] }];
}

function subtreeForTestPath(
  query: TestQueryMultiTest,
  tree: FilterResultSubtree,
  t: RunCase
): [FilterResultSubtree, TestQueryMultiCase] {
  const subquery = { ...query, test: [] as string[] };
  for (const part of pathPartsWithSeparators(t.id.test)) {
    subquery.test.push(part);
    tree = getOrInsertSubtree(tree, subquery);
  }
  return [tree, { ...subquery, params: {} }];
}

function subtreeForCase(
  query: TestQueryMultiCase,
  tree: FilterResultSubtree,
  t: RunCase
): [FilterResultSubtree, TestQuerySingleCase] {
  const subquery = { ...query, params: {} as ParamSpec };
  for (const [k, v] of Object.entries(t.id.params)) {
    subquery.params[k] = v;
    tree = getOrInsertSubtree(tree, subquery);
  }
  return [tree, { ...subquery, endsWithWildcard: false }];
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
