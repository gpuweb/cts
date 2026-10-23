/**
 * Labels for tests found by mutation testing: which packages (and versions) were used to find
 * each test, and where the mutation was.
 */

/** A package (and version) used to find a test, and the mutation made to it, if any. */
export interface Mutation {
  package: string;
  /** Git commit. */
  version: string;
  /**
   * The mutated source: `file` and `line` in the package. `generatedFrom` is set if `file` is
   * generated during the build.
   */
  mutated?: { file: string; line: number; generatedFrom?: string };
}