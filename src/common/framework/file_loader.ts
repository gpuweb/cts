import { TestSuiteListing } from './listing.js';
import { parseQuery } from './query/parseQuery.js';
import { RunCaseIterable } from './test_group.js';
import { loadTreeForQuery, FilterResultTree, FilterResultTreeLeaf } from './tree.js';

// An actual .spec.ts file, as imported.
export interface SpecFile {
  readonly description: string;
  readonly g: RunCaseIterable;
}

// A shell object describing a directory (from its README.txt).
export interface ReadmeFile {
  readonly description: string;
}

export type TestSpecOrReadme = SpecFile | ReadmeFile;

export abstract class TestFileLoader {
  abstract listing(suite: string): Promise<TestSuiteListing>;
  protected abstract import(path: string): Promise<TestSpecOrReadme>;

  importSpecFile(suite: string, path: string[]): Promise<SpecFile> {
    return this.import(`${suite}/${path.join('/')}.spec.js`) as Promise<SpecFile>;
  }

  async loadTree(query: string, subqueriesToExpand: string[] = []): Promise<FilterResultTree> {
    return loadTreeForQuery(
      this,
      parseQuery(query),
      subqueriesToExpand.map(q => parseQuery(q))
    );
  }

  async loadTests(query: string): Promise<IterableIterator<FilterResultTreeLeaf>> {
    const tree = await this.loadTree(query);
    return tree.iterate();
  }
}

export class DefaultTestFileLoader extends TestFileLoader {
  async listing(suite: string): Promise<TestSuiteListing> {
    return (await import(`../../${suite}/listing.js`)).listing;
  }

  import(path: string): Promise<SpecFile> {
    return import('../../' + path);
  }
}
