import { SpecFile, TestFileLoader } from '../../internal/file_loader.js';
import { TestSuiteListing, TestSuiteListingEntry } from '../../internal/test_suite_listing.js';

/**
 * Entry for a pre-imported spec file.
 * Generated at build time by gen_rn_specs.ts
 */
export interface SpecEntry {
  /** The path parts, e.g. ['api', 'operation', 'adapter', 'info'] */
  readonly path: string[];
  /** The pre-imported spec module */
  readonly spec: SpecFile;
}

/**
 * All specs for a suite, keyed by suite name (e.g., 'webgpu')
 */
export type AllSpecs = Map<string, SpecEntry[]>;

/**
 * React Native compatible TestFileLoader.
 *
 * Unlike DefaultTestFileLoader which uses dynamic imports,
 * this loader uses pre-imported spec modules that are bundled
 * at build time.
 *
 * Usage:
 *   import { allSpecs } from './generated/all_specs.js';
 *   const loader = new ReactNativeTestFileLoader(allSpecs);
 *   const tree = await loader.loadTree(parseQuery('webgpu:*'));
 */
export class ReactNativeTestFileLoader extends TestFileLoader {
  private readonly specs: AllSpecs;

  constructor(specs: AllSpecs) {
    super();
    this.specs = specs;
  }

  async listing(suite: string): Promise<TestSuiteListing> {
    const entries = this.specs.get(suite);
    if (!entries) {
      throw new Error(`Unknown test suite: ${suite}`);
    }

    // Build listing from the pre-imported spec entries
    const listing: TestSuiteListingEntry[] = entries.map(entry => ({
      file: entry.path,
    }));

    return listing;
  }

  protected async import(path: string): Promise<SpecFile> {
    // path is like "webgpu/api/operation/adapter/info.spec.js"
    const parts = path.replace(/\.spec\.js$/, '').split('/');
    const suite = parts[0];
    const filePath = parts.slice(1);

    const entries = this.specs.get(suite);
    if (!entries) {
      throw new Error(`Unknown test suite: ${suite}`);
    }

    const pathStr = filePath.join('/');
    const entry = entries.find(e => e.path.join('/') === pathStr);

    if (!entry) {
      throw new Error(`Spec file not found: ${path}`);
    }

    return entry.spec;
  }
}
