export const description = `

Examples of writing CTS tests with various features.

Start here when looking for examples of basic framework usage.
`;

import { globalTestConfig } from '../common/framework/test_config.js';
import { makeTestGroup } from '../common/framework/test_group.js';
import { getDefaultRequestAdapterOptions } from '../common/util/navigator_gpu.js';

import { GPUTest } from './gpu_test.js';

export const g = makeTestGroup(GPUTest);

/**
 * console.log is disallowed by WPT. Work around it when we're not in WPT.
 */
function consoleLogIfNotWPT(_x: unknown) {
  if (!('step_timeout' in globalThis)) {
    eval('console.log(_x)');
  }
}

g.test('info')
  .desc(
    `Test which prints what global scope (e.g. worker type) it's running in.
Typically, tests will check for the presence of the feature they need (like HTMLCanvasElement)
and skip if it's not available.

Run this test under various configurations to see different results
(Window, worker scopes, Node, etc.)

NOTE: If your test runtime elides logs when tests pass, you won't see the prints from this test
in the logs. On non-WPT runtimes only, it will also print to the console with console.log.`
  )
  .fn(async t => {
    function prettyPrint(x: unknown) {
      if (typeof x !== 'object') {
        return `\n  ${JSON.stringify(x)}`;
      }
      const a = [];
      for (const key in x) {
        a.push(`${key}: ${JSON.stringify((x as Record<string, unknown>)[key])}`);
      }
      return '\n  - ' + a.join('\n  - ');
    }

    const adapterInfo = await t.adapter.requestAdapterInfo();
    const adapterInfoFlat = Object.fromEntries(
      (function* () {
        for (const key in adapterInfo) {
          yield [key, adapterInfo[key as keyof GPUAdapterInfo]];
        }
      })()
    );

    const info = `
Global scope:
  ${Object.getPrototypeOf(globalThis).constructor.name}
globalTestConfig: ${prettyPrint(globalTestConfig)}
defaultRequestAdapterOptions: ${prettyPrint(getDefaultRequestAdapterOptions())}
GPUAdapterInfo: ${prettyPrint(adapterInfoFlat)}
navigator.userAgent (may not reflect reality):
  ${navigator.userAgent}
`;

    t.info(info);
    consoleLogIfNotWPT(info);
  });
