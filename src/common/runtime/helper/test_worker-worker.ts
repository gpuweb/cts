import { ExecutionContext } from '../../framework/execution_context.js';
import { setBaseResourcePath } from '../../framework/resources.js';
import { DefaultTestFileLoader } from '../../internal/file_loader.js';
import { Logger } from '../../internal/logging/logger.js';
import { parseQuery } from '../../internal/query/parseQuery.js';
import { assert } from '../../util/util.js';

// Should be DedicatedWorkerGlobalScope, but importing lib "webworker" conflicts with lib "dom".
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
declare const self: any;

const loader = new DefaultTestFileLoader();

setBaseResourcePath('../../../resources');

self.onmessage = async (ev: MessageEvent) => {
  const query: string = ev.data.query;
  const ctx: ExecutionContext = ev.data.ctx;
  const debug: boolean = ev.data.debug;

  Logger.globalDebugMode = debug;
  const log = new Logger();

  const testcases = Array.from(await loader.loadCases(parseQuery(query)));
  assert(testcases.length === 1, 'worker query resulted in != 1 cases');

  const testcase = testcases[0];
  const [rec, result] = log.record(testcase.query.toString());
  await testcase.run(rec, ctx);

  self.postMessage({ query, result });
};
