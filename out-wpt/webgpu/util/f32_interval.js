/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ // This is a shim file with all the old/deprecated f32 API calls.
// They currently just pass-through to the refactored FPContext implementation.
// As CTS migrates over to directly calling the new API, these will be removed.
import { FP } from './floating_point.js';
// Interfaces

// Utilities

export function toF32Interval(n) {
  return FP.f32.toInterval(n);
}

export function isF32Vector(v) {
  return FP.f32.isVector(v);
}

export function toF32Vector(v) {
  return FP.f32.toVector(v);
}

export function spanF32Intervals(...intervals) {
  return FP.f32.spanIntervals(...intervals);
}

export function isF32Matrix(m) {
  return FP.f32.isMatrix(m);
}

export function toF32Matrix(m) {
  return FP.f32.toMatrix(m);
}

// Accuracy Interval

export function correctlyRoundedInterval(n) {
  return FP.f32.correctlyRoundedInterval(n);
}

export function correctlyRoundedMatrix(m) {
  return FP.f32.correctlyRoundedMatrix(m);
}

export function absoluteErrorInterval(n, error_range) {
  return FP.f32.absoluteErrorInterval(n, error_range);
}

export function ulpInterval(n, numULP) {
  return FP.f32.ulpInterval(n, numULP);
}

export function additionInterval(x, y) {
  return FP.f32.additionInterval(x, y);
}

export function additionMatrixInterval(x, y) {
  return FP.f32.additionMatrixInterval(x, y);
}

export function atan2Interval(y, x) {
  return FP.f32.atan2Interval(y, x);
}

export const clampIntervals = FP.f32.clampIntervals;

export function clampMedianInterval(x, y, z) {
  return FP.f32.clampMedianInterval(x, y, z);
}

export function clampMinMaxInterval(x, y, z) {
  return FP.f32.clampMinMaxInterval(x, y, z);
}

export function crossInterval(x, y) {
  return FP.f32.crossInterval(x, y);
}

export function determinantInterval(m) {
  return FP.f32.determinantInterval(m);
}

export function distanceInterval(x, y) {
  return FP.f32.distanceInterval(x, y);
}

export function divisionInterval(x, y) {
  return FP.f32.divisionInterval(x, y);
}

export function dotInterval(x, y) {
  return FP.f32.dotInterval(x, y);
}

export function faceForwardIntervals(x, y, z) {
  return FP.f32.faceForwardIntervals(x, y, z);
}

export function fmaInterval(x, y, z) {
  return FP.f32.fmaInterval(x, y, z);
}

export function ldexpInterval(e1, e2) {
  return FP.f32.ldexpInterval(e1, e2);
}

export function lengthInterval(n) {
  return FP.f32.lengthInterval(n);
}

export function maxInterval(x, y) {
  return FP.f32.maxInterval(x, y);
}

export function minInterval(x, y) {
  return FP.f32.minInterval(x, y);
}

export const mixIntervals = FP.f32.mixIntervals;

export function mixImpreciseInterval(x, y, z) {
  return FP.f32.mixImpreciseInterval(x, y, z);
}

export function mixPreciseInterval(x, y, z) {
  return FP.f32.mixPreciseInterval(x, y, z);
}

export function modfInterval(n) {
  return FP.f32.modfInterval(n);
}

export function multiplicationInterval(x, y) {
  return FP.f32.multiplicationInterval(x, y);
}

export function multiplicationMatrixScalarInterval(mat, scalar) {
  return FP.f32.multiplicationMatrixScalarInterval(mat, scalar);
}

export function multiplicationScalarMatrixInterval(scalar, mat) {
  return FP.f32.multiplicationScalarMatrixInterval(scalar, mat);
}

export function multiplicationMatrixMatrixInterval(mat_x, mat_y) {
  return FP.f32.multiplicationMatrixMatrixInterval(mat_x, mat_y);
}

export function multiplicationMatrixVectorInterval(x, y) {
  return FP.f32.multiplicationMatrixVectorInterval(x, y);
}

export function multiplicationVectorMatrixInterval(x, y) {
  return FP.f32.multiplicationVectorMatrixInterval(x, y);
}

export function normalizeInterval(n) {
  return FP.f32.normalizeInterval(n);
}

export function powInterval(x, y) {
  return FP.f32.powInterval(x, y);
}

export function reflectInterval(x, y) {
  return FP.f32.reflectInterval(x, y);
}

export function refractInterval(i, s, r) {
  return FP.f32.refractInterval(i, s, r);
}

export function remainderInterval(x, y) {
  return FP.f32.remainderInterval(x, y);
}

export function smoothStepInterval(low, high, x) {
  return FP.f32.smoothStepInterval(low, high, x);
}

export function stepInterval(edge, x) {
  return FP.f32.stepInterval(edge, x);
}

export function subtractionInterval(x, y) {
  return FP.f32.subtractionInterval(x, y);
}

export function subtractionMatrixInterval(x, y) {
  return FP.f32.subtractionMatrixInterval(x, y);
}

export function transposeInterval(m) {
  return FP.f32.transposeInterval(m);
}

export function unpack2x16floatInterval(n) {
  return FP.f32.unpack2x16floatInterval(n);
}

export function unpack2x16snormInterval(n) {
  return FP.f32.unpack2x16snormInterval(n);
}

export function unpack2x16unormInterval(n) {
  return FP.f32.unpack2x16unormInterval(n);
}

export function unpack4x8snormInterval(n) {
  return FP.f32.unpack4x8snormInterval(n);
}

export function unpack4x8unormInterval(n) {
  return FP.f32.unpack4x8unormInterval(n);
}
