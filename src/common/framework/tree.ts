import { Logger } from './logger.js';
import { stringifySingleParam } from './params_utils.js';
import { TestFilterResult } from './test_filter/test_filter_result.js';
import { RunCase } from './test_group.js';

interface FilterResultSubtree {
  description?: string;
  children: Map<string, FilterResultTreeNode>;
}

interface FilterResultTreeLeaf {
  runCase: RunCase;
}

export type FilterResultTreeNode = FilterResultSubtree | FilterResultTreeLeaf;

export function treeFromFilterResults(
  log: Logger,
  listing: IterableIterator<TestFilterResult>
): FilterResultSubtree {
  const root: FilterResultSubtree = { children: new Map() };
  for (const f of listing) {
    // Suite tree
    const [suiteSubtree, suitePath] = subtreeForSuite(root, f);
    if (f.id.group.length === 0) {
      // This is a suite README.
      suiteSubtree.description = f.spec.description.trim();
      continue;
    }

    // Group trees
    const [groupSubtree, groupPath] = subtreeForGroup(suitePath, suiteSubtree, f);
    if (!('g' in f.spec)) {
      // This is a directory README.
      continue;
    }

    const [tRec] = log.record(f.id);
    for (const t of f.spec.g.iterate(tRec)) {
      // Test trees
      const [testSubtree, testPath] = subtreeForTest(groupPath, groupSubtree, t);

      // Case trees
      subtreeForCaseLeaf(testPath, testSubtree, t);
    }
  }
  return root;
}

function subtreeForSuite(
  root: FilterResultSubtree,
  f: TestFilterResult
): [FilterResultSubtree, string] {
  const path = f.id.suite + ':';
  const subtree = getOrInsertSubtree(root, path + '*');
  return [subtree, path];
}

function subtreeForGroup(
  path: string,
  tree: FilterResultSubtree,
  f: TestFilterResult
): [FilterResultSubtree, string] {
  for (const part of pathPartsWithSeparators(f.id.group)) {
    path += part;
    tree = getOrInsertSubtree(tree, path + '*');
  }
  if (f.spec.description) {
    // This is a directory README or spec file.
    tree.description = f.spec.description.trim();
  }
  return [tree, path];
}

function subtreeForTest(
  path: string,
  tree: FilterResultSubtree,
  t: RunCase
): [FilterResultSubtree, string] {
  for (const part of pathPartsWithSeparators(t.id.test)) {
    path += part;
    tree = getOrInsertSubtree(tree, path + '*');
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
    tree = getOrInsertSubtree(tree, path + '*');
  }
  return [tree, path];
}

function subtreeForCaseLeaf(path: string, tree: FilterResultSubtree, t: RunCase): void {
  const paramsParts = Object.entries(t.id.params).map(([k, v]) => stringifySingleParam(k, v));
  const [caseBranch, caseBranchPath] = subtreeForCaseExceptLeaf(path, tree, paramsParts);

  // Single case
  const lastPart = paramsParts[paramsParts.length - 1];
  caseBranch.children.set(caseBranchPath + lastPart, { runCase: t });
}

function getOrInsertSubtree(n: FilterResultSubtree, k: string): FilterResultSubtree {
  const children = n.children;
  const child = children.get(k);
  if (child !== undefined) {
    return child as FilterResultSubtree;
  }
  const v = { children: new Map() };
  children.set(k, v);
  return v;
}

function* nonLastPathPartsWithSeparators(path: string[]): IterableIterator<string> {
  for (let i = 0; i < path.length - 1; ++i) {
    yield path[i] + ';';
  }
}

function* pathPartsWithSeparators(path: string[]): IterableIterator<string> {
  yield* nonLastPathPartsWithSeparators(path);
  yield path[path.length - 1] + ':';
}

// For debugging
export function printFilterResultTree(tree: FilterResultTreeNode, indent: string = ''): void {
  if (!('children' in tree)) {
    return;
  }
  for (const [name, child] of tree.children) {
    // eslint-disable-next-line no-console
    console.log(indent + name);
    printFilterResultTree(child, indent + ' ');
  }
}
