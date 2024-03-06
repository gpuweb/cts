import { Fixture } from '../../framework/fixture';
import { globalTestConfig } from '../../framework/test_config.js';
import { Logger } from '../../internal/logging/logger.js';
import { comparePaths, comparePublicParamsPaths, Ordering } from '../../internal/query/compare.js';
import { parseQuery } from '../../internal/query/parseQuery.js';
import { TestQuerySingleCase, TestQueryWithExpectation } from '../../internal/query/query.js';
import { TestGroup } from '../../internal/test_group.js';
import { setDefaultRequestAdapterOptions } from '../../util/navigator_gpu.js';
import { assert } from '../../util/util.js';

import { CTSOptions } from './options.js';

export function wrapTestGroupForWorker(g: TestGroup<Fixture>) {
  self.onmessage = async (ev: MessageEvent) => {
    const query: string = ev.data.query;
    const expectations: TestQueryWithExpectation[] = ev.data.expectations;
    const ctsOptions: CTSOptions = ev.data.ctsOptions;

    const { debug, unrollConstEvalLoops, powerPreference, compatibility } = ctsOptions;
    globalTestConfig.unrollConstEvalLoops = unrollConstEvalLoops;
    globalTestConfig.compatibility = compatibility;

    Logger.globalDebugMode = debug;
    const log = new Logger();

    if (powerPreference || compatibility) {
      setDefaultRequestAdapterOptions({
        ...(powerPreference && { powerPreference }),
        // MAINTENANCE_TODO: Change this to whatever the option ends up being
        ...(compatibility && { compatibilityMode: true }),
      });
    }

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
