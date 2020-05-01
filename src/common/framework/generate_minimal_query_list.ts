import { TIDGroupOrTestOrCase } from './id.js';
import { Logger } from './logger.js';
import { makeFilter } from './test_filter/load_filter.js';
import { TestFilterResult } from './test_filter/test_filter_result.js';
import { FilterResultTreeNode, treeFromFilterResults } from './tree.js';

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
