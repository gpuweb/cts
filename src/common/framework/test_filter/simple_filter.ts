import { TIDGroupOrTestOrCase, TestCaseID } from '../id.js';
import { TestFileLoader, TestSpec } from '../loader.js';
import { TestSpecRecorder } from '../logger.js';
import { stringifyPublicParams, parseParamsString } from '../params_utils.js';
import { RunCaseIterable, RunCase } from '../test_group.js';
import { assert } from '../util/util.js';

import { TestFilter } from './internal.js';
import { TestFilterResult } from './test_filter_result.js';

abstract class Pattern {
  protected readonly prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  abstract matches(s: string): boolean;
  abstract definitelyWholeSubtree(): boolean;
  abstract stringIfWholeSubtree(): string | undefined;
}

class PatternFixed extends Pattern {
  matches(s: string): boolean {
    return s === this.prefix;
  }

  definitelyWholeSubtree(): boolean {
    return true;
  }

  stringIfWholeSubtree(): string {
    return this.prefix;
  }
}

class PatternWildcard extends Pattern {
  matches(s: string): boolean {
    return s.startsWith(this.prefix);
  }

  definitelyWholeSubtree(): boolean {
    if (this.prefix === '') {
      return true;
    }
    const last = this.prefix.charAt(this.prefix.length - 1);
    return last === ':' || last === ';';
  }

  stringIfWholeSubtree(): string | undefined {
    if (!this.definitelyWholeSubtree()) {
      return undefined;
    }
    return this.prefix;
  }
}

export class SimpleFilterGroup implements TestFilter {
  private readonly suite: string;
  private readonly groupPattern: Pattern;

  constructor(suite: string, pattern: string) {
    this.suite = suite;

    const star = pattern.indexOf('*');
    if (star === -1) {
      assert(pattern[pattern.length - 1] === ':', 'Filter must end in ;* or :* or :');
      this.groupPattern = new PatternFixed(pattern);
    } else {
      assert(star === pattern.length - 1, 'Wildcard * may only appear at the end');
      assert(
        pattern.length === 1 || /[:;]/.test(pattern[pattern.length - 2]),
        'Filter must end in ;* or :* or :'
      );
      this.groupPattern = new PatternWildcard(pattern.substring(0, pattern.length - 1));
    }
  }

  async iterate(loader: TestFileLoader): Promise<TestFilterResult[]> {
    const specs = await loader.listing(this.suite);

    const results = [];
    for (const { path, description } of specs) {
      const id = { suite: this.suite, path };
      if (this.groupPattern.matches(path)) {
        if (path === '' || path.endsWith(';')) {
          // This is a README
          results.push({ id, spec: { description } });
        } else {
          const spec = (await loader.import(
            `${this.suite}/${path.replace(/;/g, '/')}.spec.js`
          )) as TestSpec;
          results.push({ id, spec });
        }
      }
    }
    return results;
  }

  definitelyWholeSubtree(): boolean {
    return false;
    //return this.groupPattern.definitelyWholeSubtree();
  }

  idIfWholeSubtree(): TIDGroupOrTestOrCase | undefined {
    const group = this.groupPattern.stringIfWholeSubtree();
    if (group === undefined) return undefined;
    return { group: { suite: this.suite, group: group } };
  }

  matches(line: string): boolean {
    const pre = this.suite + ':';
    if (!line.startsWith(pre)) {
      return false;
    }
    return this.groupPattern.matches(line.substring(pre.length));
  }
}

export class SimpleFilterCase implements TestFilter {
  private readonly suite: string;
  private readonly group: string;
  private readonly testcasePattern: Pattern;

  constructor(suite: string, group: string, pattern: string) {
    this.suite = suite;
    this.group = group;

    const star = pattern.indexOf('*');
    if (star === -1) {
      assert(pattern[pattern.length - 1] === ':', 'Filter must end in ;* or :* or :');
      this.testcasePattern = new PatternFixed(pattern);
    } else {
      assert(star === pattern.length - 1, 'Wildcard * may only appear at the end');
      assert(
        pattern.length === 1 || /[:;]/.test(pattern[pattern.length - 2]),
        'Filter must end in ;* or :* or :'
      );
      this.testcasePattern = new PatternWildcard(pattern.substring(0, pattern.length - 1));
    }
  }

  async iterate(loader: TestFileLoader): Promise<TestFilterResult[]> {
    const specs = await loader.listing(this.suite);

    const results = [];
    for (const { path } of specs) {
      if (path === '' || path.endsWith('/')) {
        continue;
      }
      const id = { suite: this.suite, path };
      if (path === this.group) {
        const spec = (await loader.import(`${this.suite}/${path}.spec.js`)) as TestSpec;
        const g = filterTestGroup(spec.g, ({ test, params }) => {
          return this.testcasePattern.matches(test + ':' + stringifyPublicParams(params));
        });
        results.push({ id, spec: { description: spec.description, g } });
      }
    }
    return results;
  }

  definitelyWholeSubtree(): boolean {
    return true;
  }

  idIfWholeSubtree(): TIDGroupOrTestOrCase | undefined {
    const spec = { suite: this.suite, path: this.group };

    const testcase = this.testcasePattern.stringIfWholeSubtree();
    if (testcase === undefined) return undefined;
    if (testcase === '') {
      return { group: spec };
    }
    const colonIndex = testcase.indexOf(':');
    if (colonIndex === -1) {
      return { group: spec, test: testcase };
    } else {
      const test = testcase.substring(0, colonIndex);
      const params = testcase.substring(colonIndex + 1);
      return { group: spec, test: test, params: parseParamsString(params) };
    }
  }

  matches(line: string): boolean {
    const pre = `${this.suite}:${this.group}:`;
    if (!line.startsWith(pre)) {
      return false;
    }
    return this.testcasePattern.matches(line.substring(pre.length));
  }
}

type TestGroupFilter = (testcase: TestCaseID) => boolean;
function filterTestGroup(group: RunCaseIterable, filter: TestGroupFilter): RunCaseIterable {
  return {
    *iterate(log: TestSpecRecorder): Iterable<RunCase> {
      for (const rc of group.iterate(log)) {
        if (filter(rc.id)) {
          yield rc;
        }
      }
    },
  };
}
