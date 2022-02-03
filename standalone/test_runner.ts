import { DefaultTestFileLoader } from '@src/common/internal/file_loader.js';
import { Logger } from '@src/common/internal/logging/logger.js';
import { compareQueries, Ordering } from '@src/common/internal/query/compare.js';
import { TestQuery } from '@src/common/internal/query/query.js';
import { TestWorker } from '@src/common/runtime/helper/test_worker.js';
import { TestResults } from './test_results.js';

const loader = new DefaultTestFileLoader();

export class TestRunner {
  constructor(
    private logger: Logger,
    private rootQuery: TestQuery,
    private worker?: TestWorker) {
  }

  public async runTests(query: TestQuery, testResults: TestResults) {
    switch (compareQueries(query, this.rootQuery)) {
      case Ordering.Equal:
      case Ordering.StrictSubset:
        break;
      case Ordering.StrictSuperset:
        // |query| was larger than the root. Use the
        // root instead so only tests that are filtered by
        // the root query are run.
        query = this.rootQuery;
        break;
      case Ordering.Unordered:
        throw new Error('Query is unordered with respect to the root query.');
    }

    for (const testcase of await loader.loadCases(query)) {
      const atLeastOneMs = new Promise(resolve => setTimeout(resolve, 1));

      const name = testcase.query.toString();
      const [rec, res] = this.logger.record(name);
      testResults.beginTestcase(name, res);
      if (this.worker) {
        await this.worker.run(rec, name);
      } else {
        await testcase.run(rec);
      }
      testResults.publishTestcaseResult(name);

      // Give the UI a chance to update if results are coming back very quickly.
      await atLeastOneMs;
    }
  }
};
