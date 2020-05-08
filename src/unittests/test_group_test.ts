import { Fixture } from '../common/framework/fixture.js';
import { TestCaseID } from '../common/framework/id.js';
import { Logger, LogResults } from '../common/framework/logging/logger.js';
import { paramsEquals } from '../common/framework/params_utils.js';
import { stringifyQuery } from '../common/framework/query/stringifyQuery.js';
import { TestGroup } from '../common/framework/test_group.js';

import { UnitTest } from './unit_test.js';
import { objectEquals } from '../common/framework/util/util.js';

export class TestGroupTest extends UnitTest {
  async run<F extends Fixture>(g: TestGroup<F>): Promise<LogResults> {
    const logger = new Logger(true);
    for (const rc of await Promise.all(g.iterate())) {
      const [rec] = logger.record(
        stringifyQuery({ suite: 'xx', group: ['yy'], ...rc.id, endsWithWildcard: false })
      );
      rec.start(true);
      await rc.run(rec);
      rec.finish();
    }
    return logger.results;
  }

  enumerate<F extends Fixture>(g: TestGroup<F>): TestCaseID[] {
    return Array.from(g.iterate()).map(rc => rc.id);
  }

  expectCases<F extends Fixture>(g: TestGroup<F>, cases: TestCaseID[]): void {
    const gcases = this.enumerate(g);
    this.expect(objectEquals(gcases, cases));
  }
}
