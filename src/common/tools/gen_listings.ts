import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';

import { crawl } from './crawl.js';

function usage(rc: number): void {
  console.error('Usage:');
  console.error('  tools/gen_listings [OUT_DIR] [SRC_DIR] [SUITES...]');
  console.error('  tools/gen_listings out/ src/ webgpu unittests');
  process.exit(rc);
}

if (process.argv.length <= 4) {
  usage(0);
}

const myself = 'src/common/tools/gen_listings.ts';

const outDir = process.argv[2];
const srcDir = process.argv[3];

(async () => {
  for (const suite of process.argv.slice(4)) {
    const listing = await crawl(path.join(srcDir, suite));

    const outFile = path.normalize(path.join(outDir, `${suite}/listing.js`));
    fs.mkdirSync(path.join(outDir, suite), { recursive: true });
    fs.writeFileSync(
      outFile,
      `\
// AUTO-GENERATED - DO NOT EDIT. See ${myself}.

export const listing = ${JSON.stringify(listing, undefined, 2)};
`
    );
    try {
      fs.unlinkSync(outFile + '.map');
      /* eslint-disable-next-line no-empty */
    } catch (ex) {}
  }
})();
