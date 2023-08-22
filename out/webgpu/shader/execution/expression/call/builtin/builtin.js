/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/import { basicExpressionBuilder, basicExpressionWithPredeclarationBuilder } from

'../../expression.js';

/* @returns a ShaderBuilder that calls the builtin with the given name */
export function builtin(name) {
  return basicExpressionBuilder((values) => `${name}(${values.join(', ')})`);
}

/* @returns a ShaderBuilder that calls the builtin with the given name and has given predeclaration */
export function builtinWithPredeclaration(name, predeclaration) {
  return basicExpressionWithPredeclarationBuilder(
  (values) => `${name}(${values.join(', ')})`,
  predeclaration);

}
//# sourceMappingURL=builtin.js.map