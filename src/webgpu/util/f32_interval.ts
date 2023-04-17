// This is a shim file with all the old/deprecated f32 API calls.
// They currently just pass-through to the refactored FPContext implementation.
// As CTS migrates over to directly calling the new API, these will be removed.

import { FPInterval, FPMatrix, FPVector, IntervalBounds, FP } from './floating_point.js';

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

export function absoluteErrorInterval(n: number, error_range: number): FPInterval {
  return FP.f32.absoluteErrorInterval(n, error_range);
}

export function ulpInterval(n: number, numULP: number): FPInterval {
  return FP.f32.ulpInterval(n, numULP);
}

export function faceForwardIntervals(
  x: number[],
  y: number[],
  z: number[]
): (FPVector | undefined)[] {
  return FP.f32.faceForwardIntervals(x, y, z);
}

export function modfInterval(n: number): { fract: FPInterval; whole: FPInterval } {
  return FP.f32.modfInterval(n);
}

export function refractInterval(i: number[], s: number[], r: number): FPVector {
  return FP.f32.refractInterval(i, s, r);
}
