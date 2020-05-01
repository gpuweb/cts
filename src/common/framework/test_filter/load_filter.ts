import { TestFileLoader, TestSpec } from '../loader.js';
import { parseQuery } from '../query/parseQuery.js';
import { TestQuery } from '../query/query.js';
import { assert } from '../util/util.js';

import { TestFilter } from './internal.js';
import { SimpleFilterGroup, SimpleFilterCase } from './simple_filter.js';
import { TestFilterResult } from './test_filter_result.js';
import { TestCaseID } from '../id.js';
import { RunCaseIterable, RunCase } from '../test_group.js';
import { TestSpecRecorder } from '../logger.js';
import { ParamSpec } from '../params_utils.js';

// Each filter is of one of the forms below (urlencoded).
export function makeFilter(filter: string): TestFilter {
  const i1 = filter.indexOf(':');
  assert(i1 !== -1, 'Test queries must fully specify their suite name (e.g. "webgpu:")');

  const suite = filter.substring(0, i1);

  const i2 = filter.indexOf(':', i1 + 1);
  if (i2 === -1) {
    const group = filter.substring(i1 + 1);
    return new SimpleFilterGroup(suite, group);
  }
  const group = filter.substring(i1 + 1, i2);

  const testcase = filter.substring(i2 + 1);
  return new SimpleFilterCase(suite, group, testcase);
}

export function loadFilter(
  loader: TestFileLoader,
  queryString: string
): Promise<TestFilterResult[]> {
  const query = parseQuery(queryString);
  const filter = new RealSimpleFilter(query);
  return filter.iterate(loader);
}

enum Ordering {
  Unordered,
  Superset,
  Equal,
  Subset,
}

function comparePaths(a: string[], b: string[]): Ordering {
  const shorter = Math.min(a.length, b.length);

  for (let i = 0; i < shorter; ++i) {
    if (a[i] !== b[i]) {
      return Ordering.Unordered;
    }
  }
  if (a.length === b.length) {
    return Ordering.Equal;
  } else if (a.length < b.length) {
    return Ordering.Superset;
  } else {
    return Ordering.Subset;
  }
}

class RealSimpleFilter {
  private query: TestQuery;

  constructor(query: TestQuery) {
    this.query = query;
  }

  async iterate(loader: TestFileLoader): Promise<TestFilterResult[]> {
    const specs = await loader.listing(this.query.suite);

    const results: TestFilterResult[] = [];
    for (const entry of specs) {
      const path = entry.path;

      const ordering = comparePaths(path, this.query.group);
      if (ordering === Ordering.Unordered) {
        // Path is not matched by this filter.
        continue;
      }

      // XXXXX: this should be done instead by inserting items for parents when we see children.
      const id = { suite: this.query.suite, group: path };
      if (ordering === Ordering.Superset) {
        // Path is a parent readme of this filter; include it for completeness.
        assert('readme' in entry, 'query seems to be for a path that does not exist');
        results.push({ id, spec: { description: entry.readme } });
        continue;
      }

      // comparison is now Equal or Subset, and path is a spec.
      const spec = await loader.importSpecFile(this.query.suite, path);

      if (this.query.test === undefined) {
        assert(this.query.endsWithWildcard, 'group-level query must have wildcard');
        // Whole spec matches the query.
        results.push({ id, spec });
        continue;
      }

      assert(ordering === Ordering.Equal, 'group part of test-level query does not exist');

      const queryTest = this.query.test;
      // Return a subset of a group.
      const g = filterTestGroup(spec.g, id =>
        testCaseIDMatchesQuery(queryTest, this.query.params, this.query.endsWithWildcard, id)
      );
      results.push({ id, spec: { description: spec.description, g } });
    }
    return results;
  }
}

// XXXXX: this needs to build up a test tree because the incoming TestCaseIDs are all
// fully-qualified case identifiers.
function testCaseIDMatchesQuery(
  queryTest: string[],
  queryParams: ParamSpec | undefined,
  queryEndsWithWildcard: boolean,
  { test, params }: TestCaseID
): boolean {
  const ordering = comparePaths(test, queryTest);

  if (ordering === Ordering.Unordered) {
    // Path is not matched by this filter.
    return false;
  }
  if (ordering === Ordering.Superset) {
    // Path is a parent of this query; include it for completeness
    return true;
  }

  // ordering is now Equal or Subset.

  if (ordering === Ordering.Equal) {
    assert(queryEndsWithWildcard);
  }

  // XXXXX: finish implementing
  //return this.testcasePattern.matches(test + ':' + stringifyPublicParams(params));
  throw 0;
}

type TestGroupPredicate = (testcase: TestCaseID) => boolean;
function filterTestGroup(group: RunCaseIterable, pred: TestGroupPredicate): RunCaseIterable {
  return {
    *iterate(log: TestSpecRecorder): Iterable<RunCase> {
      for (const rc of group.iterate(log)) {
        if (pred(rc.id)) {
          yield rc;
        }
      }
    },
  };
}
