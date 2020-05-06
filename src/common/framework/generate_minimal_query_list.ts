import { TIDGroupOrTestOrCase } from './id.js';
import { TestFileLoader } from './loader.js';
import { Logger } from './logger.js';
import { parseQuery } from './query/parseQuery.js';
import { kBigSeparator } from './query/separators.js';
import {
  loadTreeForQuery,
  FilterResultTree,
  FilterResultTreeNode,
  FilterResultSubtree,
  FilterResultTreeLeaf,
} from './tree.js';
import { assert } from './util/util.js';
import { TestQuery } from './query/query.js';

interface QuerySplitterTreeNode {
  needsSplit: boolean;
  parentNeedsSplit: boolean; // for debugging
  children?: Map<string, QuerySplitterTreeNode>;
}

interface Expectation {
  id: TIDGroupOrTestOrCase;
  line: string;
  seen: boolean;
}

function makeQuerySplitterTree(
  caselist: TestFilterResult[],
  expectationStrings: string[]
): QuerySplitterTreeNode {
  const expectations: Expectation[] = [];
  for (const e of expectationStrings) {
    const filter = makeFilter(e);
    const id = filter.idIfWholeSubtree();
    if (!id) {
      throw new Error(
        'Expectation must cover an entire subtree (i.e. end in `;*` or `:*` or `:`). ' + e
      );
    }
    expectations.push({ id, line: e, seen: false });
  }

  const convertToQuerySplitterTree = (
    tree: FilterResultTreeNode,
    name?: string
  ): [QuerySplitterTreeNode, boolean] => {
    let needsSplit = true;
    let parentNeedsSplit = false;

    if (name !== undefined) {
      const filter = makeFilter(name);
      needsSplit = !filter.definitelyWholeSubtree();

      const subtreeHasExpectation = expectations.some(e => {
        const matches = filter.matches(e.line); // there's still an expectation inside this subtree
        if (matches) e.seen = true;
        return matches;
      });
      parentNeedsSplit = subtreeHasExpectation;
    }

    const queryNode: QuerySplitterTreeNode = { needsSplit, parentNeedsSplit };
    if ('children' in tree) {
      queryNode.children = new Map();
      for (const [k, v] of tree.children) {
        const [subtree, childNeedsParentSplit] = convertToQuerySplitterTree(v, k);
        queryNode.needsSplit = queryNode.needsSplit || childNeedsParentSplit;
        queryNode.children.set(k, subtree);
      }
    }
    return [queryNode, parentNeedsSplit];
  };

  const log = new Logger();
  const tree = treeFromFilterResults(log, caselist.values());
  const [queryTree] = convertToQuerySplitterTree(tree)!;

  for (const e of expectations) {
    if (!e.seen) {
      throw new Error('expectation had no effect: ' + e.line);
    }
  }

  return queryTree;
}

// Takes a TestFilterResultIterator enumerating every test case in the suite, and a list of
// expectation queries from a browser's expectations file. Creates a minimal list of queries
// (i.e. wpt variant lines) such that:
//
// - There is at least one query per spec file.
// - Each of those those input queries is in the output, so that it can have its own expectation.
//
// It does this by creating a tree from the list of cases (same tree as the standalone runner uses),
// then marking every node which is a parent of a node that matches an expectation.
export async function generateMinimalQueryList(
  caselist: TestFilterResult[],
  expectationStrings: string[]
): Promise<string[]> {
  const unsplitNodes: string[] = [];
  const findUnsplitNodes = (name: string, node: QuerySplitterTreeNode | undefined) => {
    if (node === undefined) {
      return;
    }
    if (node.needsSplit && node.children) {
      for (const [k, v] of node.children) {
        findUnsplitNodes(k, v);
      }
    } else {
      unsplitNodes.push(name);
    }
  };

  const queryTree = makeQuerySplitterTree(caselist, expectationStrings);
  findUnsplitNodes('', queryTree);

  for (const exp of expectationStrings) {
    if (!unsplitNodes.some(name => name === exp)) {
      // eslint-disable-next-line no-console
      console.log('====', exp);
      // eslint-disable-next-line no-console
      console.log(unsplitNodes);
      printQuerySplitterTree(queryTree);
      throw new Error(
        'Something went wrong: all expectation strings should always appear exactly: ' + exp
      );
    }
  }
  return unsplitNodes;
}

interface QuerySplitterSubtree extends FilterResultSubtree {
  needsSplit: boolean;
}

type QuerySplitterTreeNode2 = QuerySplitterSubtree | 'leaf';

class QuerySplitterTree {
  private readonly root: QuerySplitterSubtree;

  constructor(tree: FilterResultTree) {
    this.root = makeQuerySplitterSubtree(tree.root) as QuerySplitterSubtree;
  }

  split(query: TestQuery) {
    throw 0;
  }

  iterate(): IterableIterator<string> {
    throw 0;
  }
}

function makeQuerySplitterSubtree(subtree: FilterResultTreeNode): QuerySplitterTreeNode2 {
  if ('children' in subtree) {
    const children = new Map();
    for (const [k, v] of subtree.children) {
      children.set(k, makeQuerySplitterSubtree(v));
    }
    return { children, needsSplit: false };
  } else {
    return 'leaf';
  }
}

export async function generateMinimalQueryList2(
  suite: string,
  loader: TestFileLoader,
  expectationStrings: string[]
): Promise<IterableIterator<string>> {
  const tree = await loadTreeForQuery(loader, { suite, group: [], endsWithWildcard: true });
  const splitterTree = new QuerySplitterTree(tree);

  for (const expectationString of expectationStrings) {
    assert(
      expectationString.startsWith(suite + kBigSeparator),
      `Expectation must start with ${suite}${kBigSeparator}: ${expectationString}`
    );
    const expectation = parseQuery(expectationString);
    splitterTree.split(expectation);
  }
  return splitterTree.iterate();
}

// For debugging
export function printQuerySplitterTree(tree: QuerySplitterTreeNode, indent: string = ''): void {
  if (tree.children === undefined) {
    return;
  }
  for (const [name, child] of tree.children) {
    // eslint-disable-next-line no-console
    console.log(
      child.needsSplit ? 'S' : '_',
      child.parentNeedsSplit ? 'P' : '_',
      makeFilter(name).definitelyWholeSubtree() ? '1' : '_',
      indent + name
    );
    printQuerySplitterTree(child, indent + ' ');
  }
}
