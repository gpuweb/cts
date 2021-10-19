/* eslint no-console: "off" */

import * as http from 'http';
import { AddressInfo } from 'net';

import { DefaultTestFileLoader } from '../internal/file_loader.js';
import { prettyPrintLog } from '../internal/logging/log_message.js';
import { Logger } from '../internal/logging/logger.js';
import { LiveTestCaseResult } from '../internal/logging/result.js';
import { parseQuery } from '../internal/query/parseQuery.js';
import { TestQueryWithExpectation } from '../internal/query/query.js';
import { TestTreeLeaf } from '../internal/tree.js';
import { setGPUProvider } from '../util/navigator_gpu.js';

import sys from './helper/sys.js';

function usage(rc: number): never {
  console.log('Usage:');
  console.log(`  tools/run_${sys.type} [OPTIONS...]`);
  console.log('Options:');
  console.log('  --verbose       Print result/log of every test as it runs.');
  console.log('  --gpu-provider  Path to node module that provides the GPU implementation.');
  console.log(``);
  console.log(`Provides an HTTP server used for running tests via an HTTP RPC interface`);
  console.log(`To run a test, perform an HTTP GET or POST at the URL:`);
  console.log(`  http://localhost:port/run?<test-name>`);
  console.log(`To shutdown the server perform an HTTP GET or POST at the URL:`);
  console.log(`  http://localhost:port/terminate`);
  return sys.exit(rc);
}

interface RunResult {
  status: string;
  message: string;
}

if (!sys.existsSync('src/common/runtime/cmdline.ts')) {
  console.log('Must be run from repository root');
  usage(1);
}

let debug = false;

for (let i = 0; i < sys.args.length; ++i) {
  const a = sys.args[i];
  if (a.startsWith('-')) {
    if (a === '--verbose') {
      debug = true;
    } else if (a === '--gpu-provider') {
      const modulePath = sys.args[++i];
      setGPUProvider(() => require(modulePath).gpu);
    }
  }
}

(async () => {
  Logger.globalDebugMode = debug;
  const log = new Logger();
  const testcases = await allWebGPUTestcases();

  async function allWebGPUTestcases() {
    const webgpuQuery = parseQuery('webgpu:*');
    const loader = new DefaultTestFileLoader();
    const map = new Map<string, TestTreeLeaf>();
    for (const testcase of await loader.loadCases(webgpuQuery)) {
      const name = testcase.query.toString();
      map.set(name, testcase);
    }
    return map;
  }

  async function runTestcase(
    testcase: TestTreeLeaf,
    expectations: TestQueryWithExpectation[] = []
  ): Promise<LiveTestCaseResult> {
    const name = testcase.query.toString();
    const [rec, res] = log.record(name);
    await testcase.run(rec, expectations);
    return res;
  }

  const server = http.createServer(
    async (request: http.IncomingMessage, response: http.ServerResponse) => {
      if (request.url === undefined) {
        return;
      }
      if (request.url.startsWith('/run?')) {
        const name = request.url.substr(5);
        const testcase = testcases.get(name);
        let status = 'fail';
        let message = '';
        if (testcase) {
          const result = await runTestcase(testcase);
          status = result.status;
          if (result.logs !== undefined) {
            message = result.logs.map(log => prettyPrintLog(log)).join('\n');
          }
        } else {
          message = `test case '${name}' not found`;
        }
        const res: RunResult = { status, message };
        response.end(JSON.stringify(res));
      } else if (request.url.startsWith('/terminate')) {
        server.close();
        sys.exit(1);
      }
    }
  );

  server.listen(0, () => {
    const address = server.address() as AddressInfo;
    console.log(`Server listening at [[${address.port}]]`);
  });
})().catch(ex => {
  console.error(ex.stack ?? ex.toString());
  sys.exit(1);
});
