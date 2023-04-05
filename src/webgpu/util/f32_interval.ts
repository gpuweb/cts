// This is a shim file with all the old/deprecated f32 API calls.
// They currently just pass-through to the refactored FPContext implementation.
// As CTS migrates over to directly calling the new API, these will be removed.

import { FPInterval, FPMatrix, FPVector, IntervalBounds, FP } from './floating_point.js';

// Interfaces

export interface ScalarPairToInterval {
  (x: number, y: number): FPInterval;
}

export interface ScalarTripleToInterval {
  (x: number, y: number, z: number): FPInterval;
}

export interface ScalarToVector {
  (n: number): FPVector;
}

export interface VectorToInterval {
  (x: number[]): FPInterval;
}

export interface VectorPairToInterval {
  (x: number[], y: number[]): FPInterval;
}

export interface VectorToVector {
  (x: number[]): FPVector;
}

export interface VectorPairToVector {
  (x: number[], y: number[]): FPVector;
}

export interface VectorScalarToVector {
  (x: number[], y: number): FPVector;
}

export interface ScalarVectorToVector {
  (x: number, y: number[]): FPVector;
}

export interface MatrixToScalar {
  (m: number[][]): FPInterval;
}

export interface MatrixToMatrix {
  (m: number[][]): FPMatrix;
}

export interface MatrixPairToMatrix {
  (x: number[][], y: number[][]): FPMatrix;
}

export interface MatrixScalarToMatrix {
  (x: number[][], y: number): FPMatrix;
}

export interface ScalarMatrixToMatrix {
  (x: number, y: number[][]): FPMatrix;
}

export interface MatrixVectorToVector {
  (x: number[][], y: number[]): FPVector;
}

export interface VectorMatrixToVector {
  (x: number[], y: number[][]): FPVector;
}

// Containers

export type F32Vector = FPVector;

// Utilities

export function toF32Interval(n: number | IntervalBounds | FPInterval): FPInterval {
  return FP.f32.toInterval(n);
}

export function isF32Vector(v: (number | IntervalBounds | FPInterval)[]): v is FPVector {
  return FP.f32.isVector(v);
}

export function toF32Vector(v: (number | IntervalBounds | FPInterval)[]): FPVector {
  return FP.f32.toVector(v);
}

export function spanF32Intervals(...intervals: FPInterval[]): FPInterval {
  return FP.f32.spanIntervals(...intervals);
}

export function isF32Matrix(
  m: (number | IntervalBounds | FPInterval)[][] | FPVector[]
): m is FPMatrix {
  return FP.f32.isMatrix(m);
}

export function toF32Matrix(m: (number | IntervalBounds | FPInterval)[][] | FPVector[]): FPMatrix {
  return FP.f32.toMatrix(m);
}

// Accuracy Interval

export function correctlyRoundedInterval(n: number | FPInterval): FPInterval {
  return FP.f32.correctlyRoundedInterval(n);
}

export function correctlyRoundedMatrix(m: number[][]): FPMatrix {
  return FP.f32.correctlyRoundedMatrix(m);
}

export function absoluteErrorInterval(n: number, error_range: number): FPInterval {
  return FP.f32.absoluteErrorInterval(n, error_range);
}

export function ulpInterval(n: number, numULP: number): FPInterval {
  return FP.f32.ulpInterval(n, numULP);
}

export function additionMatrixInterval(x: number[][], y: number[][]): FPMatrix {
  return FP.f32.additionMatrixInterval(x, y);
}

export const clampIntervals = FP.f32.clampIntervals;

export function clampMedianInterval(
  x: number | FPInterval,
  y: number | FPInterval,
  z: number | FPInterval
): FPInterval {
  return FP.f32.clampMedianInterval(x, y, z);
}

export function clampMinMaxInterval(
  x: number | FPInterval,
  y: number | FPInterval,
  z: number | FPInterval
): FPInterval {
  return FP.f32.clampMinMaxInterval(x, y, z);
}

export function crossInterval(x: number[], y: number[]): FPVector {
  return FP.f32.crossInterval(x, y);
}

export function determinantInterval(m: number[][]): FPInterval {
  return FP.f32.determinantInterval(m);
}

export function dotInterval(x: number[] | FPInterval[], y: number[] | FPInterval[]): FPInterval {
  return FP.f32.dotInterval(x, y);
}

export function faceForwardIntervals(
  x: number[],
  y: number[],
  z: number[]
): (FPVector | undefined)[] {
  return FP.f32.faceForwardIntervals(x, y, z);
}

export function fmaInterval(x: number, y: number, z: number): FPInterval {
  return FP.f32.fmaInterval(x, y, z);
}

export function lengthInterval(n: number | FPInterval | number[] | FPVector): FPInterval {
  return FP.f32.lengthInterval(n);
}

export function maxInterval(x: number | FPInterval, y: number | FPInterval): FPInterval {
  return FP.f32.maxInterval(x, y);
}

export function minInterval(x: number | FPInterval, y: number | FPInterval): FPInterval {
  return FP.f32.minInterval(x, y);
}

export const mixIntervals = FP.f32.mixIntervals;

export function mixImpreciseInterval(x: number, y: number, z: number): FPInterval {
  return FP.f32.mixImpreciseInterval(x, y, z);
}

export function mixPreciseInterval(x: number, y: number, z: number): FPInterval {
  return FP.f32.mixPreciseInterval(x, y, z);
}

export function modfInterval(n: number): { fract: FPInterval; whole: FPInterval } {
  return FP.f32.modfInterval(n);
}

export function multiplicationMatrixScalarInterval(mat: number[][], scalar: number): FPMatrix {
  return FP.f32.multiplicationMatrixScalarInterval(mat, scalar);
}

export function multiplicationScalarMatrixInterval(scalar: number, mat: number[][]): FPMatrix {
  return FP.f32.multiplicationScalarMatrixInterval(scalar, mat);
}

export function multiplicationMatrixMatrixInterval(mat_x: number[][], mat_y: number[][]): FPMatrix {
  return FP.f32.multiplicationMatrixMatrixInterval(mat_x, mat_y);
}

export function multiplicationMatrixVectorInterval(x: number[][], y: number[]): FPVector {
  return FP.f32.multiplicationMatrixVectorInterval(x, y);
}

export function multiplicationVectorMatrixInterval(x: number[], y: number[][]): FPVector {
  return FP.f32.multiplicationVectorMatrixInterval(x, y);
}

export function normalizeInterval(n: number[]): FPVector {
  return FP.f32.normalizeInterval(n);
}

export function powInterval(x: number | FPInterval, y: number | FPInterval): FPInterval {
  return FP.f32.powInterval(x, y);
}

export function reflectInterval(x: number[], y: number[]): FPVector {
  return FP.f32.reflectInterval(x, y);
}

export function refractInterval(i: number[], s: number[], r: number): FPVector {
  return FP.f32.refractInterval(i, s, r);
}

export function smoothStepInterval(low: number, high: number, x: number): FPInterval {
  return FP.f32.smoothStepInterval(low, high, x);
}

export function stepInterval(edge: number, x: number): FPInterval {
  return FP.f32.stepInterval(edge, x);
}

export function subtractionMatrixInterval(x: number[][], y: number[][]): FPMatrix {
  return FP.f32.subtractionMatrixInterval(x, y);
}

export function transposeInterval(m: number[][]): FPMatrix {
  return FP.f32.transposeInterval(m);
}

export function unpack2x16floatInterval(n: number): FPVector {
  return FP.f32.unpack2x16floatInterval(n);
}

export function unpack2x16snormInterval(n: number): FPVector {
  return FP.f32.unpack2x16snormInterval(n);
}

export function unpack2x16unormInterval(n: number): FPVector {
  return FP.f32.unpack2x16unormInterval(n);
}

export function unpack4x8snormInterval(n: number): FPVector {
  return FP.f32.unpack4x8snormInterval(n);
}

export function unpack4x8unormInterval(n: number): FPVector {
  return FP.f32.unpack4x8unormInterval(n);
}
