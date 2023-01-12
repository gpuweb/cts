/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/import * as fs from 'fs';import * as path from 'path';
import { chromium, firefox, webkit } from 'playwright-core';
import { PNG } from 'pngjs';




const verbose = false;
const kRefTestsBaseURL = 'http://localhost:8080/out/webgpu/web_platform/reftests';
const kRefTestsPath = 'src/webgpu/web_platform/reftests';
const kScreenshotPath = 'out-wpt-reftest-screenshots';

// note: technically we should use an HTML parser to find this to deal with whitespace
// attribute order, quotes, entities, etc but since we control the test source we can just
// make sure they match
const kRefLinkRE = /<link\s+rel="match"\s+href="(.*?)"/;
const kRefWaitClassRE = /class="reftest-wait"/;
const kFuzzy = /<meta\s+name="?fuzzy"?\s+content="(.*?)">/;

function printUsage() {
  console.log(`
run_wpt_ref_tests path-to-browser-executable [ref-test-name]

where ref-test-name is just a simple check for the test including the given string.
If not passed all ref tests are run

MacOS Chrome Example:
  node tools/run_wpt_ref_tests /Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary

`);
}

// Get all of filenames that end with '.html'
function getRefTestNames(refTestPath) {
  return fs.readdirSync(refTestPath).filter((name) => name.endsWith('.html'));
}

// Given a regex with one capture, return it or the empty string if no match.
function getRegexMatchCapture(re, content) {
  const m = re.exec(content);
  return m ? m[1] : '';
}








function readHTMLFile(filename) {
  const content = fs.readFileSync(filename, { encoding: 'utf8' });
  return {
    content,
    refLink: getRegexMatchCapture(kRefLinkRE, content),
    refWait: kRefWaitClassRE.test(content),
    fuzzy: getRegexMatchCapture(kFuzzy, content)
  };
}

// Note: If possible, rather then start adding command line options to this tool,
// see if you can just make it work based off the path.
function getBrowserInterface(executablePath) {
  const lc = executablePath.toLowerCase();
  if (lc.includes('chrom')) {
    return chromium.launch({
      executablePath,
      headless: false,
      args: ['--enable-unsafe-webgpu']
    });
  } else if (lc.includes('firefox')) {
    return firefox.launch({
      executablePath,
      headless: false
    });
  } else if (lc.includes('safari') || lc.includes('webkit')) {
    return webkit.launch({
      executablePath,
      headless: false
    });
  } else {
    throw new Error(`could not guess browser from executable path: ${executablePath}`);
  }
}

function readPng(filename) {
  const data = fs.readFileSync(filename);
  return PNG.sync.read(data);
}

function writePng(filename, width, height, data) {
  const png = new PNG({ colorType: 6, width, height });
  for (let i = 0; i < data.byteLength; ++i) {
    png.data[i] = data[i];
  }
  const buffer = PNG.sync.write(png);
  fs.writeFileSync(filename, buffer);
}

// Parses a fuzzy spec as defined here
// https://web-platform-tests.org/writing-tests/reftests.html#fuzzy-matching
// Note: This is not robust but the tests will eventually be run in the real wpt.
function parseFuzzy(fuzzy) {
  if (!fuzzy) {
    return { maxDifference: [0, 0], totalPixels: [0, 0] };
  } else {
    const parts = fuzzy.split(';');
    if (parts.length !== 2) {
      throw Error(`unhandled fuzzy format: ${fuzzy}`);
    }
    const ranges = parts.map((part) => {
      const range = part.
      replace(/[a-zA-Z=]/g, '').
      split('-').
      map((v) => parseInt(v));
      return range.length === 1 ? [0, range[0]] : range;
    });
    return {
      maxDifference: ranges[0],
      totalPixels: ranges[1]
    };
  }
}

// Compares two images using the algorithm described in the web platform tests
// https://web-platform-tests.org/writing-tests/reftests.html#fuzzy-matching
// If they are different will write out a diff mask.
async function compareImages(
filename1,
filename2,
fuzzy,
diffName)
{
  const img1 = readPng(filename1);
  const img2 = readPng(filename2);
  const { width, height } = img1;
  if (img2.width !== width || img2.height !== height) {
    console.error('images are not the same size:', filename1, filename2);
    return;
  }

  const { maxDifference, totalPixels } = parseFuzzy(fuzzy);

  const diffData = Buffer.alloc(width * height * 4);
  const diffPixels = new Uint32Array(diffData.buffer);
  const kRed = 0xff0000ff;
  const kWhite = 0xffffffff;

  let numDifferent = 0;
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      const offset = y * width + x;
      let bad = false;
      for (let c = 0; c < 4 && !bad; ++c) {
        const off = offset * 4 + c;
        const v0 = img1.data[off];
        const v1 = img2.data[off];
        const diff = Math.abs(v0 - v1);
        const inRange = diff >= maxDifference[0] && diff <= maxDifference[1];
        bad = diff > 0 && !inRange;
      }
      numDifferent += bad ? 1 : 0;
      diffPixels[offset] = bad ? kRed : kWhite;
    }
  }

  const same = numDifferent >= totalPixels[0] && numDifferent <= totalPixels[1];
  if (!same) {
    writePng(diffName, width, height, diffData);
    console.error(
    `FAIL: too many differences in: ${filename1} vs ${filename2}
       ${numDifferent} differences, expected: ${totalPixels[0]}-${totalPixels[1]} with range: ${maxDifference[0]}-${maxDifference[1]}
       wrote difference to: ${diffName};
      `);

  } else {
    console.log(`PASS`);
  }
  return same;
}

function exists(filename) {
  try {
    fs.accessSync(filename);
    return true;
  } catch (e) {
    return false;
  }
}

async function runPageAndTakeScreenshot(
page,
url,
refWait,
screenshotName)
{
  console.log('  loading:', url);
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
  if (refWait) {
    await page.waitForFunction(() => wptRefTestPageReady());
    const timeout = await page.evaluate(() => wptRefTestGetTimeout());
    if (timeout) {
      return true;
    }
  }
  await page.screenshot({ path: screenshotName });
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1 || args.length > 2) {
    printUsage();
    return;
  }

  const [executablePath, refTestName] = args;

  if (!exists(executablePath)) {
    console.error(executablePath, 'does not exist');
    return;
  }

  const testNames = getRefTestNames(kRefTestsPath).filter((name) =>
  refTestName ? name.includes(refTestName) : true);


  if (!exists(kScreenshotPath)) {
    fs.mkdirSync(kScreenshotPath, { recursive: true });
  }

  if (testNames.length === 0) {
    console.error(`no tests include "${refTestName}"`);
    return;
  }

  const browser = await getBrowserInterface(executablePath);
  const context = await browser.newContext();
  const page = await context.newPage();

  if (verbose) {
    page.on('console', async (msg) => {
      const { url, lineNumber, columnNumber } = msg.location();
      const values = await Promise.all(msg.args().map((a) => a.jsonValue()));
      console.log(`${url}:${lineNumber}:${columnNumber}:`, ...values);
    });
  }

  await page.addInitScript({
    content: `
    (() => {
      let timeout = false;
      setTimeout(() => timeout = true, 5000);

      window.wptRefTestPageReady = function() {
        return timeout || !document.documentElement.classList.contains('reftest-wait');
      };

      window.wptRefTestGetTimeout = function() {
        return timeout;
      };
    })();
    `
  });

  const results = [];
  for (const testName of testNames) {
    console.log('processing:', testName);
    const { refLink, refWait, fuzzy } = readHTMLFile(path.join(kRefTestsPath, testName));
    if (!refLink) {
      throw new Error(`could not find ref link in: ${testName}`);
    }
    const testURL = `${kRefTestsBaseURL}/${testName}`;
    const refURL = `${kRefTestsBaseURL}/${refLink}`;

    // Technically this is not correct but it fits the existing tests.
    // It assumes refLink is relative to the refTestsPath but it's actually
    // supposed to be relative to the test. It might also be an absolute
    // path. Neither of those cases exist at the time of writing this.
    const refFileInfo = readHTMLFile(path.join(kRefTestsPath, refLink));
    const testScreenshotName = path.join(kScreenshotPath, `${testName}-actual.png`);
    const refScreenshotName = path.join(kScreenshotPath, `${testName}-expected.png`);
    const diffName = path.join(kScreenshotPath, `${testName}-diff.png`);

    const timeoutTest = await runPageAndTakeScreenshot(page, testURL, refWait, testScreenshotName);
    if (timeoutTest) {
      console.log('TIMEOUT');
      results.push(`[ TIMEOUT ] ${testName}`);
      continue;
    }

    const timeoutRef = await runPageAndTakeScreenshot(
    page,
    refURL,
    refFileInfo.refWait,
    refScreenshotName);

    if (timeoutRef) {
      console.log('TIMEOUT');
      results.push(`[ TIMEOUT ] ${refLink}`);
      continue;
    }

    const pass = await compareImages(testScreenshotName, refScreenshotName, fuzzy, diffName);
    results.push(`[ ${pass ? 'PASS   ' : 'FAILURE'} ] ${testName}`);
  }

  console.log(`----results----\n${results.join('\n')}`);

  await page.close();
  await context.close();
  console.log('-- [ done: waiting for browser to close ] --');
  await browser.close();
}

main().catch((e) => {
  throw e;
});
//# sourceMappingURL=run_wpt_ref_tests.js.map