import { promises as fs, existsSync } from 'fs';
import * as path from 'path';

import { DefaultTestFileLoader } from '../internal/file_loader.js';
import { TestQueryMultiCase, TestQueryMultiFile } from '../internal/query/query.js';
import { assert } from '../util/util.js';

function printUsageAndExit(rc: number): void {
  console.error(`\
Usage:
  tools/gen_wpt_cts_html TEMPLATE_FILE [SUITE]
  tools/gen_wpt_cts_html src/common/templates/single_test.https.html
  tools/gen_wpt_cts_html src/common/templates/single_test.https.html unittests

  Outputs to out-wpt/multi/SUITE/**.https.html, specifically:
    out-wpt/multi/SUITE/FILE/FILE.spec/TEST/TEST.https.html
  e.g.:
    out-wpt/multi/webgpu/api/validation/compute_pipeline.spec/shader_module/invalid.https.html
`);
  process.exit(rc);
}

if (process.argv.length !== 3 && process.argv.length !== 4) {
  printUsageAndExit(0);
}

const [, , templateFile, suite = 'webgpu'] = process.argv;

(async () => {
  let template = '';
  template += '<!-- AUTO-GENERATED - DO NOT EDIT. See WebGPU CTS: tools/gen_wpt_multi_file. -->\n';
  template += await fs.readFile(templateFile, 'utf8');

  const outWpt = 'out-wpt';
  {
    const outDir = path.join(outWpt, 'multi', suite);
    if (existsSync(outDir)) {
      await fs.rm(outDir, { recursive: true });
    }
    await fs.mkdir(outDir, { recursive: true });
  }

  const tree = await new DefaultTestFileLoader().loadTree(new TestQueryMultiFile(suite, []));
  const alwaysExpandThroughLevel = 2; // expand to, at minimum, every test.
  for (const { query } of tree.iterateCollapsedNodes({ alwaysExpandThroughLevel })) {
    assert(
      query instanceof TestQueryMultiCase,
      'internal error: all queries must be MultiCase queries'
    );
    assert(query.depthInLevel === 0, 'internal error: all queries must be whole tests');

    const kSafeChars = /[a-zA-Z0-9_-]+/;
    for (const part of [...query.filePathParts, ...query.testPathParts]) {
      assert(kSafeChars.test(part));
    }

    const subdirectory = path.join(...query.filePathParts) + '.spec';
    const filePathRelative =
      path.join('multi', suite, subdirectory, ...query.testPathParts) + '.https.html';
    assert(filePathRelative.length < 185, 'Generated filename would be too long.');

    const queryString = query.toString();
    assert(!/[`\\]/.test(queryString), 'query must not contain ` or \\');

    let result = template;
    result = result.replace(/{{test_query}}/g, queryString);
    result = result.replace(/{{file_path}}/g, filePathRelative);

    const filePath = path.join(outWpt, filePathRelative);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, result);
  }
})().catch(ex => {
  console.log(ex.stack ?? ex.toString());
  process.exit(1);
});
