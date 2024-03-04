import { ROArrayArray } from '../../../../common/util/types.js';
import { ScalarBuilder, Value, Vector, i32, u32, abstractInt } from '../../../util/conversion.js';
import {
  QuantizeFunc,
  cartesianProduct,
  quantizeToI32,
  quantizeToU32,
  quantizeToI64,
} from '../../../util/math.js';

import { Expectation } from './expectation.js';

function notUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/** Case is a single expression test case. */
export type Case = {
  // The input value(s)
  input: Value | ReadonlyArray<Value>;
  // The expected result, or function to check the result
  expected: Expectation;
};

/** CaseList is a list of Cases */
export type CaseList = Array<Case>;

/**
 * A function that performs a binary operation on x and y, and returns the
 * expected result.
 */
export interface BinaryOp<T> {
  (x: T, y: T): T | undefined;
}

/**
 * A function that performs a vector-vector operation on x and y, and returns the
 * expected result.
 */
export interface VectorVectorToScalarOp<T> {
  (x: T[], y: T[]): T | undefined;
}

/**
 * @returns a Case for the input params with op applied
 * @param scalar scalar param
 * @param vector vector param (2, 3, or 4 elements)
 * @param op the op to apply to scalar and vector
 * @param quantize function to quantize all values in vectors and scalars
 * @param scalarize function to convert numbers to Scalars
 */
function makeScalarVectorBinaryToVectorCase<T>(
  scalar: T,
  vector: readonly T[],
  op: BinaryOp<T>,
  quantize: QuantizeFunc<T>,
  scalarize: ScalarBuilder<T>
): Case | undefined {
  scalar = quantize(scalar);
  vector = vector.map(quantize);
  const result = vector.map(v => op(scalar, v));
  if (result.includes(undefined)) {
    return undefined;
  }
  return {
    input: [scalarize(scalar), new Vector(vector.map(scalarize))],
    expected: new Vector(result.filter(notUndefined).map(scalarize)),
  };
}

/**
 * @returns array of Case for the input params with op applied
 * @param scalars array of scalar params
 * @param vectors array of vector params (2, 3, or 4 elements)
 * @param op the op to apply to each pair of scalar and vector
 * @param quantize function to quantize all values in vectors and scalars
 * @param scalarize function to convert numbers to Scalars
 */
function generateScalarVectorBinaryToVectorCases<T>(
  scalars: readonly T[],
  vectors: ROArrayArray<T>,
  op: BinaryOp<T>,
  quantize: QuantizeFunc<T>,
  scalarize: ScalarBuilder<T>
): Case[] {
  return scalars.flatMap(s => {
    return vectors
      .map(v => {
        return makeScalarVectorBinaryToVectorCase(s, v, op, quantize, scalarize);
      })
      .filter(notUndefined);
  });
}

/**
 * @returns a Case for the input params with op applied
 * @param vector vector param (2, 3, or 4 elements)
 * @param scalar scalar param
 * @param op the op to apply to vector and scalar
 * @param quantize function to quantize all values in vectors and scalars
 * @param scalarize function to convert numbers to Scalars
 */
function makeVectorScalarBinaryToVectorCase<T>(
  vector: readonly T[],
  scalar: T,
  op: BinaryOp<T>,
  quantize: QuantizeFunc<T>,
  scalarize: ScalarBuilder<T>
): Case | undefined {
  vector = vector.map(quantize);
  scalar = quantize(scalar);
  const result = vector.map(v => op(v, scalar));
  if (result.includes(undefined)) {
    return undefined;
  }
  return {
    input: [new Vector(vector.map(scalarize)), scalarize(scalar)],
    expected: new Vector(result.filter(notUndefined).map(scalarize)),
  };
}

/**
 * @returns array of Case for the input params with op applied
 * @param vectors array of vector params (2, 3, or 4 elements)
 * @param scalars array of scalar params
 * @param op the op to apply to each pair of vector and scalar
 * @param quantize function to quantize all values in vectors and scalars
 * @param scalarize function to convert numbers to Scalars
 */
function generateVectorScalarBinaryToVectorCases<T>(
  vectors: ROArrayArray<T>,
  scalars: readonly T[],
  op: BinaryOp<T>,
  quantize: QuantizeFunc<T>,
  scalarize: ScalarBuilder<T>
): Case[] {
  return scalars.flatMap(s => {
    return vectors
      .map(v => {
        return makeVectorScalarBinaryToVectorCase(v, s, op, quantize, scalarize);
      })
      .filter(notUndefined);
  });
}

/**
 * @returns array of Case for the input params with op applied
 * @param scalars array of scalar params
 * @param vectors array of vector params (2, 3, or 4 elements)
 * @param op he op to apply to each pair of scalar and vector
 */
export function generateU32VectorBinaryToVectorCases(
  scalars: readonly number[],
  vectors: ROArrayArray<number>,
  op: BinaryOp<number>
): Case[] {
  return generateScalarVectorBinaryToVectorCases(scalars, vectors, op, quantizeToU32, u32);
}

/**
 * @returns array of Case for the input params with op applied
 * @param vectors array of vector params (2, 3, or 4 elements)
 * @param scalars array of scalar params
 * @param op he op to apply to each pair of vector and scalar
 */
export function generateVectorU32BinaryToVectorCases(
  vectors: ROArrayArray<number>,
  scalars: readonly number[],
  op: BinaryOp<number>
): Case[] {
  return generateVectorScalarBinaryToVectorCases(vectors, scalars, op, quantizeToU32, u32);
}

/**
 * @returns array of Case for the input params with op applied
 * @param scalars array of scalar params
 * @param vectors array of vector params (2, 3, or 4 elements)
 * @param op he op to apply to each pair of scalar and vector
 */
export function generateI32VectorBinaryToVectorCases(
  scalars: readonly number[],
  vectors: ROArrayArray<number>,
  op: BinaryOp<number>
): Case[] {
  return generateScalarVectorBinaryToVectorCases(scalars, vectors, op, quantizeToI32, i32);
}

/**
 * @returns array of Case for the input params with op applied
 * @param vectors array of vector params (2, 3, or 4 elements)
 * @param scalars array of scalar params
 * @param op he op to apply to each pair of vector and scalar
 */
export function generateVectorI32BinaryToVectorCases(
  vectors: ROArrayArray<number>,
  scalars: readonly number[],
  op: BinaryOp<number>
): Case[] {
  return generateVectorScalarBinaryToVectorCases(vectors, scalars, op, quantizeToI32, i32);
}

/**
 * @returns array of Case for the input params with op applied
 * @param scalars array of scalar params
 * @param vectors array of vector params (2, 3, or 4 elements)
 * @param op he op to apply to each pair of scalar and vector
 */
export function generateI64VectorBinaryToVectorCases(
  scalars: readonly bigint[],
  vectors: ROArrayArray<bigint>,
  op: BinaryOp<bigint>
): Case[] {
  return generateScalarVectorBinaryToVectorCases(scalars, vectors, op, quantizeToI64, abstractInt);
}

/**
 * @returns array of Case for the input params with op applied
 * @param vectors array of vector params (2, 3, or 4 elements)
 * @param scalars array of scalar params
 * @param op he op to apply to each pair of vector and scalar
 */
export function generateVectorI64BinaryToVectorCases(
  vectors: ROArrayArray<bigint>,
  scalars: readonly bigint[],
  op: BinaryOp<bigint>
): Case[] {
  return generateVectorScalarBinaryToVectorCases(vectors, scalars, op, quantizeToI64, abstractInt);
}

/**
 * @returns array of Case for the input params with op applied
 * @param param0s array of inputs to try for the first param
 * @param param1s array of inputs to try for the second param
 * @param op callback called on each pair of inputs to produce each case
 * @param quantize function to quantize all values
 * @param scalarize function to convert numbers to Scalars
 */
function generateScalarBinaryToScalarCases<T>(
  param0s: readonly T[],
  param1s: readonly T[],
  op: BinaryOp<T>,
  quantize: QuantizeFunc<T>,
  scalarize: ScalarBuilder<T>
): Case[] {
  param0s = param0s.map(quantize);
  param1s = param1s.map(quantize);
  return cartesianProduct(param0s, param1s).reduce((cases, e) => {
    const expected = op(e[0], e[1]);
    if (expected !== undefined) {
      cases.push({ input: [scalarize(e[0]), scalarize(e[1])], expected: scalarize(expected) });
    }
    return cases;
  }, new Array<Case>());
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param param0s array of inputs to try for the first param
 * @param param1s array of inputs to try for the second param
 * @param op callback called on each pair of inputs to produce each case
 */
export function generateBinaryToI32Cases(
  param0s: readonly number[],
  param1s: readonly number[],
  op: BinaryOp<number>
) {
  return generateScalarBinaryToScalarCases(param0s, param1s, op, quantizeToI32, i32);
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param param0s array of inputs to try for the first param
 * @param param1s array of inputs to try for the second param
 * @param op callback called on each pair of inputs to produce each case
 */
export function generateBinaryToU32Cases(
  param0s: readonly number[],
  param1s: readonly number[],
  op: BinaryOp<number>
) {
  return generateScalarBinaryToScalarCases(param0s, param1s, op, quantizeToU32, u32);
}

/**
 * @returns an array of Cases for operations over a range of inputs
 * @param param0s array of inputs to try for the first param
 * @param param1s array of inputs to try for the second param
 * @param op callback called on each pair of inputs to produce each case
 */
export function generateBinaryToI64Cases(
  param0s: readonly bigint[],
  param1s: readonly bigint[],
  op: BinaryOp<bigint>
) {
  return generateScalarBinaryToScalarCases(param0s, param1s, op, quantizeToI64, abstractInt);
}

/**
 * @returns a Case for the input params with op applied
 * @param param0 vector param (2, 3, or 4 elements) for the first param
 * @param param1 vector param (2, 3, or 4 elements) for the second param
 * @param op the op to apply to each pair of vectors
 * @param quantize function to quantize all values in vectors and scalars
 * @param scalarize function to convert numbers to Scalars
 */
function makeVectorVectorToScalarCase<T>(
  param0: readonly T[],
  param1: readonly T[],
  op: VectorVectorToScalarOp<T>,
  quantize: QuantizeFunc<T>,
  scalarize: ScalarBuilder<T>
): Case | undefined {
  const param0_quantized = param0.map(quantize);
  const param1_quantized = param1.map(quantize);
  const result = op(param0_quantized, param1_quantized);
  if (result === undefined) return undefined;

  return {
    input: [
      new Vector(param0_quantized.map(scalarize)),
      new Vector(param1_quantized.map(scalarize)),
    ],
    expected: scalarize(result),
  };
}

/**
 * @returns array of Case for the input params with op applied
 * @param param0s array of vector params (2, 3, or 4 elements) for the first param
 * @param param1s array of vector params (2, 3, or 4 elements) for the second param
 * @param op the op to apply to each pair of vectors
 * @param quantize function to quantize all values in vectors and scalars
 * @param scalarize function to convert numbers to Scalars
 */
function generateVectorVectorToScalarCases<T>(
  param0s: ROArrayArray<T>,
  param1s: ROArrayArray<T>,
  op: VectorVectorToScalarOp<T>,
  quantize: QuantizeFunc<T>,
  scalarize: ScalarBuilder<T>
): Case[] {
  return param0s.flatMap(param0 => {
    return param1s
      .map(param1 => {
        return makeVectorVectorToScalarCase(param0, param1, op, quantize, scalarize);
      })
      .filter(notUndefined);
  });
}

/**
 * @returns array of Case for the input params with op applied
 * @param param0s array of vector params (2, 3, or 4 elements) for the first param
 * @param param1s array of vector params (2, 3, or 4 elements) for the second param
 * @param op the op to apply to each pair of vectors
 */
export function generateVectorVectorToI32Cases(
  param0s: ROArrayArray<number>,
  param1s: ROArrayArray<number>,
  op: VectorVectorToScalarOp<number>
): Case[] {
  return generateVectorVectorToScalarCases(param0s, param1s, op, quantizeToI32, i32);
}

/**
 * @returns array of Case for the input params with op applied
 * @param param0s array of vector params (2, 3, or 4 elements) for the first param
 * @param param1s array of vector params (2, 3, or 4 elements) for the second param
 * @param op the op to apply to each pair of vectors
 */
export function generateVectorVectorToU32Cases(
  param0s: ROArrayArray<number>,
  param1s: ROArrayArray<number>,
  op: VectorVectorToScalarOp<number>
): Case[] {
  return generateVectorVectorToScalarCases(param0s, param1s, op, quantizeToU32, u32);
}

/**
 * @returns array of Case for the input params with op applied
 * @param param0s array of vector params (2, 3, or 4 elements) for the first param
 * @param param1s array of vector params (2, 3, or 4 elements) for the second param
 * @param op the op to apply to each pair of vectors
 */
export function generateVectorVectorToI64Cases(
  param0s: ROArrayArray<bigint>,
  param1s: ROArrayArray<bigint>,
  op: VectorVectorToScalarOp<bigint>
): Case[] {
  return generateVectorVectorToScalarCases(param0s, param1s, op, quantizeToI64, abstractInt);
}
