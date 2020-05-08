import { Fixture } from '../common/framework/fixture.js';
import { TestCaseID } from '../common/framework/id.js';
import { Logger, LogResults } from '../common/framework/logging/logger.js';
import { stringifyQuery } from '../common/framework/query/stringifyQuery.js';
import { TestGroup } from '../common/framework/test_group.js';
import { objectEquals } from '../common/framework/util/util.js';

import { UnitTest } from './unit_test.js';

export class TestGroupTest extends UnitTest {
  async run<F extends Fixture>(g: TestGroup<F>): Promise<LogResults> {
    const logger = new Logger(true);
    for (const rc of await Promise.all(g.iterate())) {
      const [rec] = logger.record(
        stringifyQuery({ suite: 'xx', group: ['yy'], ...rc.id, endsWithWildcard: false })
      );
      await rc.run(rec);
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
