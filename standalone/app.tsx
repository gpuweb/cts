import * as React from 'react';
import { useEffect, useState, createContext } from 'react';
import { render } from 'react-dom';

import { setBaseResourcePath } from '@src/common/framework/resources.js';
import { DefaultTestFileLoader } from '@src/common/internal/file_loader.js';
import { TestSubtree, TestTree, TestTreeNode } from '@src/common/internal/tree.js';
import { Logger } from '@src/common/internal/logging/logger.js';
import { parseQuery } from '@src/common/internal/query/parseQuery.js';
import { TestQueryLevel } from '@src/common/internal/query/query.js';
import { assert, unreachable } from '@src/common/util/util.js';
import { optionEnabled } from '@src/common/runtime/helper/options.js';
import { TestWorker } from '@src/common/runtime/helper/test_worker.js';

import { TreeRoot } from './components.js';
import { TestRunner } from './test_runner.js';
import { TestResults } from './test_results.js';

const runnow = optionEnabled('runnow');
const debug = optionEnabled('debug');

Logger.globalDebugMode = debug;
const logger = new Logger();

setBaseResourcePath('../out/resources');

const worker = optionEnabled('worker') ? new TestWorker(debug) : undefined;

// Collapse s:f:t:* or s:f:t:c by default.
let lastQueryLevelToExpand: TestQueryLevel = 2;

const loader = new DefaultTestFileLoader();

const qs = new URLSearchParams(window.location.search).getAll('q');
if (qs.length === 0) {
  qs.push('webgpu:*');
}

// Update the URL bar to match the exact current options.
{
  let url = window.location.protocol + '//' + window.location.host + window.location.pathname;
  url +=
    '?' +
    new URLSearchParams([
      ['runnow', runnow ? '1' : '0'],
      ['worker', worker ? '1' : '0'],
      ['debug', debug ? '1' : '0'],
    ]).toString() +
    '&' +
    qs.map(q => 'q=' + q).join('&');
  window.history.replaceState(null, '', url);
}

assert(qs.length === 1, 'currently, there must be exactly one ?q=');
const rootQuery = parseQuery(qs[0]);
if (rootQuery.level > lastQueryLevelToExpand) {
  lastQueryLevelToExpand = rootQuery.level;
}

// Create a test runner for running tests.
const testRunner = new TestRunner(logger, rootQuery, worker);

// Create storage for test results. The test runner will
// publish to the TestResults, and the app UI will listen
// for changes and render them to the DOM.
const testResults = new TestResults();

export const ExpandAllContext = createContext(0);
const expandAllActions: Set<(serial: number) => void> = new Set();
function registerExpandAllAction(action: (serial: number) => void): () => void {
  expandAllActions.add(action);
  return () => {
    expandAllActions.delete(action);
  }
}

// Global app context needed throughout the application.
export const AppContext = createContext({
  lastQueryLevelToExpand,
  worker,
  runnow,
  debug,
  registerExpandAllAction,
  testRunner,
  testResults
});

// Helper to simplify the tree representation.
function dissolveSingleChildTrees(tree: TestTreeNode): TestTreeNode {
  if ('children' in tree) {
    const shouldDissolveThisTree =
      tree.children.size === 1 && tree.query.depthInLevel !== 0 && tree.description === undefined;
    if (shouldDissolveThisTree) {
      // Loops exactly once
      for (const [, child] of tree.children) {
        // Recurse on child
        return dissolveSingleChildTrees(child);
      }
    }

    for (const [k, child] of tree.children) {
      // Recurse on each child
      const newChild = dissolveSingleChildTrees(child);
      if (newChild !== child) {
        tree.children.set(k, newChild);
      }
    }
  }
  return tree;
}

function onBaseTreeLoaded(n: TestSubtree) {
  // Propgate counts and simplify the tree.
  TestTree.propagateCounts(n);
  dissolveSingleChildTrees(n);

  // Because some nodes may still be loading, wait for all loading children,
  // and then propogate their counts as well.
  (function bubbleUpCountsOnLoad(
    n: TestSubtree,
    bubbleUpCounts?: (counts: TestSubtree['subtreeCounts']) => void) {

    function onChildComputedCounts(counts: TestSubtree['subtreeCounts']) {
      assert(counts !== undefined);
      n.subtreeCounts ??= { tests: 0, nodesWithTODO: 0 };
      n.subtreeCounts.tests += counts?.tests;
      n.subtreeCounts.nodesWithTODO += counts?.nodesWithTODO;
      if (bubbleUpCounts) {
        bubbleUpCounts(counts);
      }
    }

    if (!n.loaded()) {
      assert(n.loadPromise !== undefined);
      n.loadPromise.then(() => {
        // Propagate counts for the newly added children.
        TestTree.propagateCounts(n);
        // Bubble counts up the tree.
        assert(bubbleUpCounts !== undefined);
        bubbleUpCounts(n.subtreeCounts);
        // Dissolve any new single child trees that were added.
        dissolveSingleChildTrees(n);
      });
    }

    // Recurse on children.
    for (const [, c] of n.children) {
      if ('children' in c) {
        bubbleUpCountsOnLoad(c, onChildComputedCounts);
      }
    }
  })(n);
}

const App: React.FunctionComponent = () => {
  const [root, setRoot] = useState<TestSubtree | null>(null);
  useEffect(() => {
    let startLoadingFiles: () => void = unreachable;
    const deferredFileLoadPromise = new Promise<void>(resolve => {
      startLoadingFiles = resolve;
    });
    const baseTreeLoaded = loader.loadTree(
        rootQuery, [], deferredFileLoadPromise).then(tree => {
          setRoot(tree.root);
          onBaseTreeLoaded(tree.root);
    });
    // Defer starting to load any spec files until the tree is
    // done loading. This allows the intial tree to render quickly
    // before more network requests are made.
    baseTreeLoaded.then(startLoadingFiles);

    if (runnow) {
      testRunner.runTests(rootQuery, testResults);
    }
  }, []);

  const [expandAllSerial, setExpandAllSerial] = useState(0);

  return (
    <ExpandAllContext.Provider value={expandAllSerial}>
      <p>
        <input type="button" onClick={() => {
          expandAllActions.forEach(action => action(expandAllSerial + 1));
          setExpandAllSerial(expandAllSerial + 1);
        }} value="Expand All (slow!)" />
      </p>
      {root ? <TreeRoot n={root} /> : null}
      <p>
        <input type="button" onClick={() => {
          navigator.clipboard.writeText(logger.asJSON(2));
        }} value="Copy results as JSON" />
      </p>
    </ExpandAllContext.Provider>
  );
}

render(<App />, document.getElementById('root'));
