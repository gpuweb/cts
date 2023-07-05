/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/import { assert } from '../../../../../../common/util/util.js';import {
TypeF16,
VectorType,
elementType,
isAbstractType } from
'../../../../../util/conversion.js';


/// An array of values ranging from -1 to 2
export const kMinusOneToTwo = [
-1.0,
-0.9,
-0.1,
0.0,
0.1,
0.5,
0.9,
1.0,
1.1,
1.5,
1.9,
2.0];


/// An array of values ranging from -3π to 3π.
export const kMinus3PiTo3Pi = [
-3 * Math.PI,
-2.999 * Math.PI,
-2.5 * Math.PI,
-2.001 * Math.PI,
-2.0 * Math.PI,
-1.999 * Math.PI,
-1.5 * Math.PI,
-1.001 * Math.PI,
-1.0 * Math.PI,
-0.999 * Math.PI,
-0.5 * Math.PI,
-0.001,
0,
0.001,
0.5 * Math.PI,
0.999 * Math.PI,
1.0 * Math.PI,
1.001 * Math.PI,
1.5 * Math.PI,
1.999 * Math.PI,
2.0 * Math.PI,
2.5 * Math.PI,
2.001 * Math.PI,
2.999 * Math.PI,
3 * Math.PI];


/// The evaluation stages to test
export const kConstantAndOverrideStages = ['constant', 'override'];



/**
 * @returns true if evaluation stage @p stage supports expressions of type @p.
 */
export function stageSupportsType(stage, type) {
  if (stage === 'override' && isAbstractType(elementType(type))) {
    // Abstract numerics are concretized before being used in an override expression.
    return false;
  }
  return true;
}

/**
 * Runs a validation test to check that evaluation of @p builtin either evaluates with or without
 * error at shader creation time or pipeline creation time.
 * @param t the ShaderValidationTest
 * @param builtin the name of the builtin
 * @param expectedResult false if an error is expected, true if no error is expected
 * @param value the value to pass to the builtin
 * @param type the type to convert @p value to before passing to the builtin
 * @param stage the evaluation stage
 */
export function validateConstOrOverrideBuiltinEval(
t,
builtin,
expectedResult,
value,
type,
stage)
{
  const elTy = elementType(type);
  const enables = elTy === TypeF16 ? 'enable f16;' : '';
  let conversion = '';
  if (isAbstractType(elTy)) {
    if (type instanceof VectorType) {
      conversion = `vec${type.width}`;
    }
  } else {
    conversion = type.toString();
  }

  switch (stage) {
    case 'constant':{
        t.expectCompileResult(
        expectedResult,
        `${enables}
const v = ${builtin}(${conversion}(${value}));`);

        break;
      }
    case 'override':{
        assert(!isAbstractType(elTy));
        t.expectPipelineResult({
          expectedResult,
          code: `${enables}
override o : ${elTy.toString()};
var<private> v = ${builtin}(${conversion}(o));`,
          constants: { o: value },
          reference: ['v']
        });
        break;
      }}

}
//# sourceMappingURL=const_override_validation.js.map