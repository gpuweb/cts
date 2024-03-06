export const description = `
Tests WebGPU is available in a dedicated worker and a shared worker.

Note: The CTS test can be run respectively in a dedicated worker and a shared worker by
passing in worker=dedicated and worker=shared as a query parameter. These tests
are specifically to check that WebGPU is available in a dedicated worker and a shared worker.
`;

import { Fixture } from '../../../common/framework/fixture.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import { assert } from '../../../common/util/util.js';

export const g = makeTestGroup(Fixture);

// Note: we load worker_launcher dynamically because ts-node support
// is using commonjs which doesn't support import.meta. Further,
// we need to put the url in a string and pass the string to import
// otherwise typescript tries to parse the file which again, fails.
// worker_launcher.js is excluded in node.tsconfig.json.

function isNode(): boolean {
  return typeof process !== 'undefined' && process?.versions?.node !== undefined;
}

g.test('dedicated_worker')
  .desc(`test WebGPU is available in dedicated workers and check for basic functionality`)
  .fn(async t => {
    t.skipIf(isNode(), 'node does not support 100% compatible workers');
    const url = './worker_launcher.js';
    const { launchDedicatedWorker } = await import(url);
    const result = await launchDedicatedWorker();
    assert(result.error === undefined, `should be no error from worker but was: ${result.error}`);
  });

g.test('shared_worker')
  .desc(`test WebGPU is available in shared workers and check for basic functionality`)
  .fn(async t => {
    t.skipIf(isNode(), 'node does not support 100% compatible workers');
    const url = './worker_launcher.js';
    const { launchSharedWorker } = await import(url);
    const result = await launchSharedWorker();
    assert(result.error === undefined, `should be no error from worker but was: ${result.error}`);
  });

g.test('service_worker')
  .desc(`test WebGPU is available in service workers and check for basic functionality`)
  .fn(async t => {
    t.skipIf(isNode(), 'node does not support 100% compatible workers');
    const url = './worker_launcher.js';
    const { launchServiceWorker } = await import(url);
    const result = await launchServiceWorker();
    assert(result.error === undefined, `should be no error from worker but was: ${result.error}`);
  });
