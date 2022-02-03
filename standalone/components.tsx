import * as React from 'react';
import { useState, useContext, useReducer, useMemo, useEffect } from 'react';

import { TestQueryLevel } from '@src/common/internal/query/query.js';
import { TestTree, TestTreeNode, TestSubtree, TestTreeLeaf } from '@src/common/internal/tree.js';
import { assert, ErrorWithExtra } from '@src/common/util/util.js';

import { AppContext, ExpandAllContext } from './app.js';
import { TestCaseResult } from '@src/common/internal/logging/result.js';

// State which tracks how many (nested) dependents of a node are still loading.
// |mutationId| continually increments for any change to |depsLoading| so that
// we can re-use it to force re-renders of dirty tree state.
type LoadState = {
  mutationId: number,
  depsLoading: number,
};

// Callback function to register that |subtree| is loading. |LoadState| will
// be mutated when a subtree begins and completes loading.
type AddLoadPromiseFn = (subtree: TestSubtree) => void;

// Nullable status for both leaf and non-leaf nodes. Used to style the DOM.
type TestStatus = TestCaseResult['status'] | 'passfail' | null;

// Function which is used to bubble up a test status to parent nodes.
type ReportStatusFn = (status: TestStatus) => void;

type StatusReportProps = {
  n: TestTreeNode,
  reportStatus: ReportStatusFn,
}

type TreeNodeProps = StatusReportProps & {
  parentLevel: TestQueryLevel,
  addLoadPromise?: AddLoadPromiseFn,
}

// Helper for logging the test creation stack or case logs.
function consoleLogError(e: Error | ErrorWithExtra | undefined) {
  if (e === undefined) return;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  (globalThis as any)._stack = e;
  /* eslint-disable-next-line no-console */
  console.log('_stack =', e);
  if ('extra' in e && e.extra !== undefined) {
    /* eslint-disable-next-line no-console */
    console.log('_stack.extra =', e.extra);
  }
}

// LoadingSpinner element. See CSS animation in index.html
const LoadingSpinner: React.VoidFunctionComponent = () => {
  return <div className="lds-ring subtreeloading"><div></div><div></div><div></div><div></div></div>
}

// Higher-order component which forwards props to |WrappedComponent|, additionally
// adding |subtreeChildren|. If the children have not loaded yet, |WrappedComponent|
// will be rendered again after loading completes.
// Memoized prop |subtreeChildrenQueryStrings| is also added to avoid redundant toString
// computations.
function withLoadedChildren<P extends { n: TestSubtree }>(
  WrappedComponent: React.FunctionComponent<P & {
    subtreeChildren: TestTreeNode[],
    subtreeChildrenQueryStrings: string[],
  }>) {
  return function WithLoadedChildren({ ...props }: P) {
    const { n } = props;

    const [subtreeChildren, setSubtreeChildren] = useState<TestTreeNode[]>(
      n.loaded() ? Array.from(n.children.values()) : []);

    // If not yet loaded, wait on the promise and then set the children.
    useEffect(() => {
      if (!n.loaded()) {
        assert(n.loadPromise !== undefined);
        n.loadPromise.then(() => {
          setSubtreeChildren(Array.from(n.children.values()));
        });
      }
    }, []);

    const subtreeChildrenQueryStrings = useMemo(() => {
      return subtreeChildren.map(subtree => subtree.query.toString());
    }, [subtreeChildren]);

    return (
      <WrappedComponent
        subtreeChildren={subtreeChildren}
        subtreeChildrenQueryStrings={subtreeChildrenQueryStrings}
        {...props} />
    );
  }
}

// |CollapseState| represents whether or not the nodes in the
// test tree UI are closed or open.
const enum CollapseState {
  Closed,
  Open,
}

// Hook which creates a React state for a node. It initializes the default
// based on a node's level, or if the expandAll button has been pressed.
function useCollapseState(level: number, parentLevel: number) {
  // State to track whether or not we responded to the last click to "Expand All".
  const [lastExpandAllSerial, setLastExpandAllSerial] = useState(0);

  const app = useContext(AppContext);
  const expandAllSerial = useContext(ExpandAllContext)
  const [collapseState, setCollapseState] = useState(
    // Expand the shallower parts of the tree at load.
    // Also expand completely within subtrees that are at the same query level
    // (e.g. s:f:t,* and s:f:t,t,*).
    // Also expand if "Expand All" was clicked and we did not respond yet. This
    // may occur if new components are mounted after the button is clicked.
    level <= app.lastQueryLevelToExpand || level === parentLevel || expandAllSerial !== lastExpandAllSerial
      ? CollapseState.Open
      : CollapseState.Closed
  );

  useEffect(() => {
    return app.registerExpandAllAction(serial => {
      setLastExpandAllSerial(serial);
      setCollapseState(CollapseState.Open)
    });
  }, []);

  return [collapseState, setCollapseState] as const;
}

// Helper component which renders a Subtree node or a Case leaf based on
// the type of the node.
const TreeNode: React.VoidFunctionComponent<TreeNodeProps> = ({ n, ...props }) => {
  if ('children' in n) {
    return <Subtree n={n} {...props} />
  } else {
    return <Case n={n} {...props} />
  }
}

// Component which renders the header for a node in the test tree UI.
const TreeNodeHeader: React.FunctionComponent<{
  n: TestTreeNode,
  collapseState: CollapseState,
  setCollapseState: (collapseState: CollapseState) => void,
  loadState: LoadState,
}> = ({ n, ...props }) => {
  const isLeaf = 'run' in n;
  const runtext = isLeaf ? 'Run case' : 'Run subtree';

  const description = 'description' in n && n.description
    ? <pre className="nodedescription">{n.description}</pre>
    : null;

  // Memoize |isLoading|, consumed by |LoadingSpinnerView|.
  const isLoading = useMemo(() => {
    return props.loadState.depsLoading > 0;
  }, [props.loadState]);

  // Memoize |LoadingSpinnerView| to avoid re-renders which
  // result in visual glitches in the spinner animation.
  const LoadingSpinnerView = useMemo(() => {
    return () => isLoading ? <LoadingSpinner /> : null;
  }, [isLoading]);

  const app = useContext(AppContext);
  const queryString = useMemo(() => n.query.toString(), []);
  const href = `?worker=${app.worker ? '1' : '0'}&debug=${app.debug ? '1' : '0'}&q=${queryString}`;
  return (
    <details className="nodeheader" open={props.collapseState === CollapseState.Open} onToggle={(ev) => {
      props.setCollapseState((ev.target as HTMLDetailsElement).open
        ? CollapseState.Open
        : CollapseState.Closed);
    }}>
      <summary>
        <button
          className={isLeaf ? 'leafrun' : 'subtreerun'}
          title={runtext}
          aria-label={runtext}
          onClick={() => app.testRunner.runTests(n.query, app.testResults)}
        />
        <a
          className="nodelink"
          href={href}
          title="Open"
          aria-label="Open"
        />
        {'testCreationStack' in n && n.testCreationStack ? (
          <button
            className="testcaselogbtn"
            aria-label="Log test creation stack to console"
            title="Log test creation stack to console"
            onClick={() => {
              consoleLogError(n.testCreationStack);
            }}
          />
        ) : null}

        <div className="nodetitle">
          <span className="nodecolumns">
            <LoadingSpinnerView />
            <input className="nodequery" type="text" readOnly
              value={queryString} />
            {n.subtreeCounts ? (
              <span title="'(Nodes with TODOs) / (Total test count)'">
                {TestTree.countsToString(n)}
              </span>
            ) : null}
          </span>
          {description ? <>&nbsp;</> : null}
        </div>
        {description}
      </summary>
      {props.children}
    </details>
  )
}

// Hook used to receive TestStatus updates from child nodes and compute an
// aggregate result for the parent node. |onStatusChange| is called upon changes to the
// aggregate result.
// Returns function |setStatus| to set the status for a child node, by queryString.
function useResultAggregator(childrenNames: string[], onStatusChange: ReportStatusFn) {
  const initialState: {
    [k: string]: TestStatus
  } = {};
  childrenNames.forEach(name => {
    initialState[name] = null;
  }, initialState);

  type State = {
    [queryString: string]: TestStatus
  };
  type Action = {
    queryString: string,
    status: TestStatus,
  };
  const [state, setStatus] = useReducer<React.Reducer<State, Action>>((state, action) => {
    if (state[action.queryString] !== action.status) {
      return { ...state, [action.queryString]: action.status };
    }
    return state;
  }, initialState);

  const aggregateStatus = useMemo(() => {
    const statuses = Object.values(state);
    // If any child is running, the parent is running.
    if (statuses.some(s => s === 'running')) {
      return 'running';
    }

    // If any child has no result, the parent has no result
    if (statuses.length === 0 || statuses.some(s => s === null)) {
      return null;
    }

    if (statuses.some(s => s === 'passfail') || (
        statuses.some(s => s === 'fail') &&
        statuses.some(s => s === 'pass'))) {
      return 'passfail';
    }

    if (statuses.some(s => s === 'fail')) {
      return 'fail';
    }

    if (statuses.every(s => s === 'skip')) {
      return 'skip';
    }

    return 'pass';
  }, [state]);

  useEffect(() => onStatusChange(aggregateStatus), [aggregateStatus]);

  return setStatus;
}

// Component to render a Subtree node.
const Subtree: React.VoidFunctionComponent<TreeNodeProps & {
  n: TestSubtree,
}> = withLoadedChildren(function SubtreeContents({
  n,
  reportStatus,
  subtreeChildren,
  subtreeChildrenQueryStrings,
  ...props
}) {
  const app = useContext(AppContext);

  // Create |loadState| to store the LoadState of this node, and |updateLoadState| dispatch
  // function which allows incrementing / decrementing the number of loading dependencies.
  const [loadState, updateLoadState] = useReducer<React.Reducer<LoadState, 'inc' | 'dec'>>(
    ({ mutationId, depsLoading }, action) => {
      switch (action) {
        case 'inc':
          return {
            mutationId: mutationId + 1,
            depsLoading: depsLoading + 1,
          };
        case 'dec':
          return {
            mutationId: mutationId + 1,
            depsLoading: depsLoading - 1,
          };
      }
    }, { mutationId: 0, depsLoading: 0 });

  const addLoadPromise: AddLoadPromiseFn = subtree => {
    // If an ancestor node provided a load promise, also
    // register the loading subtree with the ancestor as well.
    if (props.addLoadPromise) {
      props.addLoadPromise(subtree);
    }

    updateLoadState('inc');
    assert(subtree.loadPromise !== undefined);
    subtree.loadPromise.then(() => {
      updateLoadState('dec');
    });
  }

  useEffect(() => {
    // If the node has not loaded, register the load promise.
    if (!n.loaded()) {
      addLoadPromise(n);
    }
  }, []);

  const [collapseState, setCollapseState] = useCollapseState(n.query.level, props.parentLevel);

  // Create a React state to represent the status of this node.
  const [status, setStatus] = useState<TestStatus>(null);

  // Aggregate child statuses and set |state|. Also report the aggregate
  // state to the parent node.
  const setChildStatus = useResultAggregator(subtreeChildrenQueryStrings, status => {
    setStatus(status);
    reportStatus(status);
  });

  // Memoized rendered children so that updates to this component's state don't
  // cause the children to re-render.
  const renderedSubtreeChildren = useMemo(() => {
    return (
      <div className="subtreechildren">
        {subtreeChildren.map((subtree, i) => {
         const queryString = subtreeChildrenQueryStrings[i];
        return (
          <TreeNode
            key={queryString}
            n={subtree}
            parentLevel={n.query.level}
            addLoadPromise={addLoadPromise}
            reportStatus={status => setChildStatus({ queryString, status })}
          />
        );
      })}
      </div>
    );
  }, [subtreeChildren]);

  const reportSubtreeChildren = useMemo(() => {
    return (
      <>
        {subtreeChildren.map((subtree, i) => {
          const queryString = subtreeChildrenQueryStrings[i];
          return (
            <StatusReport
              key={queryString}
              n={subtree}
              reportStatus={status => setChildStatus({ queryString, status })}
              {...props} />
          )
        })}
      </>
    );
  }, [subtreeChildren]);

  const levelClass = ['', 'multifile', 'multitest', 'multicase'][n.query.level];
  return (
    <div className={`subtree ${levelClass}`} data-status={status}>
      <TreeNodeHeader
        n={n}
        collapseState={collapseState}
        loadState={loadState}
        setCollapseState={setCollapseState}
        {...props}
      />
      {collapseState !== CollapseState.Closed ? renderedSubtreeChildren : reportSubtreeChildren}
    </div>
  )
});

// Component to render a Case leaf node.
const Case: React.VoidFunctionComponent<TreeNodeProps & {
  n: TestTreeLeaf,
}> = ({ n, ...props }) => {
  const app = useContext(AppContext);
  const name = useMemo(() => n.query.toString(), []);
  const res = app.testResults.use(name);
  const [collapseState, setCollapseState] = useCollapseState(n.query.level, props.parentLevel);

  useEffect(() => props.reportStatus(res?.status ?? null), [res]);

  return (
    <div className="testcase" data-status={res?.status}>
      <TreeNodeHeader
        {...props}
        collapseState={collapseState}
        n={n}
        loadState={{ mutationId: 0, depsLoading: 0 }}
        setCollapseState={setCollapseState}>
        <div className="testcasetime">{res?.timems?.toFixed(4)} ms</div>
      </TreeNodeHeader>
      {collapseState === CollapseState.Open ? (
        <div className="testcaselogs">
          {(res?.logs ?? []).map((l, i) =>
            <div key={i} className="testcaselog">
              <button
                className="testcaselogbtn"
                aria-label="Log stack to console"
                title="Log stack to console"
                onClick={() => consoleLogError(l)}
              />
              <pre className="testcaselogtext">{l.toJSON()}</pre>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// React only runs computations for Components that are mounted. |StatusReport|
// and |StatusReportChildren| are Components which we always "render" even when the
// UI state is collapsed, but yield no DOM nodes. Their purpose is to observe the
// leaf test result state and bubble up results to parent nodes.
const StatusReport: React.VoidFunctionComponent<StatusReportProps> = ({ n, reportStatus, ...props }) => {
  if ('children' in n) {
    return <StatusReportChildren n={n} reportStatus={reportStatus} {...props} />;
  } else {
    const app = useContext(AppContext);
    const name = useMemo(() => n.query.toString(), []);
    const res = app.testResults.use(name);
    useEffect(() => reportStatus(res?.status ?? null), [res]);

    // Render nothing.
    return null;
  }
}

// |SubtreeNode| version of |StatusReport|.
const StatusReportChildren: React.VoidFunctionComponent<StatusReportProps & { n: TestSubtree }> =
  withLoadedChildren(function StatusReportChildrenContents({
    n,
    reportStatus,
    subtreeChildren,
    subtreeChildrenQueryStrings,
    ...props
  }) {
    const setChildStatus = useResultAggregator(subtreeChildrenQueryStrings, reportStatus);
    return useMemo(() => (
      <>
        {subtreeChildren.map((subtree, i) => {
          const queryString = subtreeChildrenQueryStrings[i];
          return (
            <StatusReport
              key={queryString}
              n={subtree}
              reportStatus={status => setChildStatus({ queryString, status })}
              {...props} />
          )
        })}
      </>
    ), [subtreeChildren]);
  });

export const TreeRoot: React.VoidFunctionComponent<{
  n: TestSubtree
}> = ({ n }) => (
  <Subtree n={n} parentLevel={1} reportStatus={() => { }} />
);
