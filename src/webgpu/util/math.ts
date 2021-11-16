import { assert } from '../../common/util/util.js';
import { kBit } from '../shader/execution/builtin/builtin.js';

/**
 * A multiple of 8 guaranteed to be way too large to allocate (just under 8 pebibytes).
 * This is a "safe" integer (ULP <= 1.0) very close to MAX_SAFE_INTEGER.
 *
 * Note: allocations of this size are likely to exceed limitations other than just the system's
 * physical memory, so test cases are also needed to try to trigger "true" OOM.
 */
export const kMaxSafeMultipleOf8 = Number.MAX_SAFE_INTEGER - 7;

/** Round `n` up to the next multiple of `alignment` (inclusive). */
// TODO: Rename to `roundUp`
export function align(n: number, alignment: number): number {
  assert(Number.isInteger(n) && n >= 0, 'n must be a non-negative integer');
  assert(Number.isInteger(alignment) && alignment > 0, 'alignment must be a positive integer');
  return Math.ceil(n / alignment) * alignment;
}

/** Round `n` down to the next multiple of `alignment` (inclusive). */
export function roundDown(n: number, alignment: number): number {
  assert(Number.isInteger(n) && n >= 0, 'n must be a non-negative integer');
  assert(Number.isInteger(alignment) && alignment > 0, 'alignment must be a positive integer');
  return Math.floor(n / alignment) * alignment;
}

/** Clamp a number to the provided range. */
export function clamp(n: number, { min, max }: { min: number; max: number }): number {
  assert(max >= min);
  return Math.min(Math.max(n, min), max);
}

/**
 * @returns true if value is a zero like, otherwise false.
 */
function isZero(x: number): boolean {
  return (
    x === kBit.f32.positive.zero ||
    x === 0x00000000 ||
    x === kBit.f32.positive.min ||
    x === kBit.f32.negative.zero ||
    x === 0x80000000 ||
    x === kBit.f32.negative.max
  );
}

/**
 * @returns the Units of Last Place difference between the numbers a and b.
 * If either `a` or `b` are not finite numbers, then diffULP() returns Infinity.
 */
export function diffULP(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return Infinity;
  }
  const arr = new Uint32Array(new Float32Array([a, b]).buffer);
  let u32_a = arr[0];
  let u32_b = arr[1];

  // Handle zero value edge cases.
  // If both values are a type of zero, then they are equal, so return 0.
  // If only one value is a zero, adjust it to be the closest value to zero with
  // the same sign as the other value, so that there doesn't need to be a bunch of special logic below.
  if (isZero(u32_a) && isZero(u32_b)) {
    return 0;
  } else if (isZero(a) && !isZero(b)) {
    u32_a = (b & 0x80000000) !== 0 ? kBit.f32.positive.min : kBit.f32.negative.max;
  } else if (!isZero(a) && isZero(b)) {
    u32_b = (a & 0x80000000) !== 0 ? kBit.f32.positive.min : kBit.f32.negative.max;
  }

  const sign_a = (u32_a & 0x80000000) !== 0;
  const sign_b = (u32_b & 0x80000000) !== 0;
  const masked_a = u32_a & 0x7fffffff;
  const masked_b = u32_b & 0x7fffffff;

  if (sign_a === sign_b) {
    return Math.max(masked_a, masked_b) - Math.min(masked_a, masked_b);
  }
  return masked_a + masked_b;
}
