/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `Validation tests for tokenization`;import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

const kValidIdentifiers = new Set(['foo', 'Foo', '_foo0', '_0foo', 'foo__0']);
const kInvalidIdentifiers = new Set([
'_', // Single underscore is a syntactic token for phony assignment.
'__foo', // Leading double underscore is reserved.
'0foo', // Must start with single underscore or a letter.
// No punctuation:
'foo.bar',
'foo-bar',
'foo+bar',
'foo#bar',
'foo!bar',
'foo\\bar',
'foo/bar',
'foo,bar',
'foo@bar',
'foo::bar',
// Keywords:
'array',
'atomic',
'bitcast',
'bool',
'break',
'case',
'continue',
'continuing',
'default',
'discard',
'enable',
'else',
'f32',
'fallthrough',
'false',
'fn',
'for',
'function',
'i32',
'if',
'let',
'loop',
'mat2x2',
'mat2x3',
'mat2x4',
'mat3x2',
'mat3x3',
'mat3x4',
'mat4x2',
'mat4x3',
'mat4x4',
'override',
'private',
'ptr',
'return',
'sampler',
'sampler_comparison',
'storage',
'struct',
'switch',
'texture_1d',
'texture_2d',
'texture_2d_array',
'texture_3d',
'texture_cube',
'texture_cube_array',
'texture_depth_2d',
'texture_depth_2d_array',
'texture_depth_cube',
'texture_depth_cube_array',
'texture_depth_multisampled_2d',
'texture_multisampled_2d',
'texture_storage_1d',
'texture_storage_2d',
'texture_storage_2d_array',
'texture_storage_3d',
'true',
'type',
'u32',
'uniform',
'var',
'vec2',
'vec3',
'vec4',
'while',
'workgroup']);

g.test('identifiers').
desc(
`Test that valid identifiers are accepted, and invalid identifiers are rejected.

TODO: Add reserved words, when they've been refined.`).

params((u) =>
u.combine('ident', new Set([...kValidIdentifiers, ...kInvalidIdentifiers])).beginSubcases()).

fn((t) => {
  const code = `var<private> ${t.params.ident} : i32;`;
  t.expectCompileResult(kValidIdentifiers.has(t.params.ident), code);
});
//# sourceMappingURL=identifiers.spec.js.map