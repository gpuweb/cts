# Implementing Tests

Once a test plan is done, you can start writing tests.
To add new tests, imitate the pattern in neigboring tests or neighboring files.
New test files must be named ending in `.spec.ts`.

For an example test file, see [`src/webgpu/examples.spec.ts`](../src/webgpu/examples.spec.ts).

Implement some tests and open a pull request. You can open a PR any time you're ready for a review.
(If two tests are non-trivial but independent, consider separate pull requests.)

Before uploading, you can run pre-submit checks (`grunt pre`) to make sure it will pass CI.

## Test Helpers

It's best to be familiar with the helpers in
[`src/webgpu/gpu_test.ts`](../src/webgpu/gpu_test.ts) (for all tests) and
[`src/webgpu/api/validation/validation_test.ts`](../src/webgpu/api/validation/validation_test.ts)
(for validation tests).

New test helpers can be added at any time to either of those files, or to new `.ts` files anywhere
near the `.spec.ts` file where they're used.

Additionally, structured information about texture formats, binding types, etc. can be found in
[`src/webgpu/capability_info.ts`](../src/webgpu/capability_info.ts).
Constant values (needed anytime a WebGPU constant is needed outside of a test function)
can be found in [`src/webgpu/constants.ts`](../src/webgpu/constants.ts).

TODO: Document a list of helpers.
