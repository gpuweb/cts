import { TIDGroupOrTestOrCase } from '../id.js';
import { TestFileLoader } from '../loader.js';

import { TestFilterResult } from './test_filter_result.js';

export interface TestFilter {
  // Iterates over the test cases matched by the filter.
  iterate(loader: TestFileLoader): Promise<TestFilterResult[]>;

  // If the filter definitely represents an entire subtree (i.e. ends in `;*` or `:*` or `:`).
  definitelyWholeSubtree(): boolean;
  idIfWholeSubtree(): TIDGroupOrTestOrCase | undefined;

  matches(line: string): boolean;
}
