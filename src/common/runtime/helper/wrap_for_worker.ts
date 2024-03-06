import { Fixture } from '../../framework/fixture';
import { comparePaths, comparePublicParamsPaths, Ordering } from '../../internal/query/compare.js';
import { parseQuery } from '../../internal/query/parseQuery.js';
import { TestQuerySingleCase, TestQueryWithExpectation } from '../../internal/query/query.js';
import { TestGroup } from '../../internal/test_group.js';
import { assert } from '../../util/util.js';

import { CTSOptions } from './options.js';
import { setupWorkerEnvironment } from './utils_worker.js';

export function wrapTestGroupForWorker(g: TestGroup<Fixture>) {
  self.onmessage = async (ev: MessageEvent) => {
    const query: string = ev.data.query;
    const expectations: TestQueryWithExpectation[] = ev.data.expectations;
    const ctsOptions: CTSOptions = ev.data.ctsOptions;

    const log = setupWorkerEnvironment(ctsOptions);

    const testQuery = parseQuery(query);
    assert(testQuery instanceof TestQuerySingleCase);
    let testcase = null;
    for (const t of g.iterate()) {
      if (comparePaths(t.testPath, testQuery.testPathParts) !== Ordering.Equal) {
        continue;
      }
      for (const c of t.iterate(testQuery.params)) {
        if (comparePublicParamsPaths(c.id.params, testQuery.params) === Ordering.Equal) {
          testcase = c;
        }
      }
    }
    assert(!!testcase);
    const [rec, result] = log.record(query);
    await testcase.run(rec, testQuery, expectations);
    ev.source?.postMessage({ query, result });
  };
}
