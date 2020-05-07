// A listing of all specs within a single suite. This is the (awaited) type of
// `groups` in '{cts,unittests}/listing.ts' and `listing` in the auto-generated
// 'out/{cts,unittests}/listing.js' files (see tools/gen_listings).
export type TestSuiteListing = Iterable<TestSuiteListingEntry>;

interface TestSuiteListingEntryBase {
  // TODO: rename to group or something
  readonly path: string[];
}
interface TestSuiteListingEntrySpec extends TestSuiteListingEntryBase {
  readonly description: string;
}
interface TestSuiteListingEntryReadme extends TestSuiteListingEntryBase {
  readonly readme: string;
}

export type TestSuiteListingEntry = TestSuiteListingEntrySpec | TestSuiteListingEntryReadme;
