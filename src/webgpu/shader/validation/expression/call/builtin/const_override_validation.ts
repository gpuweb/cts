import { assert, unreachable } from '../../../../../../common/util/util.js';
import { kValue } from '../../../../../util/constants.js';
import {
  Type,
  Value,
  elementTypeOf,
  isAbstractType,
  scalarElementsOf,
  scalarTypeOf,
} from '../../../../../util/conversion.js';
import {
  scalarF16Range,
  scalarF32Range,
  scalarF64Range,
  linearRange,
  linearRangeBigInt,
} from '../../../../../util/math.js';
import { ShaderValidationTest } from '../../../shader_validation_test.js';

/** @returns a function that can select between ranges depending on type */
export function rangeForType(
  number_range: readonly number[],
  bigint_range: readonly bigint[]
): (type: Type) => readonly (number | bigint)[] {
  return (type: Type): readonly (number | bigint)[] => {
    switch (scalarTypeOf(type).kind) {
      case 'abstract-float':
      case 'f32':
      case 'f16':
        return number_range;
      case 'abstract-int':
        return bigint_range;
    }
    unreachable(`Received unexpected type '${type}'`);
  };
}

/* @returns a linear sweep between -2 to 2 for type */
// prettier-ignore
export const minusTwoToTwoRangeForType = rangeForType(
  linearRange(-2, 2, 10),
  [ -2n, -1n, 0n, 1n, 2n ]
);

/* @returns array of values ranging from -3π to 3π, with a focus on multiples of π */
export const minusThreePiToThreePiRangeForType = rangeForType(
  [
    -3 * Math.PI,
    -2.999 * Math.PI,

    -2.501 * Math.PI,
    -2.5 * Math.PI,
    -2.499 * Math.PI,

    -2.001 * Math.PI,
    -2.0 * Math.PI,
    -1.999 * Math.PI,

    -1.501 * Math.PI,
    -1.5 * Math.PI,
    -1.499 * Math.PI,

    -1.001 * Math.PI,
    -1.0 * Math.PI,
    -0.999 * Math.PI,

    -0.501 * Math.PI,
    -0.5 * Math.PI,
    -0.499 * Math.PI,

    -0.001,
    0,
    0.001,

    0.499 * Math.PI,
    0.5 * Math.PI,
    0.501 * Math.PI,

    0.999 * Math.PI,
    1.0 * Math.PI,
    1.001 * Math.PI,

    1.499 * Math.PI,
    1.5 * Math.PI,
    1.501 * Math.PI,

    1.999 * Math.PI,
    2.0 * Math.PI,
    2.001 * Math.PI,

    2.499 * Math.PI,
    2.5 * Math.PI,
    2.501 * Math.PI,

    2.999 * Math.PI,
    3 * Math.PI,
  ],
  [-2n, -1n, 0n, 1n, 2n]
);

/**
 * @returns a minimal array of values ranging from -3π to 3π, with a focus on
 * multiples of π.
 *
 * Used when multiple parameters are being passed in, so the number of cases
 * becomes the square or more of this list. */
export const sparseMinusThreePiToThreePiRangeForType = rangeForType(
  [
    -3 * Math.PI,
    -2.5 * Math.PI,
    -2.0 * Math.PI,
    -1.5 * Math.PI,
    -1.0 * Math.PI,
    -0.5 * Math.PI,
    0,
    0.5 * Math.PI,
    Math.PI,
    1.5 * Math.PI,
    2.0 * Math.PI,
    2.5 * Math.PI,
    3 * Math.PI,
  ],
  [-2n, -1n, 0n, 1n, 2n]
);

/// The evaluation stages to test
export const kConstantAndOverrideStages = ['constant', 'override'] as const;

export type ConstantOrOverrideStage = 'constant' | 'override';

/**
 * @returns true if evaluation stage `stage` supports expressions of type @p.
 */
export function stageSupportsType(stage: ConstantOrOverrideStage, type: Type) {
  if (stage === 'override' && isAbstractType(elementTypeOf(type)!)) {
    // Abstract numerics are concretized before being used in an override expression.
    return false;
  }
  return true;
}

/**
 * Runs a validation test to check that evaluation of `builtin` either evaluates with or without
 * error at shader creation time or pipeline creation time.
 * @param t the ShaderValidationTest
 * @param builtin the name of the builtin
 * @param expectedResult false if an error is expected, true if no error is expected
 * @param args the arguments to pass to the builtin
 * @param stage the evaluation stage
 */
export function validateConstOrOverrideBuiltinEval(
  t: ShaderValidationTest,
  builtin: string,
  expectedResult: boolean,
  args: Value[],
  stage: ConstantOrOverrideStage
) {
  const elTys = args.map(arg => elementTypeOf(arg.type)!);
  const enables = elTys.some(ty => ty === Type.f16) ? 'enable f16;' : '';

  switch (stage) {
    case 'constant': {
      t.expectCompileResult(
        expectedResult,
        `${enables}
const v = ${builtin}(${args.map(arg => arg.wgsl()).join(', ')});`
      );
      break;
    }
    case 'override': {
      assert(!elTys.some(ty => isAbstractType(ty)));
      const constants: Record<string, number> = {};
      const overrideDecls: string[] = [];
      const callArgs: string[] = [];
      let numOverrides = 0;
      for (const arg of args) {
        const argOverrides: string[] = [];
        for (const el of scalarElementsOf(arg)) {
          const name = `o${numOverrides++}`;
          overrideDecls.push(`override ${name} : ${el.type};`);
          argOverrides.push(name);
          constants[name] = Number(el.value);
        }
        callArgs.push(`${arg.type}(${argOverrides.join(', ')})`);
      }
      t.expectPipelineResult({
        expectedResult,
        code: `${enables}
${overrideDecls.join('\n')}
var<private> v = ${builtin}(${callArgs.join(', ')});`,
        constants,
        reference: ['v'],
      });
      break;
    }
  }
}

/** @returns a sweep of the representable values for element type of `type` */
export function fullRangeForType(type: Type, count?: number): readonly (number | bigint)[] {
  if (count === undefined) {
    count = 25;
  }
  switch (scalarTypeOf(type)?.kind) {
    case 'abstract-float':
      return scalarF64Range({
        pos_sub: Math.ceil((count * 1) / 5),
        pos_norm: Math.ceil((count * 4) / 5),
      });
    case 'f32':
      return scalarF32Range({
        pos_sub: Math.ceil((count * 1) / 5),
        pos_norm: Math.ceil((count * 4) / 5),
      });
    case 'f16':
      return scalarF16Range({
        pos_sub: Math.ceil((count * 1) / 5),
        pos_norm: Math.ceil((count * 4) / 5),
      });
    case 'i32':
      return linearRange(kValue.i32.negative.min, kValue.i32.positive.max, count).map(f =>
        Math.floor(f)
      );
    case 'u32':
      return linearRange(0, kValue.u32.max, count).map(f => Math.floor(f));
    case 'abstract-int':
      // Returned values are already ints, so don't need to be floored.
      return linearRangeBigInt(kValue.i64.negative.min, kValue.i64.positive.max, count);
  }
  unreachable();
}

/** @returns all the values in the provided arrays with duplicates removed */
export function unique<T>(...arrays: Array<readonly T[]>): T[] {
  const set = new Set<T>();
  for (const arr of arrays) {
    for (const item of arr) {
      set.add(item);
    }
  }
  return [...set];
}
