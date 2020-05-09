import { TestFileLoader } from './loader.js';
import { TestCaseRecorder } from './logging/test_case_recorder.js';
import { ParamSpec, stringifySingleParam } from './params_utils.js';
import { querySubsetOfQuery, IsSubset, compareQueries, Ordering } from './query/compare.js';
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
  toString(): string {
    return FilterResultTree.printHelper('(root)', this.root);
  }

  static printHelper(name: string, tree: FilterResultTreeNode, indent: string = ''): string {
    const collapsible = 'run' in tree ? '>' : tree.collapsible ? '+' : '-';
    let s =
      indent +
      `${collapsible} ${JSON.stringify(name)} => ` +
      `${stringifyQuery(tree.query)}        ${JSON.stringify(tree.query)}`;
    if ('children' in tree) {
      if (tree.description !== undefined) {
        s += indent + `\n    | ${JSON.stringify(tree.description)}`;
      }

      for (const [name, child] of tree.children) {
        s += '\n' + FilterResultTree.printHelper(name, child, indent + '  ');
      }
    }
    return s;
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

// TODO: Consider having subqueriesToExpand actually impact the depth-order of params in the tree.
export async function loadTreeForQuery(
  loader: TestFileLoader,
  query: TestQuery,
  subqueriesToExpand: TestQuery[]
): Promise<FilterResultTree> {
  const suite = query.suite;
  const specs = await loader.listing(suite);

  const subqueriesToExpandEntries = Array.from(subqueriesToExpand.entries());
  const seenSubqueriesToExpand: boolean[] = new Array(subqueriesToExpand.length);
  seenSubqueriesToExpand.fill(false);

  const checkCollapsible = (subquery: TestQuery) =>
    subqueriesToExpandEntries.every(([i, toExpand]) => {
      const isSubset = querySubsetOfQuery(toExpand, subquery);

      // If toExpand == subquery, no expansion is needed (but it's still "seen").
      if (isSubset === IsSubset.YesEqual) seenSubqueriesToExpand[i] = true;
      return isSubset !== IsSubset.YesStrict;
    });

  let foundCase = false;
  // L0 = suite, L1 = group, L2 = test, L3 = case
  // subtreeL0   is suite1:*
  // subtreeL1   is suite1:foo:*
  // subtreeL2   is suite1:foo:hello:*
  // subtreeL3   is suite1:foo:hello:
  const subtreeL0 = makeTreeForSuite(suite);
  checkCollapsible(subtreeL0.query); // mark seenSubqueriesToExpand
  for (const entry of specs) {
    if (entry.path.length === 0 && 'readme' in entry) {
      // Suite-level readme.
      subtreeL0.description = entry.readme.trim();
      continue;
    }

    const orderingL1 = compareQueries(
      { suite, group: entry.path, test: [], endsWithWildcard: true },
      query
    );
    if (orderingL1 === Ordering.Unordered) {
      // Group path is not matched by this filter.
      continue;
    }

    if ('readme' in entry) {
      // Entry is a readme that is an ancestor or descendant of the query.

      // subtreeL1 is suite1:foo,*
      const subtreeL1 = subtreeForGroupPath(subtreeL0, entry.path);
      subtreeL1.description = entry.readme.trim();
      continue;
    }
    // Entry is a spec file.

    const spec = await loader.importSpecFile(query.suite, entry.path);
    // Here, we know subtreeL1 will have only one child.
    // Set subtreeL1 to suite1:foo:* (instead of suite1:foo,*)
    const subtreeL1 = subtreeForGroupPath(subtreeL0, entry.path);
    subtreeL1.query = { ...subtreeL1.query, test: [] };
    subtreeL1.description = spec.description.trim();
    subtreeL1.collapsible = checkCollapsible(subtreeL1.query);

    // TODO: this is taking a tree, flattening it, and then unflattening it. Possibly redundant?
    for (const t of spec.g.iterate()) {
      const orderingL3 = compareQueries(
        {
          suite,
          group: entry.path,
          test: t.id.test,
          params: t.id.params,
          endsWithWildcard: false,
        },
        query
      );
      if (orderingL3 === Ordering.Unordered || orderingL3 === Ordering.Superset) {
        // Case is not matched by this filter.
        continue;
      }

      // subtreeL2a is suite1:foo:hello,*
      const subtreeL2a = subtreeForTestPath(subtreeL1, t.id.test, checkCollapsible);

      // subtreeL2b is suite1:foo:hello:*
      const subqueryL2b = { ...cloneQuery(subtreeL2a.query), params: {} as ParamSpec };
      const subtreeL2b = getOrInsertSubtree(
        '',
        subtreeL2a,
        subqueryL2b,
        checkCollapsible(subqueryL2b)
      );

      // Subtree for case
      subtreeForCaseExceptLeaf(subtreeL2b, t, checkCollapsible);

      foundCase = true;
    }
  }
  const tree = new FilterResultTree(subtreeL0);

  for (const [i, sq] of subqueriesToExpandEntries) {
    const seen = seenSubqueriesToExpand[i];
    assert(seen, 'subqueriesToExpand entry did not match anything: ' + stringifyQuery(sq));
  }
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
  checkCollapsible: (sq: TestQuery) => boolean
): FilterResultSubtree {
  const subquery = { ...cloneQuery(tree.query), test: [] as string[] };
  for (const part of test) {
    subquery.test.push(part);
    tree = getOrInsertSubtree(part, tree, subquery, checkCollapsible(subquery));
  }
  return tree;
}

function subtreeForCaseExceptLeaf(
  tree: FilterResultSubtree,
  t: RunCase,
  checkCollapsible: (sq: TestQuery) => boolean
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
      tree = getOrInsertSubtree(name, tree, subquery, checkCollapsible(subquery));
    }
  }

  subquery.endsWithWildcard = false;
  checkCollapsible(subquery); // mark seenSubqueriesToExpand
  const leaf = {
    query: subquery,
    run: (rec: TestCaseRecorder) => t.run(rec),
  };
  assert('children' in tree);
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
