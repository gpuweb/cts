import { TestLoader } from '../framework/loader.js';
import { Logger } from '../framework/logging/logger.js';
import { stringifyQuery } from '../framework/query/stringifyQuery.js';
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
  const loader = new TestLoader();
  const qs = new URLSearchParams(window.location.search).getAll('q');
  assert(qs.length === 1, 'currently, there must be exactly one ?q=');
  const testcases = await loader.loadTests(qs[0]);

  const worker = optionEnabled('worker') ? new TestWorker() : undefined;

  const log = new Logger(false);
  const mutex = new AsyncMutex();
  const running: Array<Promise<void>> = [];

  for (const testcase of testcases) {
    const name = stringifyQuery(testcase.query);
    const wpt_fn = function (this: WptTestObject): Promise<void> {
      const p = mutex.with(async () => {
        const [rec, res] = log.record(name);
        if (worker) {
          rec.start(false);
          const workerResult = await worker.run(name);
          Object.assign(res, workerResult);
          rec.finish();
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

    // Note: apparently, async_tests must ALL be added within the same task.
    async_test(wpt_fn, name);
  }

  await Promise.all(running);
  const resultsElem = document.getElementById('results') as HTMLElement;
  resultsElem.textContent = log.asJSON(2);
})();
