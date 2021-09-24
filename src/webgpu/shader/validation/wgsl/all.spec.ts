import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const description = `
Basic WGSL validation tests to test the ShaderValidationTest fixture.
`;

export const g = makeTestGroup(ShaderValidationTest);

const basePath = '/out/webgpu/shader/validation/wgsl/';
const files = [
  'access-decoration-storage-storage-class.pass.wgsl',
  'access-decoration-uniform-storage-class.fail.wgsl',
  'access-decoration-is-required.fail.wgsl',
  'break-outside-for-or-switch.fail.wgsl',
  'continue-outside-for.fail.wgsl',
  'duplicate-entry-point.fail.wgsl',
  'duplicate-func-name.fail.wgsl',
  'duplicate-name-between-global-and-func-vars.fail.wgsl',
  'duplicate-stuct-name-v2.fail.wgsl',
  'duplicate-stuct-name.fail.wgsl',
  'duplicate-var-in-nested-scopes.pass.wgsl',
  'duplicate-var-in-one-scope-v2.fail.wgsl',
  'duplicate-var-in-one-scope-v3.fail.wgsl',
  'duplicate-var-in-one-scope.fail.wgsl',
  'duplicate-var-in-sibling-scopes.pass.wgsl',
  'fn-use-before-def.fail.wgsl',
  'function-return-missing-return-empty-body.fail.wgsl',
  'function-return-missing-return.fail.wgsl',
  'global-vars-must-be-unique-v2.fail.wgsl',
  'global-vars-must-be-unique-v3.fail.wgsl',
  'global-vars-must-be-unique.fail.wgsl',
  'module-scope-variable-function-storage-class.fail.wgsl',
  'module-scope-variable-no-explicit-storage-decoration.fail.wgsl',
  'no-enty-point-declared.fail.wgsl',
  'reassign-let.fail.wgsl',
  'runtime-array-is-expression-type.fail.wgsl',
  'runtime-array-is-store-type-v2.fail.wgsl',
  'runtime-array-is-store-type.fail.wgsl',
  'runtime-array-not-block-decorated.fail.wgsl',
  'runtime-array-not-last-v2.fail.wgsl',
  'runtime-array-not-last-v3.fail.wgsl',
  'runtime-array-not-last.fail.wgsl',
  'runtime-array-without-stride.fail.wgsl',
  'self-recursion-v2.fail.wgsl',
  'self-recursion.fail.wgsl',
  'struct-def-before-use.fail.wgsl',
  'struct-member-def-before-use-v2.fail.wgsl',
  'struct-member-def-before-use-v3.fail.wgsl',
  'struct-member-def-before-use-v4.fail.wgsl',
  'struct-member-def-before-use-v5.fail.wgsl',
  'struct-member-def-before-use.fail.wgsl',
  'struct-use-before-def.fail.wgsl',
  'switch-case-selector-must-have-the-same-type-as-the-selector-expression-2.fail.wgsl',
  'switch-case-selector-must-have-the-same-type-as-the-selector-expression.fail.wgsl',
  'switch-case-selector-value-must-be-unique.fail.wgsl',
  'switch-case.pass.wgsl',
  'switch-fallthrough-must-not-be-last-stmt-of-last-clause.fail.wgsl',
  'switch-must-have-exactly-one-default-clause-2.fail.wgsl',
  'switch-must-have-exactly-one-default-clause.fail.wgsl',
  'switch-selector-expression-must-be-scalar-integer-type.fail.wgsl',
  'var-def-before-use.fail.wgsl',
  'variable-initializer-mismatch-bool-f32.fail.wgsl',
  'variable-initializer-mismatch-bool-i32.fail.wgsl',
  'variable-initializer-mismatch-bool-u32.fail.wgsl',
  'variable-initializer-mismatch-bool.pass.wgsl',
  'variable-initializer-mismatch-f32-bool.fail.wgsl',
  'variable-initializer-mismatch-f32-i32.fail.wgsl',
  'variable-initializer-mismatch-f32-u32.fail.wgsl',
  'variable-initializer-mismatch-f32.pass.wgsl',
  'variable-initializer-mismatch-function.wgsl',
  'variable-initializer-mismatch-i32-bool.fail.wgsl',
  'variable-initializer-mismatch-i32-f32.fail.wgsl',
  'variable-initializer-mismatch-i32-u32.fail.wgsl',
  'variable-initializer-mismatch-i32.pass.wgsl',
  'variable-initializer-mismatch-out.wgsl',
  'variable-initializer-mismatch-private.wgsl',
  'variable-initializer-mismatch-u32-bool.fail.wgsl',
  'variable-initializer-mismatch-u32-f32.fail.wgsl',
  'variable-initializer-mismatch-u32-i32.fail.wgsl',
  'variable-initializer-mismatch-u32.pass.wgsl',
  'variable-storage-group-binding-decoration.fail.wgsl',
  'variable-uniform-group-binding-decoration.fail.wgsl',
  'variable-with-initilizer-function.pass.wgsl',
  'variable-with-initilizer-out.pass.wgsl',
  'variable-with-initilizer-private.pass.wgsl',
  'variable-with-initilizer-storage.fail.wgsl',
  'variable-with-initilizer-uniform.fail.wgsl',
  'variable-with-initilizer-workgroup-array.fail.wgsl',
  'variable-with-initilizer-workgroup.fail.wgsl',
];

// TODO: refactor
let shaders: Array<string>;
(async () => {
  shaders = await Promise.all(files.map(file => fetch(basePath + file))).then(responses =>
    Promise.all(responses.map(resp => resp.text()))
  );
})();

files.forEach((file, id) => {
  const name = file.slice(0, -10);
  const isPass = file.slice(-9, -5) === 'pass';
  //const description = shaders[i].slice(0, 80);
  g.test(name)
    .desc(`TODO: it can be comment from ${name}.wgsl`)
    .fn(t => {
      t.expectCompileResult(isPass, shaders[id]);
    });
});
