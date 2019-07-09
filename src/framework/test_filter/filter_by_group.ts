import { TestFilterResult } from './index.js';
import { TestFilter } from './internal.js';
import { TestSpecID, TestCaseID } from '../id.js';
import { TestFileLoader, ReadmeFile, TestSpec } from '../loader.js';

export class FilterByGroup implements TestFilter {
  private readonly suite: string;
  private readonly groupPrefix: string;

  constructor(suite: string, groupPrefix: string) {
    this.suite = suite;
    this.groupPrefix = groupPrefix;
  }

  matches(spec: TestSpecID, testcase: TestCaseID): boolean {
    throw new Error('unimplemented');
  }

  async iterate(loader: TestFileLoader): Promise<TestFilterResult[]> {
    const specs = await loader.listing(this.suite);
    const entries: TestFilterResult[] = [];

    const suite = this.suite;
    for (const { path, description } of specs) {
      if (path.startsWith(this.groupPrefix)) {
        const isReadme = path === '' || path.endsWith('/');
        const spec = isReadme
          ? ({ description } as ReadmeFile)
          : ((await loader.import(`${suite}/${path}.spec.js`)) as TestSpec);
        entries.push({ id: { suite, path }, spec });
      }
    }

    return entries;
  }
}
