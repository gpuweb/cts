# Index of Test Helpers

This index is a quick-reference of helper functions in the test suite.
Use it to determine whether you can reuse a helper, instead of writing new code,
to improve readability and reviewability.

Whenever a new generally-useful helper is added, it should be indexed here.

Generally, see:

- [`src/webgpu/gpu_test.ts`](../src/webgpu/gpu_test.ts) (for all tests)
- [`src/webgpu/api/validation/validation_test.ts`](../src/webgpu/api/validation/validation_test.ts)
  (for validation tests).
- [`src/webgpu/shader/validation/shader_validation_test.ts`](../src/webgpu/shader/validation/shader_validation_test.ts)
  (for shader validation tests).
- Structured information about texture formats, binding types, etc. can be found in
  [`src/webgpu/capability_info.ts`](../src/webgpu/capability_info.ts).
- Constant values (needed anytime a WebGPU constant is needed outside of a test function)
  can be found in [`src/webgpu/constants.ts`](../src/webgpu/constants.ts).

## Index

- TODO: Index existing helpers.
- [`CaseParamsBuilder` and `SubcaseParamsBuilder`](../src/common/framework/params_builder.ts)
    are objects that iterate over params. These are used in `.params()`/`.paramsSubcasesOnly()`.
    See `examples.spec.ts` for basic examples of how this behaves.
    - `CaseParamsBuilder`
        - `xs.expandP(x => ys)`: Expands each item in `xs` into multiple items,
          each extended with an item of `y`.
        - `xs.combineP(ys)`: like `.expandP()` but `ys` doesn't depend on the value of `x`.
          In other words, the cartesian product of `xs` with `ys`.
        - `xs.combine('key', [1, 2, 3])`: common case of `.combineP()`;
          combines over `{ key: 1 }, { key: 2 }, { key: 3 }`.
        - `xs.expand('key', x => ys)`: common case of `.expandP()`;
          expands each `x` over `{ key: y[0] }, { key: y[1] }, ...`.
        - `xs.filter(x => boolean)` and `xs.unless(x => boolean)`:
          filter the current items according to a predicate.
        - `xs.beginSubcases()`: finalizes the "cases" of the builder, returning a `SubcaseParamsBuilder`.
    - `SubcaseParamsBuilder` has the same methods, except for `.beginSubcases()`.
        They generate more subcases, rather than more cases.
- [`GPUTest`](../src/webgpu/gpu_test.ts)
    - `selectDeviceForTextureFormatOrSkipTestCase`: Create device with texture format(s) required
        feature(s). If the device creation fails, then skip the test for that format(s).
    - `selectDeviceForQueryTypeOrSkipTestCase`: Create device with query type(s) required
        feature(s). If the device creation fails, then skip the test for that type(s).
    - `expectSingleValueContents`: Expect a buffer's contents to be a single constant value,
        specified as a TypedArrayBufferView.
    - `checkSingleValueBuffer`: checks that an actual TypedArrayBufferView's contents are all a
        single constant value, specified as a TypedArrayBufferView containing one element.
- [`ValidationTest`](../src/webgpu/api/validation/validation_test.ts)
    - `createEncoder`: Generically creates non-pass, compute pass, render pass, or render bundle
        encoders. This allows callers to write code using methods common to multiple encoder types.
    - TODO: index everything else in `ValidationTest`
- [`ShaderValidationTest`](../src/webgpu/shader/validation/shader_validation_test.ts)
    - `expectCompileResult` Allows checking for compile success/failure, or failure with a
      particular error substring.
- [`util/texture/base.ts`](../src/webgpu/util/texture/base.ts)
    - `maxMipLevelCount`: Compute the max mip level count allowed given texture size and texture
        dimension types.
- [`util/texture/image_copy.ts`](../src/webgpu/util/texture/image_copy.ts)
    - `bytesInACompleteRow` Computes bytesInACompleteRow for image copies (B2T/T2B/writeTexture).
    - `dataBytesForCopy` Validates a copy and computes the number of bytes it needs.
- [`util/buffer.ts`](../src/webgpu/util/buffer.ts)
    - `makeBufferWithContents` Creates a buffer with the contents of some TypedArray.
- [`util/unions.ts`](../src/webgpu/util/unions.ts)
    - `standardizeExtent3D` Standardizes a `GPUExtent3D` into a `Required<GPUExtent3DDict>`.
