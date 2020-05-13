import { Logger, LogResults } from '../common/framework/logging/logger.js';
import { TestQuerySingleCase } from '../common/framework/query/query.js';
import { RunCaseIterable, TestCaseID } from '../common/framework/test_group.js';
import { objectEquals } from '../common/framework/util/util.js';

import { UnitTest } from './unit_test.js';

export class TestGroupTest extends UnitTest {
  async run(g: RunCaseIterable): Promise<LogResults> {
    const logger = new Logger(true);
    for (const rc of await Promise.all(g.iterate())) {
      const query = new TestQuerySingleCase('xx', ['yy'], rc.id.test, rc.id.params);
      const [rec] = logger.record(query.toString());
      await rc.run(rec);
    }
    return logger.results;
  }

  expectCases(g: RunCaseIterable, cases: TestCaseID[]): void {
    const gcases = Array.from(g.iterate()).map(rc => rc.id);
    this.expect(objectEquals(gcases, cases));
  }
}
