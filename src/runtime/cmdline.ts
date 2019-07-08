// tslint:disable: no-console

import * as fs from 'fs';
import * as process from 'process';

import { TestLoader } from '../framework/loader.js';
import { Logger, LiveTestCaseResult } from '../framework/logger.js';
import { TestSpecID } from '../framework/id.js';
import { makeQueryString } from '../framework/url_query.js';

function usage(rc: number) {
  console.log('Usage:');
  console.log('  tools/run [QUERIES...]');
  console.log('  tools/run unittests: cts:buffers/');
  process.exit(rc);
}

if (process.argv.length <= 2) {
  usage(0);
}

if (!fs.existsSync('src/runtime/cmdline.ts')) {
  console.log('Must be run from repository root');
  usage(1);
}

let verbose = false;
const filterArgs = [];
for (const a of process.argv.slice(2)) {
  if (a.startsWith('-')) {
    if (a === '--verbose' || a === '-v') {
      verbose = true;
    } else {
      usage(1);
    }
  } else {
    filterArgs.push(a);
  }
}

(async () => {
  try {
    const loader = new TestLoader();
    const files = await loader.loadTestsFromCmdLine(filterArgs);

    const log = new Logger();

    const failed: Array<[TestSpecID, LiveTestCaseResult]> = [];
    const warned: Array<[TestSpecID, LiveTestCaseResult]> = [];

    // TODO: don't run all tests all at once
    const running = [];
    for (const f of files) {
      if (!('g' in f.spec)) {
        continue;
      }

      const [rec] = log.record(f.id);
      for (const t of f.spec.g.iterate(rec)) {
        running.push(
          (async () => {
            const res = await t.run();
            if (res.status === 'fail') {
              failed.push([f.id, res]);
            }
            if (res.status === 'warn') {
              warned.push([f.id, res]);
            }
          })()
        );
      }
    }

    if (running.length === 0) {
      throw new Error('found no tests!');
    }

    await Promise.all(running);

    // TODO: write results out somewhere (a file?)
    if (verbose) {
      console.log(log.asJSON(2));
    }

    if (warned.length) {
      console.log('');
      console.log('** Warnings **');
      for (const [id, r] of warned) {
        console.log(makeQueryString(id), r);
      }
    }
    if (failed.length) {
      console.log('');
      console.log('** Failures **');
      for (const [id, r] of failed) {
        console.log(makeQueryString(id), r);
      }
    }

    const total = running.length;
    const passed = total - warned.length - failed.length;
    function pct(x: number) {
      return ((100 * x) / total).toFixed(2);
    }
    function rpt(x: number) {
      const xs = x.toString().padStart(1 + Math.log10(total), ' ');
      return `${xs} / ${total} = ${pct(x).padStart(6, ' ')}%`;
    }
    console.log('');
    console.log(`** Summary **
Passed  w/o warnings = ${rpt(passed)}
Passed with warnings = ${rpt(warned.length)}
Failed               = ${rpt(failed.length)}`);

    if (failed.length || warned.length) {
      process.exit(1);
    }
  } catch (ex) {
    console.log(ex);
    process.exit(1);
  }
})();
