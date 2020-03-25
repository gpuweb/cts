import { assert } from '../../common/framework/index.js';

export function floatAsNormalizedInteger(float: number, bits: number, signed: boolean): number {
  if (signed) {
    assert(float >= -1 && float <= 1);
    const min = -Math.pow(2, bits - 1);
    const max = Math.pow(2, bits - 1) - 1;
    if (float >= 0) {
      return Math.round(float * max);
    } else {
      return Math.round(Math.abs(float) * min);
    }
  } else {
    assert(float >= 0 && float <= 1);
    const max = Math.pow(2, bits) - 1;
    return Math.round(float * max);
  }
}

// Does not handle clamping, underflow, overflow, denormalized numbers
export function float32ToFloatBits(
  n: number,
  signBits: 0 | 1,
  exponentBits: number,
  fractionBits: number,
  bias: number
): number {
  assert(exponentBits <= 8);
  assert(fractionBits <= 23);
  assert(Number.isFinite(n));

  if (n === 0) {
    return 0;
  }

  if (signBits === 0) {
    assert(n >= 0);
  }

  const buf = new DataView(new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT));
  buf.setFloat32(0, n, true);
  const bits = buf.getUint32(0, true);
  // bits (32): seeeeeeeefffffffffffffffffffffff

  const fractionBitsToDiscard = 23 - fractionBits;

  // 0 or 1
  const sign = (bits >> 31) & signBits;

  // >> to remove fraction, & to remove sign.
  const exp = (bits >> 23) & 0xff;

  // Convert to the new biased exponent.
  const newExp = exp - (127 - bias);

  // Mask only the fraction, and discard the lower bits.
  const newFraction = (bits & 0x7fffff) >> fractionBitsToDiscard;
  return (sign << (exponentBits + fractionBits)) | (newExp << fractionBits) | newFraction;
}

export function assertInIntegerRange(n: number, bits: number, signed: boolean): void {
  if (signed) {
    const min = -Math.pow(2, bits - 1);
    const max = Math.pow(2, bits - 1) - 1;
    assert(n >= min && n <= max);
  } else {
    const max = Math.pow(2, bits) - 1;
    assert(n >= 0 && n <= max);
  }
}

export function gammaCompress(n: number): number {
  n = n <= 0.0031308 ? 12.92 * n : 1.055 * Math.pow(n, 1 / 2.4) - 0.055;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
