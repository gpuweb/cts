import { TestFileLoader } from './loader.js';
import { TestCaseRecorder } from './logging/test_case_recorder.js';
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
import { RunCase, RunFn } from './test_group.js';
import { assert } from './util/util.js';

export interface FilterResultSubtree {
  query: TestQuery;
  description?: string;
  readonly children: Map<string, FilterResultTreeNode>;
  collapsible: boolean;
}

export interface FilterResultTreeLeaf {
  readonly query: TestQuery;
  readonly run: RunFn;
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

  iterate(): IterableIterator<FilterResultTreeLeaf> {
    return iterateSubtree(this.root);
  }

  // For debugging
  print(): void {
    FilterResultTree.printHelper('(root)', this.root);
  }

  static printHelper(name: string, tree: FilterResultTreeNode, indent: string = ''): void {
    const collapsible = 'run' in tree ? '>' : tree.collapsible ? '+' : '-';
    // eslint-disable-next-line no-console
    console.log(
      indent +
        `${collapsible} ${JSON.stringify(name)} => ` +
        `${stringifyQuery(tree.query)}        ${JSON.stringify(tree.query)}`
    );
    if ('children' in tree) {
      if (tree.description !== undefined) {
        // eslint-disable-next-line no-console
        console.log(indent + '    | ' + JSON.stringify(tree.description));
      }

      for (const [name, child] of tree.children) {
        FilterResultTree.printHelper(name, child, indent + '  ');
      }
    }
  }
}

function* iterateSubtree(subtree: FilterResultSubtree): IterableIterator<FilterResultTreeLeaf> {
  for (const [, child] of subtree.children) {
    if ('children' in child) {
      yield* iterateSubtree(child);
    } else {
      yield child;
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

// TODO: Consider having subqueriesToExpand actually impact the order of params in the tree.
export async function loadTreeForQuery(
  loader: TestFileLoader,
  query: TestQuery,
  subqueriesToExpand: TestQuery[]
): Promise<FilterResultTree> {
  const suite = query.suite;
  const specs = await loader.listing(suite);

  let foundCase = false;
  // L0 = suite, L1 = group, L2 = test, L3 = case
  // subtreeL0   is suite1:*
  // subtreeL1   is suite1:foo:*
  // subtreeL2   is suite1:foo:hello:*
  const subtreeL0 = makeTreeForSuite(suite);
  for (const entry of specs) {
    const orderingL1 = comparePaths(entry.path, query.group);
    if (orderingL1 === Ordering.Unordered) {
      // Group path is not matched by this filter.
      continue;
    }

    if (entry.path.length === 0 && 'readme' in entry) {
      // Suite-level readme.
      subtreeL0.description = entry.readme.trim();
      continue;
    }

    // subtreeL1 is suite1:foo,* (for now)
    const subtreeL1 = subtreeForGroupPath(subtreeL0, entry.path);

    if ('readme' in entry) {
      // Entry is a readme that is an ancestor or descendant of the query.
      subtreeL1.description = entry.readme.trim();
      continue;
    }
    // Entry is a spec file.

    // No spec file's group path should be a superset of the query's group path.
    assert(orderingL1 !== Ordering.Superset, 'Query does not match any tests');

    const spec = await loader.importSpecFile(query.suite, entry.path);
    // Here, we know subtreeL1 will have only one child.
    // Modify subtreeL1 so it's now suite1:foo:* instead of suite1:foo,*
    subtreeL1.query = { ...subtreeL1.query, test: [] };
    subtreeL1.description = spec.description.trim();
    const collapsible = (sq: TestQuery) =>
      subqueriesToExpand.every(s => {
        console.log(stringifyQuery(s), stringifyQuery(sq), querySubsetOfQuery(s, sq));
        return querySubsetOfQuery(s, sq) !== IsSubset.YesStrict;
      });
    subtreeL1.collapsible = collapsible(subtreeL1.query);

    // TODO: this is taking a tree, flattening it, and then unflattening it. Possibly redundant?
    for (const t of spec.g.iterate()) {
      if ('test' in query) {
        const orderingL2 = comparePaths(t.id.test, query.test);
        if (orderingL2 === Ordering.Unordered || orderingL2 === Ordering.Superset) {
          // Test path is not matched by this filter.
          continue;
        }
      }

      // subtreeL2a is suite1:foo:hello,*
      const subtreeL2a = subtreeForTestPath(subtreeL1, t.id.test, collapsible);

      const subqueryL2b = { ...cloneQuery(subtreeL2a.query), params: {} as ParamSpec };
      // subtreeL2b is suite1:foo:hello:*
      const subtreeL2b = getOrInsertSubtree('', subtreeL2a, subqueryL2b, collapsible(subqueryL2b));

      if ('params' in query) {
        const orderingL3 = compareParamsPaths(t.id.params, query.params);
        if (orderingL3 === Ordering.Unordered || orderingL3 === Ordering.Superset) {
          // Case is not matched by this filter.
          continue;
        }
        if (orderingL3 !== Ordering.Equal && !query.endsWithWildcard) {
          // Query is exact, but params is not equal.
          continue;
        }
      }

      // Subtree for case
      subtreeForCaseExceptLeaf(subtreeL2b, t, subqueriesToExpand);

      foundCase = true;
    }
  }
  const tree = new FilterResultTree(subtreeL0);

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
  const subquery = { ...cloneQuery(tree.query), group: [] as string[] };
  for (const part of group) {
    subquery.group.push(part);
    tree = getOrInsertSubtree(part, tree, subquery, false);
  }
  return tree;
}

function subtreeForTestPath(
  tree: FilterResultSubtree,
  test: readonly string[],
  collapsible: (sq: TestQuery) => boolean
): FilterResultSubtree {
  const subquery = { ...cloneQuery(tree.query), test: [] as string[] };
  for (const part of test) {
    subquery.test.push(part);
    tree = getOrInsertSubtree(part, tree, subquery, collapsible(subquery));
  }
  return tree;
}

function subtreeForCaseExceptLeaf(
  tree: FilterResultSubtree,
  t: RunCase,
  subqueriesToExpand: TestQuery[]
): FilterResultTreeLeaf {
  assert('test' in tree.query);
  const subquery = { ...cloneQuery(tree.query), params: {} as ParamSpec };
  const entries = Object.entries(t.id.params);
  let name: string = '';
  for (let i = 0; i < entries.length; ++i) {
    const [k, v] = entries[i];

    subquery.params[k] = v;
    name = stringifySingleParam(k, v);

    if (i < entries.length - 1) {
      const collapsible = subqueriesToExpand.every(
        s => querySubsetOfQuery(s, subquery) !== IsSubset.YesStrict
      );
      tree = getOrInsertSubtree(name, tree, subquery, collapsible);
    }
  }

  subquery.endsWithWildcard = false;
  const leaf = {
    query: subquery,
    run: (rec: TestCaseRecorder) => t.run(rec),
  };
  tree.children.set(name, leaf);
  return leaf;
}

function getOrInsertSubtree(
  k: string,
  n: FilterResultSubtree,
  query: TestQuery,
  collapsible: boolean
): FilterResultSubtree {
  const children = n.children;

  let v: FilterResultSubtree;

  const child = children.get(k);
  if (child !== undefined) {
    v = child as FilterResultSubtree;
    v.collapsible = collapsible;
  } else {
    v = { query: cloneQuery(query), children: new Map(), collapsible };
    children.set(k, v);
  }
  return v;
}

function cloneQuery(q: TestQuery): TestQuery {
  const q2 = {
    suite: q.suite,
    group: [...q.group],
  };
  if ('params' in q) {
    return {
      ...q2,
      test: [...q.test],
      params: { ...q.params },
      endsWithWildcard: q.endsWithWildcard,
    };
  }
  if ('test' in q) {
    return { ...q2, test: [...q.test], endsWithWildcard: true };
  }
  return { ...q2, endsWithWildcard: true };
}
