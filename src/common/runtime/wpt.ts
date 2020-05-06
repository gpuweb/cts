import { TestLoader } from '../framework/loader.js';
import { LiveTestCaseResult, Logger } from '../framework/logger.js';
import { makeQueryString } from '../framework/url_query.js';
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
  const files = await loader.loadTests(qs[0]);

  const worker = optionEnabled('worker') ? new TestWorker() : undefined;

  const log = new Logger();
  const mutex = new AsyncMutex();
  const running: Array<Promise<void>> = [];

  for (const f of files) {
    if (!('g' in f.spec)) {
      continue;
    }

    const [rec] = log.record(f.id);
    for (const t of f.spec.g.iterate(rec)) {
      const name = makeQueryString(f.id, t.id);

      // Note: apparently, async_tests must ALL be added within the same task.
      async_test(function (this: WptTestObject): Promise<void> {
        const p = mutex.with(async () => {
          let r: LiveTestCaseResult;
          if (worker) {
            r = await worker.run(name);
            t.injectResult(r);
          } else {
            r = await t.run();
          }

          this.step(() => {
            // Unfortunately, it seems not possible to surface any logs for warn/skip.
            if (r.status === 'fail') {
              throw (r.logs || []).map(s => s.toJSON()).join('\n\n');
            }
          });
          this.done();
        });

        running.push(p);
        return p;
      }, name);
    }
  }

  await Promise.all(running);
  const resultsElem = document.getElementById('results') as HTMLElement;
  resultsElem.textContent = log.asJSON(2);
})();
