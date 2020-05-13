import { TestFileLoader } from './file_loader.js';
import { TestCaseRecorder } from './logging/test_case_recorder.js';
import { stringifySingleParam, CaseParamsRW } from './params_utils.js';
import { compareQueries, Ordering } from './query/compare.js';
import {
  TestQuery,
  TestQueryMultiCase,
  TestQuerySingleCase,
  TestQueryMultiFile,
  TestQueryMultiTest,
} from './query/query.js';
import { RunCase, RunFn } from './test_group.js';
import { assert } from './util/util.js';

export interface FilterResultSubtree<Q extends TestQuery = TestQuery> {
  query: Q;
  description?: string;
  readonly children: Map<string, FilterResultTreeNode>;
  collapsible: boolean;
}

export interface FilterResultTreeLeaf {
  readonly query: TestQuerySingleCase;
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
    return FilterResultTree.toStringHelper('(root)', this.root);
  }

  static toStringHelper(name: string, tree: FilterResultTreeNode, indent: string = ''): string {
    const collapsible = 'run' in tree ? '>' : tree.collapsible ? '+' : '-';
    let s =
      indent +
      `${collapsible} ${JSON.stringify(name)} => ` +
      `${tree.query}        ${JSON.stringify(tree.query)}`;
    if ('children' in tree) {
      if (tree.description !== undefined) {
        s += indent + `\n    | ${JSON.stringify(tree.description)}`;
      }

      for (const [name, child] of tree.children) {
        s += '\n' + FilterResultTree.toStringHelper(name, child, indent + '  ');
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
  queryToLoad: TestQuery,
  subqueriesToExpand: TestQuery[]
): Promise<FilterResultTree> {
  const suite = queryToLoad.suite;
  const specs = await loader.listing(suite);

  const subqueriesToExpandEntries = Array.from(subqueriesToExpand.entries());
  const seenSubqueriesToExpand: boolean[] = new Array(subqueriesToExpand.length);
  seenSubqueriesToExpand.fill(false);

  const checkCollapsible = (subquery: TestQuery) =>
    subqueriesToExpandEntries.every(([i, toExpand]) => {
      const ordering = compareQueries(toExpand, subquery);

      // If toExpand == subquery, no expansion is needed (but it's still "seen").
      if (ordering === Ordering.Equal) seenSubqueriesToExpand[i] = true;
      return ordering !== Ordering.StrictSubset;
    });

  let foundCase = false;
  // L0 = suite-level, e.g. suite1:*
  // L1 =  file-level, e.g. suite1:foo:*
  // L2 =  test-level, e.g. suite1:foo:hello:*
  // L3 =  case-level, e.g. suite1:foo:hello:
  const subtreeL0 = makeTreeForSuite(suite);
  checkCollapsible(subtreeL0.query); // mark seenSubqueriesToExpand
  for (const entry of specs) {
    if (entry.file.length === 0 && 'readme' in entry) {
      // Suite-level readme.
      subtreeL0.description = entry.readme.trim();
      continue;
    }

    const queryL1 = new TestQueryMultiTest(suite, entry.file, []);
    const orderingL1 = compareQueries(queryL1, queryToLoad);
    if (orderingL1 === Ordering.Unordered) {
      // File path is not matched by this filter.
      continue;
    }

    if ('readme' in entry) {
      // Entry is a readme that is an ancestor or descendant of the query.

      // subtreeL1 is suite1:foo,*
      const subtreeL1 = subtreeForFilePath(subtreeL0, entry.file);
      subtreeL1.description = entry.readme.trim();
      continue;
    }
    // Entry is a spec file.

    const spec = await loader.importSpecFile(queryToLoad.suite, entry.file);
    // Here, we know subtreeL1 will have only one child.
    // Set subtreeL1 to suite1:foo:* (instead of suite1:foo,*)
    const subtreeL1 = subtreeForFilePath(subtreeL0, entry.file);
    subtreeL1.query = queryL1;
    subtreeL1.description = spec.description.trim();
    subtreeL1.collapsible = checkCollapsible(subtreeL1.query);

    // TODO: this is taking a tree, flattening it, and then unflattening it. Possibly redundant?
    for (const t of spec.g.iterate()) {
      const queryL3 = new TestQuerySingleCase(suite, entry.file, t.id.test, t.id.params);
      const orderingL3 = compareQueries(queryL3, queryToLoad);
      if (orderingL3 === Ordering.Unordered || orderingL3 === Ordering.StrictSuperset) {
        // Case is not matched by this filter.
        continue;
      }

      // subtreeL2a is suite1:foo:hello,*
      const subtreeL2 = subtreeForTestPath(subtreeL1, t.id.test, checkCollapsible);

      // Subtree for case
      leafForCase(subtreeL2, t, checkCollapsible);

      foundCase = true;
    }
  }
  const tree = new FilterResultTree(subtreeL0);

  for (const [i, sq] of subqueriesToExpandEntries) {
    const seen = seenSubqueriesToExpand[i];
    assert(seen, `subqueriesToExpand entry did not match anything: ${sq.toString()}`);
  }
  assert(foundCase, 'Query does not match any cases');
  return tree;
}

function makeTreeForSuite(suite: string): FilterResultSubtree {
  const tree: FilterResultSubtree = {
    query: new TestQueryMultiFile(suite, []),
    children: new Map(),
    collapsible: false,
  };
  return tree;
}

function subtreeForFilePath(
  parent: FilterResultSubtree<TestQueryMultiFile>,
  file: string[]
): FilterResultSubtree<TestQueryMultiFile> {
  let tree = parent;
  const subqueryFile = [];
  for (const part of file) {
    subqueryFile.push(part);
    const subquery = new TestQueryMultiFile(tree.query.suite, subqueryFile);
    tree = getOrInsertSubtree(part, tree, subquery, false);
  }
  return tree;
}

function subtreeForTestPath(
  parent: FilterResultSubtree<TestQueryMultiFile>,
  test: readonly string[],
  checkCollapsible: (sq: TestQuery) => boolean
): FilterResultSubtree<TestQueryMultiTest> {
  let tree: FilterResultSubtree = parent;
  const subqueryTest = [];
  for (const part of test) {
    subqueryTest.push(part);
    const subquery = new TestQueryMultiTest(tree.query.suite, tree.query.file, subqueryTest);
    tree = getOrInsertSubtree(part, tree, subquery, checkCollapsible(subquery));
  }
  return tree as FilterResultSubtree<TestQueryMultiTest>;
}

function leafForCase(
  parent: FilterResultSubtree<TestQueryMultiTest>,
  t: RunCase,
  checkCollapsible: (sq: TestQuery) => boolean
): void {
  // Root subtree for suite1:foo:hello:*
  const rootSubquery = new TestQueryMultiCase(
    parent.query.suite,
    parent.query.file,
    parent.query.test,
    {}
  );
  let name: string = '';
  let tree = getOrInsertSubtree(name, parent, rootSubquery, checkCollapsible(rootSubquery));

  // Subtree except for the leaf
  const entries = Object.entries(t.id.params);
  const subqueryParams: CaseParamsRW = {};
  for (const [i, [k, v]] of entries.entries()) {
    name = stringifySingleParam(k, v);
    subqueryParams[k] = v;

    if (i < entries.length - 1) {
      const subquery = new TestQueryMultiCase(
        parent.query.suite,
        parent.query.file,
        parent.query.test,
        subqueryParams
      );
      tree = getOrInsertSubtree(name, tree, subquery, checkCollapsible(subquery));
    }
  }

  // Attach the leaf
  const subquery = new TestQuerySingleCase(
    parent.query.suite,
    parent.query.file,
    parent.query.test,
    subqueryParams
  );
  checkCollapsible(subquery); // mark seenSubqueriesToExpand
  const leaf: FilterResultTreeLeaf = {
    query: subquery,
    run: (rec: TestCaseRecorder) => t.run(rec),
  };
  //console.log(Object.entries(t.id.params), tree);
  assert('children' in tree);
  tree.children.set(name, leaf);
}

function getOrInsertSubtree(
  k: string,
  n: FilterResultSubtree,
  query: TestQuery,
  collapsible: boolean
): FilterResultSubtree {
  let v: FilterResultSubtree;
  const child = n.children.get(k);
  if (child !== undefined) {
    assert('children' in child); // Make sure cached subtree is not actually a leaf
    v = child;
    v.collapsible = collapsible;
  } else {
    v = { query, children: new Map(), collapsible };
    n.children.set(k, v);
  }
  return v;
}
