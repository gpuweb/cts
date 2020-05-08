import { TestSuiteListing } from './listing.js';
import { parseQuery } from './query/parseQuery.js';
import { RunCaseIterable } from './test_group.js';
import { loadTreeForQuery, FilterResultTree, FilterResultTreeLeaf } from './tree.js';

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

export abstract class TestFileLoader {
  abstract listing(suite: string): Promise<TestSuiteListing>;
  protected abstract import(path: string): Promise<TestSpecOrReadme>;

  importSpecFile(suite: string, path: string[]): Promise<TestSpec> {
    return this.import(`${suite}/${path.join('/')}.spec.js`) as Promise<TestSpec>;
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

  async loadTree(query: string, subqueriesToExpand: string[] = []): Promise<FilterResultTree> {
    return loadTreeForQuery(
      this.fileLoader,
      parseQuery(query),
      subqueriesToExpand.map(q => parseQuery(q))
    );
  }

  // TODO: Test this
  async loadTests(query: string): Promise<IterableIterator<FilterResultTreeLeaf>> {
    return (await this.loadTree(query)).iterate();
  }
}
