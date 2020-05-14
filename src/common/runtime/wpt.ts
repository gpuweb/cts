import { DefaultTestFileLoader } from '../framework/file_loader.js';
import { Logger } from '../framework/logging/logger.js';
import { FilterResultTreeLeaf } from '../framework/tree.js';
import { AsyncMutex } from '../framework/util/async_mutex.js';
import { assert } from '../framework/util/util.js';

import { optionEnabled } from './helper/options.js';
import { TestWorker } from './helper/test_worker.js';

declare interface WptTestObject {
  step(f: () => void): void;
  done(): void;
}
// Implements the wpt-embedded test runner (see also: wpt/cts.html).

declare function async_test(f: (this: WptTestObject) => Promise<void>, name: string): void;

(async () => {
  const loader = new DefaultTestFileLoader();
  const qs = new URLSearchParams(window.location.search).getAll('q');
  assert(qs.length === 1, 'currently, there must be exactly one ?q=');
  const testcases = await loader.loadTests(qs[0]);

  const log = await addWPTTests(testcases);

  const resultsElem = document.getElementById('results') as HTMLElement;
  resultsElem.textContent = log.asJSON(2);
})();

// Note: async_tests must ALL be added within the same task. This function *must not* be async.
function addWPTTests(testcases: IterableIterator<FilterResultTreeLeaf>): Promise<Logger> {
  const worker = optionEnabled('worker') ? new TestWorker() : undefined;

  const log = new Logger(false);
  const mutex = new AsyncMutex();
  const running: Array<Promise<void>> = [];

  for (const testcase of testcases) {
    const name = testcase.query.toString();
    const wpt_fn = function (this: WptTestObject): Promise<void> {
      const p = mutex.with(async () => {
        const [rec, res] = log.record(name);
        if (worker) {
          rec.start();
          const workerResult = await worker.run(name);
          rec.finish();
          Object.assign(res, workerResult);
        } else {
          await testcase.run(rec);
        }

        this.step(() => {
          // Unfortunately, it seems not possible to surface any logs for warn/skip.
          if (res.status === 'fail') {
            throw (res.logs || []).map(s => s.toJSON()).join('\n\n');
          }
        });
        this.done();
      });

      running.push(p);
      return p;
    };

    async_test(wpt_fn, name);
  }

  return Promise.all(running).then(() => log);
}
