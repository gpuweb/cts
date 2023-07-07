/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/
/** The list of all shader stages */
export const kShaderStages = ['vertex', 'fragment', 'compute'];

/**
 * declareEntrypoint emits the WGSL to declare an entry point with the name, stage and body.
 * The generated function will have an appropriate return type and return statement, so that @p body
 * does not have to change between stage.
 * @param arg - arg specifies the
 * optional entry point function name, the shader stage, and the body of the
 * function, excluding any automatically generated return statements.
 * @returns the WGSL string for the entry point
 */
export function declareEntryPoint(arg) {
  if (arg.name === undefined) {
    arg.name = 'main';
  }
  switch (arg.stage) {
    case 'vertex':
      return `@vertex
fn ${arg.name}() -> @builtin(position) vec4f {
  ${arg.body}
  return vec4f();
}`;
    case 'fragment':
      return `@fragment
fn ${arg.name}() {
  ${arg.body}
}`;
    case 'compute':
      return `@compute @workgroup_size(1)
fn ${arg.name}() {
  ${arg.body}
}`;
  }
}
