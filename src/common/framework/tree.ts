import { TestFileLoader } from './file_loader.js';
import { TestCaseRecorder } from './logging/test_case_recorder.js';
import { CaseParamsRW } from './params_utils.js';
import { compareQueries, Ordering } from './query/compare.js';
import {
  TestQuery,
  TestQueryMultiCase,
  TestQuerySingleCase,
  TestQueryMultiFile,
  TestQueryMultiTest,
} from './query/query.js';
import { stringifySingleParam } from './query/stringify_params.js';
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

  iterateCollapsedQueries(): IterableIterator<TestQuery> {
    return FilterResultTree.iterateSubtreeCollapsedQueries(this.root);
  }

  iterateLeaves(): IterableIterator<FilterResultTreeLeaf> {
    return FilterResultTree.iterateSubtreeLeaves(this.root);
  }

  toString(): string {
    return FilterResultTree.subtreeToString('(root)', this.root, '');
  }

  static *iterateSubtreeCollapsedQueries(
    subtree: FilterResultSubtree
  ): IterableIterator<TestQuery> {
    for (const [, child] of subtree.children) {
      if ('children' in child && !child.collapsible) {
        yield* FilterResultTree.iterateSubtreeCollapsedQueries(child);
      } else {
        yield child.query;
      }
    }
  }

  static *iterateSubtreeLeaves(
    subtree: FilterResultSubtree
  ): IterableIterator<FilterResultTreeLeaf> {
    for (const [, child] of subtree.children) {
      if ('children' in child) {
        yield* FilterResultTree.iterateSubtreeLeaves(child);
      } else {
        yield child;
      }
    }
  }

  static subtreeToString(name: string, tree: FilterResultTreeNode, indent: string): string {
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
        s += '\n' + FilterResultTree.subtreeToString(name, child, indent + '  ');
      }
    }
    return s;
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

  // L0 = suite-level, e.g. suite:*
  // L1 =  file-level, e.g. suite:a,b:*
  // L2 =  test-level, e.g. suite:a,b:c,d:*
  // L3 =  case-level, e.g. suite:a,b:c,d:
  let foundCase = false;
  // L0 is suite:*
  const subtreeL0 = makeTreeForSuite(suite);
  checkCollapsible(subtreeL0.query); // mark seenSubqueriesToExpand
  for (const entry of specs) {
    if (entry.file.length === 0 && 'readme' in entry) {
      // Suite-level readme.
      subtreeL0.description = entry.readme.trim();
      continue;
    }

    {
      const queryL1 = new TestQueryMultiFile(suite, entry.file);
      const orderingL1 = compareQueries(queryL1, queryToLoad);
      if (orderingL1 === Ordering.Unordered) {
        // File path is not matched by this filter.
        continue;
      }
    }

    if ('readme' in entry) {
      // Entry is a readme that is an ancestor or descendant of the query.

      // readmeSubtree is suite:a,b,*
      const readmeSubtree: FilterResultSubtree<TestQueryMultiFile> = makeSubtreeForDirPath(
        subtreeL0,
        entry.file
      );
      readmeSubtree.description = entry.readme.trim();
      continue;
    }
    // Entry is a spec file.

    const spec = await loader.importSpecFile(queryToLoad.suite, entry.file);
    const description = spec.description.trim();
    // subtreeL1 is suite:a,b:*
    const subtreeL1: FilterResultSubtree<TestQueryMultiTest> = makeSubtreeForFilePath(
      subtreeL0,
      entry.file,
      description,
      checkCollapsible
    );

    // TODO: this is taking a tree, flattening it, and then unflattening it. Possibly redundant?
    for (const t of spec.g.iterate()) {
      {
        const queryL3 = new TestQuerySingleCase(suite, entry.file, t.id.test, t.id.params);
        const orderingL3 = compareQueries(queryL3, queryToLoad);
        if (orderingL3 === Ordering.Unordered || orderingL3 === Ordering.StrictSuperset) {
          // Case is not matched by this filter.
          continue;
        }
      }

      // subtreeL2 is suite:a,b:c,d:*
      const subtreeL2: FilterResultSubtree<TestQueryMultiCase> = makeSubtreeForTestPath(
        subtreeL1,
        t.id.test,
        checkCollapsible
      );

      // Subtree for case is suite:a,b:c,d:x=1;y=2
      makeLeafForCase(subtreeL2, t, checkCollapsible);

      foundCase = true;
    }
  }
  const tree = new FilterResultTree(subtreeL0);

  for (const [i, sq] of subqueriesToExpandEntries) {
    const seen = seenSubqueriesToExpand[i];
    assert(seen, `subqueriesToExpand entry did not match anything: ${sq.toString()}`);
  }
  assert(foundCase, 'Query does not match any cases');

  // TODO: Contains lots of single-child subtrees. Consider cleaning those up (as postprocess?).
  return tree;
}

function makeTreeForSuite(suite: string): FilterResultSubtree<TestQueryMultiFile> {
  return {
    query: new TestQueryMultiFile(suite, []),
    children: new Map(),
    collapsible: false,
  };
}

function makeSubtreeForDirPath(
  tree: FilterResultSubtree<TestQueryMultiFile>,
  file: string[]
): FilterResultSubtree<TestQueryMultiFile> {
  const subqueryFile = [];
  // To start, tree is suite:*
  // This loop goes from that -> suite:a,* -> suite:a,b,*
  for (const part of file) {
    subqueryFile.push(part);
    const subquery = new TestQueryMultiFile(tree.query.suite, subqueryFile);
    tree = getOrInsertSubtree(part, tree, subquery, false);
  }
  return tree;
}

function makeSubtreeForFilePath(
  tree: FilterResultSubtree<TestQueryMultiFile>,
  file: string[],
  description: string,
  checkCollapsible: (sq: TestQuery) => boolean
): FilterResultSubtree<TestQueryMultiTest> {
  // To start, tree is suite:*
  // This goes from that -> suite:a,* -> suite:a,b,*
  tree = makeSubtreeForDirPath(tree, file);
  // This goes from that -> suite:a,b:*
  const subquery = new TestQueryMultiTest(tree.query.suite, tree.query.file, []);
  const subtree = getOrInsertSubtree('', tree, subquery, checkCollapsible(subquery));
  subtree.description = description;
  return subtree;
}

function makeSubtreeForTestPath(
  tree: FilterResultSubtree<TestQueryMultiTest>,
  test: readonly string[],
  checkCollapsible: (sq: TestQuery) => boolean
): FilterResultSubtree<TestQueryMultiCase> {
  const subqueryTest = [];
  // To start, tree is suite:a,b:*
  // This loop goes from that -> suite:a,b:c,* -> suite:a,b:c,d,*
  for (const part of test) {
    subqueryTest.push(part);
    const subquery = new TestQueryMultiTest(tree.query.suite, tree.query.file, subqueryTest);
    tree = getOrInsertSubtree(part, tree, subquery, checkCollapsible(subquery));
  }
  // This goes from that -> suite:a,b:c,d:*
  const subquery = new TestQueryMultiCase(tree.query.suite, tree.query.file, subqueryTest, {});
  return getOrInsertSubtree('', tree, subquery, checkCollapsible(subquery));
}

function makeLeafForCase(
  tree: FilterResultSubtree<TestQueryMultiTest>,
  t: RunCase,
  checkCollapsible: (sq: TestQuery) => boolean
): void {
  const query = tree.query;
  let name: string = '';
  const subqueryParams: CaseParamsRW = {};

  // To start, tree is suite:a,b:c,d:*
  // This loop goes from that -> suite:a,b:c,d:x=1;* -> suite:a,b:c,d:x=1;y=2;*
  for (const [k, v] of Object.entries(t.id.params)) {
    name = stringifySingleParam(k, v);
    subqueryParams[k] = v;

    const subquery = new TestQueryMultiCase(query.suite, query.file, query.test, subqueryParams);
    tree = getOrInsertSubtree(name, tree, subquery, checkCollapsible(subquery));
  }

  // This goes from that -> suite:a,b:c,d:x=1;y=2
  const subquery = new TestQuerySingleCase(query.suite, query.file, query.test, subqueryParams);
  checkCollapsible(subquery); // mark seenSubqueriesToExpand
  insertLeaf(tree, subquery, t);
}

function getOrInsertSubtree<T extends TestQuery>(
  key: string,
  parent: FilterResultSubtree,
  query: T,
  collapsible: boolean
): FilterResultSubtree<T> {
  let v: FilterResultSubtree<T>;
  const child = parent.children.get(key);
  if (child !== undefined) {
    assert('children' in child); // Make sure cached subtree is not actually a leaf
    v = child as FilterResultSubtree<T>;
    v.collapsible = collapsible;
  } else {
    v = { query, children: new Map(), collapsible };
    parent.children.set(key, v);
  }
  return v;
}

function insertLeaf(parent: FilterResultSubtree, query: TestQuerySingleCase, t: RunCase) {
  const key = '';
  const leaf: FilterResultTreeLeaf = {
    query,
    run: (rec: TestCaseRecorder) => t.run(rec),
  };
  assert(!parent.children.has(key));
  parent.children.set(key, leaf);
}
