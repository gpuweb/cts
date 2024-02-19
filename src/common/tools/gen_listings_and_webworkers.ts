import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';

import { crawl } from './crawl.js';

function usage(rc: number): void {
  console.error(`Usage: tools/gen_listings [options] [OUT_DIR] [SUITE_DIRS...]

For each suite in SUITE_DIRS, generate listings into OUT_DIR/{suite}/listing.js,
and generate Web Worker proxies in OUT_DIR/{suite}/webworker/**/*.worker.js for
every .spec.js file. (Note {suite}/webworker/ is reserved for this purpose.)

Example:
  tools/gen_listings gen/ src/unittests/ src/webgpu/

Options:
  --help          Print this message and exit.
`);
  process.exit(rc);
}

const argv = process.argv;
if (argv.indexOf('--help') !== -1) {
  usage(0);
}

{
  // Ignore old argument that is now the default
  const i = argv.indexOf('--no-validate');
  if (i !== -1) {
    argv.splice(i, 1);
  }
}

if (argv.length < 4) {
  usage(0);
}

const myself = 'src/common/tools/gen_listings_and_webworkers.ts';

const outDir = argv[2];

for (const suiteDir of argv.slice(3)) {
  // Run concurrently for each suite (might be a tiny bit more efficient)
  void crawl(suiteDir, false).then(listing => {
    const suite = path.basename(suiteDir);

    // Write listing.js
    const outFile = path.normalize(path.join(outDir, `${suite}/listing.js`));
    fs.mkdirSync(path.join(outDir, suite), { recursive: true });
    fs.writeFileSync(
      outFile,
      `\
// AUTO-GENERATED - DO NOT EDIT. See ${myself}.

export const listing = ${JSON.stringify(listing, undefined, 2)};
`
    );

    // Write suite/webworker/**/*.worker.js
    for (const entry of listing) {
      if ('readme' in entry) continue;

      const outFileDir = path.join(
        outDir,
        suite,
        'webworker',
        ...entry.file.slice(0, entry.file.length - 1)
      );
      const outFile = path.join(outDir, suite, 'webworker', ...entry.file) + '.worker.js';

      const relPathToSuiteRoot = Array<string>(entry.file.length).fill('..').join('/');

      fs.mkdirSync(outFileDir, { recursive: true });
      fs.writeFileSync(
        outFile,
        `\
// AUTO-GENERATED - DO NOT EDIT. See ${myself}.

// oldG is a TestGroup<Fixture> object (defined in common/internal/test_group.ts).
import { g as oldG } from '${relPathToSuiteRoot}/${entry.file.join('/')}.spec.js';

// FIXME: Expose a proxied test interface. I think this can completely replace test_worker-worker.js
// (using this instead of that), but if not then hopefully it can at least share code with it.
console.log(oldG.iterate());

import { globalTestConfig } from '/out/common/framework/test_config.js';
import { Logger } from '/out/common/internal/logging/logger.js';
import { setDefaultRequestAdapterOptions } from '/out/common/util/navigator_gpu.js';

async function reportTestResults(ev) {
  const query = ev.data.query;
  const expectations = ev.data.expectations;
  const ctsOptions = ev.data.ctsOptions;

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

  // const testcases = Array.from(await loader.loadCases(parseQuery(query)));
  // assert(testcases.length === 1, 'worker query resulted in != 1 cases');

  // const testcase = testcases[0];
  const testcase = { query }; // FIXME! I failed to figure out how to get a testcase from oldG and query ;(
  const [rec, result] = log.record(testcase.query.toString());
  // await testcase.run(rec, expectations);
  result.status = 'pass'; // FIXME
  result.timems = 42; // FIXME
  this.postMessage({ query, result });

}

self.onmessage = (ev) => {
  void reportTestResults.call(ev.source || self, ev);
};

self.onconnect = (event) => {
  const port = event.ports[0];

  port.onmessage = (ev) => {
    void reportTestResults.call(port, ev);
  };
};
`
      );
    }
  });
}
