/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ // This is a shim file with all the old/deprecated f32 API calls.
// They currently just pass-through to the refactored FPContext implementation.
// As CTS migrates over to directly calling the new API, these will be removed.
import { FP } from './floating_point.js';
// Containers

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

export function absoluteErrorInterval(n, error_range) {
  return FP.f32.absoluteErrorInterval(n, error_range);
}

export function ulpInterval(n, numULP) {
  return FP.f32.ulpInterval(n, numULP);
}

export function faceForwardIntervals(x, y, z) {
  return FP.f32.faceForwardIntervals(x, y, z);
}

export function modfInterval(n) {
  return FP.f32.modfInterval(n);
}

export function refractInterval(i, s, r) {
  return FP.f32.refractInterval(i, s, r);
}
