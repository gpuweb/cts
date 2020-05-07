import { TestFileLoader } from './loader.js';
import { ParamSpec, stringifySingleParam } from './params_utils.js';
import {
  comparePaths,
  Ordering,
  compareParamsPaths,
  querySubsetOfQuery,
  IsSubset,
} from './query/compare.js';
import { TestQuery } from './query/query.js';
import { stringifyQuery } from './query/stringifyQuery.js';
import { RunCase } from './test_group.js';
import { assert } from './util/util.js';

export interface FilterResultSubtree {
  query: TestQuery;
  description?: string;
  readonly children: Map<string, FilterResultTreeNode>;
  readonly collapsible: boolean;
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

  iterateCollapsed(): IterableIterator<TestQuery> {
    return iterateCollapsedSubtree(this.root);
  }

  iterate(): IterableIterator<FilterResult> {
    return iterateSubtree(this.root);
  }

  // For debugging
  print(): void {
    this.printHelper('(root)', this.root);
  }

  printHelper(name: string, tree: FilterResultTreeNode, indent: string = ''): void {
    // eslint-disable-next-line no-console
    console.log(
      indent + `${name} => ${stringifyQuery(tree.query)} (${JSON.stringify(tree.query)})`
    );
    if ('description' in tree) {
      // eslint-disable-next-line no-console
      console.log(indent + '  | ' + JSON.stringify(tree.description));
    }

    if (!('children' in tree)) {
      return;
    }
    for (const [name, child] of tree.children) {
      this.printHelper(name, child, indent + '  ');
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

function* iterateCollapsedSubtree(subtree: FilterResultSubtree): IterableIterator<TestQuery> {
  for (const [, child] of subtree.children) {
    if ('children' in child && !child.collapsible) {
      yield* iterateCollapsedSubtree(child);
    } else {
      yield child.query;
    }
  }
}

export async function loadTreeForQuery(
  loader: TestFileLoader,
  query: TestQuery,
  subqueriesToExpand: TestQuery[]
): Promise<FilterResultTree> {
  const suite = query.suite;
  const specs = await loader.listing(suite);

  let foundCase = false;
  // L0 = suite, L1 = group, L2 = test, L3 = case
  const subtreeL0 = makeTreeForSuite(suite);
  for (const entry of specs) {
    const orderingL1 = comparePaths(entry.path, query.group);
    if (orderingL1 === Ordering.Unordered) {
      // Group path is not matched by this filter.
      continue;
    }

    if ('readme' in entry) {
      // Entry is a readme that is an ancestor or descendant of the query.
      const readmeSubtree = subtreeForGroupPath(subtreeL0, entry.path);
      readmeSubtree.description = entry.readme.trim();
      continue;
    }
    // Entry is a spec file.

    // No spec file's group path should be a superset of the query's group path.
    assert(orderingL1 !== Ordering.Superset, 'Query does not match any tests');

    const subtreeL1 = subtreeForGroupPath(subtreeL0, entry.path);
    const spec = await loader.importSpecFile(query.suite, entry.path);
    subtreeL1.description = spec.description.trim();

    // TODO: this is taking a tree, flattening it, and then unflattening it. Possibly redundant.
    for (const t of spec.g.iterate()) {
      if ('test' in query) {
        const orderingL2 = comparePaths(t.id.test, query.test);
        if (orderingL2 === Ordering.Unordered || orderingL2 === Ordering.Superset) {
          // Test path is not matched by this filter.
          continue;
        }
      }

      const subtreeL2 = subtreeForTestPath(subtreeL1, t, subqueriesToExpand);

      if ('params' in query) {
        const orderingL3 = compareParamsPaths(t.id.params, query.params);
        if (orderingL3 === Ordering.Unordered || orderingL3 === Ordering.Superset) {
          // Case is not matched by this filter.
          continue;
        }
      }

      // Subtree for case
      subtreeForCase(subtreeL2, t, subqueriesToExpand);
      foundCase = true;
    }
  }
  const tree = new FilterResultTree(subtreeL0);
  tree.print(); // XXX

  assert(foundCase, 'Query does not match any cases');
  return tree;
}

function makeTreeForSuite(suite: string): FilterResultSubtree {
  const tree: FilterResultSubtree = {
    query: { suite, group: [], endsWithWildcard: true },
    children: new Map(),
    collapsible: false,
  };
  return tree;
}

function subtreeForGroupPath(tree: FilterResultSubtree, group: string[]): FilterResultSubtree {
  const subquery = { ...tree.query, group: [] as string[] };
  for (const part of group) {
    subquery.group.push(part);
    tree = getOrInsertSubtree(part, tree, subquery, false);
  }
  if (group.length > 0) {
    tree.query = { ...subquery, test: [] };
  }
  return tree;
}

function subtreeForTestPath(
  tree: FilterResultSubtree,
  t: RunCase,
  subqueriesToExpand: TestQuery[]
): FilterResultSubtree {
  const subquery = { ...tree.query, test: [] as string[] };
  for (const part of t.id.test) {
    subquery.test.push(part);
    const collapsible = subqueriesToExpand.every(
      s => querySubsetOfQuery(s, subquery) !== IsSubset.YesStrict
    );
    tree = getOrInsertSubtree(part, tree, subquery, collapsible);
  }
  if (t.id.test.length > 0) {
    tree.query = { ...subquery, params: {} };
  }
  return tree;
}

function subtreeForCase(
  tree: FilterResultSubtree,
  t: RunCase,
  subqueriesToExpand: TestQuery[]
): FilterResultSubtree {
  assert('test' in tree.query);
  const subquery = { ...tree.query, params: {} as ParamSpec };
  for (const [k, v] of Object.entries(t.id.params)) {
    subquery.params[k] = v;
    const collapsible = subqueriesToExpand.every(
      s => querySubsetOfQuery(s, subquery) !== IsSubset.YesStrict
    );
    const subqueryCopy = { ...subquery, params: { ...subquery.params } };
    tree = getOrInsertSubtree(stringifySingleParam(k, v), tree, subqueryCopy, collapsible);
  }
  tree.query = { ...subquery, endsWithWildcard: false };
  return tree;
}

function getOrInsertSubtree(
  k: string,
  n: FilterResultSubtree,
  query: TestQuery,
  collapsible: boolean
): FilterResultSubtree {
  const children = n.children;
  const child = children.get(k);
  if (child !== undefined) {
    return child as FilterResultSubtree;
  }

  const v = { query, children: new Map(), collapsible };
  children.set(k, v);
  return v;
}
