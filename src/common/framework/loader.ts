import { TestSuiteListing } from './listing.js';
import { loadFilter } from './test_filter/load_filter.js';
import { TestFilterResult } from './test_filter/test_filter_result.js';
import { RunCaseIterable } from './test_group.js';
import { assert } from './util/util.js';

// One of the following:
// - An actual .spec.ts file, as imported.
// - A *filtered* list of cases from a single .spec.ts file.
export interface TestSpec {
  readonly description: string;
  readonly g: RunCaseIterable;
}

// A shell object describing a directory (from its README.txt).
export interface ReadmeFile {
  readonly description: string;
}

export type TestSpecOrReadme = TestSpec | ReadmeFile;

type TestFilterResultIterator = IterableIterator<TestFilterResult>;
function* concat(lists: TestFilterResult[][]): TestFilterResultIterator {
  for (const specs of lists) {
    yield* specs;
  }
}

export abstract class TestFileLoader {
  abstract listing(suite: string): Promise<TestSuiteListing>;
  abstract import(path: string): Promise<TestSpecOrReadme>;
  importSpecFile(suite: string, path: string[]): Promise<TestSpec> {
    return this.import(suite + path.join('/') + '.spec.js') as Promise<TestSpec>;
  }
}

class DefaultTestFileLoader extends TestFileLoader {
  async listing(suite: string): Promise<TestSuiteListing> {
    return (await import(`../../${suite}/listing.js`)).listing;
  }

  import(path: string): Promise<TestSpec> {
    return import('../../' + path);
  }
}

export class TestLoader {
  private fileLoader: TestFileLoader;

  constructor(fileLoader: TestFileLoader = new DefaultTestFileLoader()) {
    this.fileLoader = fileLoader;
  }

  // TODO: Test
  async loadTestsFromQuery(query: string): Promise<TestFilterResultIterator> {
    return this.loadTests(new URLSearchParams(query).getAll('q'));
  }

  // TODO: Test
  // TODO: Probably should actually not exist at all, just use queries on cmd line too.
  async loadTestsFromCmdLine(filters: string[]): Promise<TestFilterResultIterator> {
    return this.loadTests(filters);
  }

  async loadTests(filters: string[]): Promise<TestFilterResultIterator> {
    for (const filter of filters) {
      const firstColonIndex = filter.indexOf(':');
      assert(
        firstColonIndex !== filter.length - 1,
        'empty path in query (`webgpu:` is now `webgpu:*`)'
      );
    }
    const loads = filters.map(f => loadFilter(this.fileLoader, f));
    return concat(await Promise.all(loads));
  }
}
