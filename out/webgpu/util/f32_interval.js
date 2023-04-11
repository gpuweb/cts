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

export function isF32Matrix(
m)
{
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

export function additionMatrixInterval(x, y) {
  return FP.f32.additionMatrixInterval(x, y);
}

export function determinantInterval(m) {
  return FP.f32.determinantInterval(m);
}

export function faceForwardIntervals(
x,
y,
z)
{
  return FP.f32.faceForwardIntervals(x, y, z);
}

export function modfInterval(n) {
  return FP.f32.modfInterval(n);
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

export function refractInterval(i, s, r) {
  return FP.f32.refractInterval(i, s, r);
}

export function subtractionMatrixInterval(x, y) {
  return FP.f32.subtractionMatrixInterval(x, y);
}

export function transposeInterval(m) {
  return FP.f32.transposeInterval(m);
}
//# sourceMappingURL=f32_interval.js.map