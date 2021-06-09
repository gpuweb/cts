import { TestSuiteListing } from '../common/internal/test_suite_listing.js';
/* eslint-disable-next-line import/no-restricted-paths */
import { makeListing } from '../common/tools/crawl.js';

export const listing: Promise<TestSuiteListing> = makeListing(__filename);
