// This is a shim file with all the old/deprecated f32 API calls.
// They currently just pass-through to the refactored FPContext implementation.
// As CTS migrates over to directly calling the new API, these will be removed.

import { FPInterval, FPMatrix, FPVector, IntervalBounds, FP } from './floating_point.js';

// Interfaces

export interface PointToInterval {
  (x: number): FPInterval;
}

export interface BinaryToInterval {
  (x: number, y: number): FPInterval;
}

export interface TernaryToInterval {
  (x: number, y: number, z: number): FPInterval;
}

export interface PointToVector {
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

export function absInterval(n: number): FPInterval {
  return FP.f32.absInterval(n);
}

export function acosInterval(n: number): FPInterval {
  return FP.f32.acosInterval(n);
}

export const acoshIntervals = FP.f32.acoshIntervals;

export function acoshAlternativeInterval(x: number | FPInterval): FPInterval {
  return FP.f32.acoshAlternativeInterval(x);
}

export function acoshPrimaryInterval(x: number | FPInterval): FPInterval {
  return FP.f32.acoshPrimaryInterval(x);
}

export function additionInterval(x: number | FPInterval, y: number | FPInterval): FPInterval {
  return FP.f32.additionInterval(x, y);
}

export function additionMatrixInterval(x: number[][], y: number[][]): FPMatrix {
  return FP.f32.additionMatrixInterval(x, y);
}

export function asinInterval(n: number): FPInterval {
  return FP.f32.asinInterval(n);
}

export function asinhInterval(n: number): FPInterval {
  return FP.f32.asinhInterval(n);
}

export function atanInterval(n: number | FPInterval): FPInterval {
  return FP.f32.atanInterval(n);
}

export function atan2Interval(y: number | FPInterval, x: number | FPInterval): FPInterval {
  return FP.f32.atan2Interval(y, x);
}

export function atanhInterval(n: number): FPInterval {
  return FP.f32.atanhInterval(n);
}

export function ceilInterval(n: number): FPInterval {
  return FP.f32.ceilInterval(n);
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

export function cosInterval(n: number): FPInterval {
  return FP.f32.cosInterval(n);
}

export function coshInterval(n: number): FPInterval {
  return FP.f32.coshInterval(n);
}

export function crossInterval(x: number[], y: number[]): FPVector {
  return FP.f32.crossInterval(x, y);
}

export function degreesInterval(n: number): FPInterval {
  return FP.f32.degreesInterval(n);
}

export function determinantInterval(m: number[][]): FPInterval {
  return FP.f32.determinantInterval(m);
}

export function distanceInterval(x: number | number[], y: number | number[]): FPInterval {
  return FP.f32.distanceInterval(x, y);
}

export function divisionInterval(x: number | FPInterval, y: number | FPInterval): FPInterval {
  return FP.f32.divisionInterval(x, y);
}

export function dotInterval(x: number[] | FPInterval[], y: number[] | FPInterval[]): FPInterval {
  return FP.f32.dotInterval(x, y);
}

export function expInterval(x: number | FPInterval): FPInterval {
  return FP.f32.expInterval(x);
}

export function exp2Interval(x: number | FPInterval): FPInterval {
  return FP.f32.exp2Interval(x);
}

export function faceForwardIntervals(
  x: number[],
  y: number[],
  z: number[]
): (FPVector | undefined)[] {
  return FP.f32.faceForwardIntervals(x, y, z);
}

export function floorInterval(n: number): FPInterval {
  return FP.f32.floorInterval(n);
}

export function fmaInterval(x: number, y: number, z: number): FPInterval {
  return FP.f32.fmaInterval(x, y, z);
}

export function fractInterval(n: number): FPInterval {
  return FP.f32.fractInterval(n);
}

export function inverseSqrtInterval(n: number | FPInterval): FPInterval {
  return FP.f32.inverseSqrtInterval(n);
}

export function ldexpInterval(e1: number, e2: number): FPInterval {
  return FP.f32.ldexpInterval(e1, e2);
}

export function lengthInterval(n: number | FPInterval | number[] | FPVector): FPInterval {
  return FP.f32.lengthInterval(n);
}

export function logInterval(x: number | FPInterval): FPInterval {
  return FP.f32.logInterval(x);
}

export function log2Interval(x: number | FPInterval): FPInterval {
  return FP.f32.log2Interval(x);
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

export function multiplicationInterval(x: number | FPInterval, y: number | FPInterval): FPInterval {
  return FP.f32.multiplicationInterval(x, y);
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

export function negationInterval(n: number): FPInterval {
  return FP.f32.negationInterval(n);
}

export function normalizeInterval(n: number[]): FPVector {
  return FP.f32.normalizeInterval(n);
}

export function powInterval(x: number | FPInterval, y: number | FPInterval): FPInterval {
  return FP.f32.powInterval(x, y);
}

export function quantizeToF16Interval(n: number): FPInterval {
  return FP.f32.quantizeToF16Interval(n);
}

export function radiansInterval(n: number): FPInterval {
  return FP.f32.radiansInterval(n);
}

export function reflectInterval(x: number[], y: number[]): FPVector {
  return FP.f32.reflectInterval(x, y);
}

export function refractInterval(i: number[], s: number[], r: number): FPVector {
  return FP.f32.refractInterval(i, s, r);
}

export function remainderInterval(x: number, y: number): FPInterval {
  return FP.f32.remainderInterval(x, y);
}

export function roundInterval(n: number): FPInterval {
  return FP.f32.roundInterval(n);
}

export function saturateInterval(n: number): FPInterval {
  return FP.f32.saturateInterval(n);
}

export function signInterval(n: number): FPInterval {
  return FP.f32.signInterval(n);
}

export function sinInterval(n: number): FPInterval {
  return FP.f32.sinInterval(n);
}

export function sinhInterval(n: number): FPInterval {
  return FP.f32.sinhInterval(n);
}

export function smoothStepInterval(low: number, high: number, x: number): FPInterval {
  return FP.f32.smoothStepInterval(low, high, x);
}

export function sqrtInterval(n: number | FPInterval): FPInterval {
  return FP.f32.sqrtInterval(n);
}

export function stepInterval(edge: number, x: number): FPInterval {
  return FP.f32.stepInterval(edge, x);
}

export function subtractionInterval(x: number | FPInterval, y: number | FPInterval): FPInterval {
  return FP.f32.subtractionInterval(x, y);
}

export function subtractionMatrixInterval(x: number[][], y: number[][]): FPMatrix {
  return FP.f32.subtractionMatrixInterval(x, y);
}

export function tanInterval(n: number): FPInterval {
  return FP.f32.tanInterval(n);
}

export function tanhInterval(n: number): FPInterval {
  return FP.f32.tanhInterval(n);
}

export function transposeInterval(m: number[][]): FPMatrix {
  return FP.f32.transposeInterval(m);
}

export function truncInterval(n: number | FPInterval): FPInterval {
  return FP.f32.truncInterval(n);
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
