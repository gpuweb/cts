/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/import { promises as fs } from 'fs';import * as path from 'path';
import { DefaultTestFileLoader } from '../internal/file_loader.js';
import {
  TestQueryMultiCase,
  TestQueryMultiFile,
  TestQueryMultiTest } from
'../internal/query/query.js';
import { assert } from '../util/util.js';

function printUsageAndExit(rc) {
  console.error(`\
Usage (simple, for webgpu:* suite only):
  tools/gen_wpt_cts_html OUTPUT_FILE TEMPLATE_FILE
  tools/gen_wpt_cts_html out-wpt/cts.https.html templates/cts.https.html

Usage (config file):
  tools/gen_wpt_cts_html CONFIG_JSON_FILE

where CONFIG_JSON_FILE is a JSON file in the format documented in the code of
gen_wpt_cts_html.ts. Example:
  {
    "suite": "webgpu",
    "out": "path/to/output/cts.https.html",
    "outJSON": "path/to/output/webgpu_variant_list.json",
    "template": "path/to/template/cts.https.html",
    "maxChunkTimeMS": 2000
  }

Usage (advanced) (deprecated, use config file):
  tools/gen_wpt_cts_html OUTPUT_FILE TEMPLATE_FILE ARGUMENTS_PREFIXES_FILE EXPECTATIONS_FILE EXPECTATIONS_PREFIX [SUITE]
  tools/gen_wpt_cts_html my/path/to/cts.https.html templates/cts.https.html arguments.txt myexpectations.txt 'path/to/cts.https.html' cts

where arguments.txt is a file containing a list of arguments prefixes to both generate and expect
in the expectations. The entire variant list generation runs *once per prefix*, so this
multiplies the size of the variant list.

  ?debug=0&q=
  ?debug=1&q=

and myexpectations.txt is a file containing a list of WPT paths to suppress, e.g.:

  path/to/cts.https.html?debug=0&q=webgpu:a/foo:bar={"x":1}
  path/to/cts.https.html?debug=1&q=webgpu:a/foo:bar={"x":1}

  path/to/cts.https.html?debug=1&q=webgpu:a/foo:bar={"x":3}
`);
  process.exit(rc);
}





















































let config;

(async () => {
  // Load the config
  switch (process.argv.length) {
    case 3:{
        const configFile = process.argv[2];
        const configJSON = JSON.parse(await fs.readFile(configFile, 'utf8'));
        const jsonFileDir = path.dirname(configFile);

        config = {
          suite: configJSON.suite,
          out: path.resolve(jsonFileDir, configJSON.out),
          template: path.resolve(jsonFileDir, configJSON.template),
          maxChunkTimeMS: configJSON.maxChunkTimeMS ?? Infinity,
          argumentsPrefixes: configJSON.argumentsPrefixes ?? ['?q='],
          noLongPathAssert: configJSON.noLongPathAssert ?? false
        };
        if (configJSON.outVariantList) {
          config.outVariantList = path.resolve(jsonFileDir, configJSON.outVariantList);
        }
        if (configJSON.expectations) {
          config.expectations = {
            file: path.resolve(jsonFileDir, configJSON.expectations.file),
            prefix: configJSON.expectations.prefix
          };
        }
        if (configJSON.fullyExpandSubtrees) {
          config.fullyExpandSubtrees = {
            file: path.resolve(jsonFileDir, configJSON.fullyExpandSubtrees.file),
            prefix: configJSON.fullyExpandSubtrees.prefix
          };
        }
        break;
      }
    case 4:
    case 7:
    case 8:{
        const [
        _nodeBinary,
        _thisScript,
        outFile,
        templateFile,
        argsPrefixesFile,
        expectationsFile,
        expectationsPrefix,
        suite = 'webgpu'] =
        process.argv;

        config = {
          out: outFile,
          template: templateFile,
          suite,
          maxChunkTimeMS: Infinity,
          argumentsPrefixes: ['?q='],
          noLongPathAssert: false
        };
        if (process.argv.length >= 7) {
          config.argumentsPrefixes = (await fs.readFile(argsPrefixesFile, 'utf8')).
          split(/\r?\n/).
          filter((a) => a.length);
          config.expectations = {
            file: expectationsFile,
            prefix: expectationsPrefix
          };
        }
        break;
      }
    default:
      console.error('incorrect number of arguments!');
      printUsageAndExit(1);
  }

  const useChunking = Number.isFinite(config.maxChunkTimeMS);

  // Sort prefixes from longest to shortest
  config.argumentsPrefixes.sort((a, b) => b.length - a.length);

  // Load expectations (if any)
  const expectations = await loadQueryFile(
    config.argumentsPrefixes,
    config.expectations
  );

  // Load fullyExpandSubtrees queries (if any)
  const fullyExpand = await loadQueryFile(
    config.argumentsPrefixes,
    config.fullyExpandSubtrees
  );

  const loader = new DefaultTestFileLoader();
  const lines = [];
  for (const prefix of config.argumentsPrefixes) {
    const rootQuery = new TestQueryMultiFile(config.suite, []);
    const tree = await loader.loadTree(rootQuery, {
      subqueriesToExpand: expectations.get(prefix),
      fullyExpandSubtrees: fullyExpand.get(prefix),
      maxChunkTime: config.maxChunkTimeMS
    });

    lines.push(undefined); // output blank line between prefixes
    const prefixComment = { comment: `Prefix: "${prefix}"` }; // contents will be updated later
    if (useChunking) lines.push(prefixComment);

    const filesSeen = new Set();
    const testsSeen = new Set();
    let variantCount = 0;

    const alwaysExpandThroughLevel = 2; // expand to, at minimum, every test.
    for (const { query, subtreeCounts } of tree.iterateCollapsedNodes({
      alwaysExpandThroughLevel
    })) {
      assert(query instanceof TestQueryMultiCase);
      if (!config.noLongPathAssert) {
        const queryString = query.toString();
        // Check for a safe-ish path length limit. Filename must be <= 255, and on Windows the whole
        // path must be <= 259. Leave room for e.g.:
        // 'c:\b\s\w\xxxxxxxx\layout-test-results\external\wpt\webgpu\cts_worker=0_q=...-actual.txt'
        assert(
          queryString.length < 185,
          `Generated test variant would produce too-long -actual.txt filename. Possible solutions:
- Reduce the length of the parts of the test query
- Reduce the parameterization of the test
- Make the test function faster and regenerate the listing_meta entry
- Reduce the specificity of test expectations (if you're using them)
${queryString}`
        );
      }

      lines.push({
        urlQueryString: prefix + query.toString(), // "?debug=0&q=..."
        comment: useChunking ? `estimated: ${subtreeCounts?.totalTimeMS.toFixed(3)} ms` : undefined
      });

      variantCount++;
      filesSeen.add(new TestQueryMultiTest(query.suite, query.filePathParts, []).toString());
      testsSeen.add(
        new TestQueryMultiCase(query.suite, query.filePathParts, query.testPathParts, {}).toString()
      );
    }
    prefixComment.comment += `; ${variantCount} variants generated from ${testsSeen.size} tests in ${filesSeen.size} files`;
  }
  await generateFile(lines);
})().catch((ex) => {
  console.log(ex.stack ?? ex.toString());
  process.exit(1);
});

async function loadQueryFile(
argumentsPrefixes,
queryFile)



{
  let lines = new Set();
  if (queryFile) {
    lines = new Set(
      (await fs.readFile(queryFile.file, 'utf8')).split(/\r?\n/).filter((l) => l.length)
    );
  }

  const result = new Map();
  for (const prefix of argumentsPrefixes) {
    result.set(prefix, []);
  }

  expLoop: for (const exp of lines) {
    // Take each expectation for the longest prefix it matches.
    for (const argsPrefix of argumentsPrefixes) {
      const prefix = queryFile.prefix + argsPrefix;
      if (exp.startsWith(prefix)) {
        result.get(argsPrefix).push(exp.substring(prefix.length));
        continue expLoop;
      }
    }
    console.log('note: ignored expectation: ' + exp);
  }
  return result;
}

async function generateFile(
lines)
{
  let result = '';
  result += '<!-- AUTO-GENERATED - DO NOT EDIT. See WebGPU CTS: tools/gen_wpt_cts_html. -->\n';

  result += await fs.readFile(config.template, 'utf8');

  const variantList = [];
  for (const line of lines) {
    if (line !== undefined) {
      if (line.urlQueryString) {
        result += `<meta name=variant content='${line.urlQueryString}'>`;
        variantList.push(line.urlQueryString);
      }
      if (line.comment) result += `<!-- ${line.comment} -->`;
    }
    result += '\n';
  }

  await fs.writeFile(config.out, result);
  if (config.outVariantList) {
    await fs.writeFile(config.outVariantList, JSON.stringify(variantList, undefined, 2));
  }
}
//# sourceMappingURL=gen_wpt_cts_html.js.map