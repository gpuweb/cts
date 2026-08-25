export const description = `
Tests of behavior while the device is lost.

- x= every method in the API.

TODO: implement
`;

import { Fixture } from '../../../../common/framework/fixture.js';
import { makeTestGroup } from '../../../../common/internal/test_group.js';
import { runDeviceLossTests } from './device_lost.js';

export const g = makeTestGroup(Fixture);

g.test('no_crash')
  .desc(
    `Test doing a bunch of operations after device.destroy() is called.

This effectively only tests is that there are no crashes. It's not actually possible to
check for validation errors: once a device is lost, it can't _track_ validation errors
(popErrorScope throws an exception).`
  )
  .params(u => u.combine('lost', [false, true]))
  .fn(async t => {
    const { lost } = t.params;

    await runDeviceLossTests(device => {
      if (lost) device.destroy();
    });
  });
