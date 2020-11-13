import { assert } from '../../common/framework/util/util.js';

export function floatAsNormalizedInteger(float: number, bits: number, signed: boolean): number {
  if (signed) {
    assert(float >= -1 && float <= 1);
    const max = Math.pow(2, bits - 1) - 1;
    return Math.round(float * max);
  } else {
    assert(float >= 0 && float <= 1);
    const max = Math.pow(2, bits) - 1;
    return Math.round(float * max);
  }
}

export function normalizedIntegerAsFloat(integer: number, bits: number, signed: boolean): number {
  if (signed) {
    const max = Math.pow(2, bits - 1) - 1;
    assert(integer >= -max - 1 && integer <= max);
    if (integer === -max - 1) {
      integer = -max;
    }
    return integer / max;
  } else {
    const max = Math.pow(2, bits) - 1;
    assert(integer >= 0 && integer <= max);
    return integer / max;
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

  // >> to remove fraction, & to remove sign, - 127 to remove bias.
  const exp = ((bits >> 23) & 0xff) - 127;

  // Convert to the new biased exponent.
  const newBiasedExp = bias + exp;
  assert(newBiasedExp >= 0 && newBiasedExp < 1 << exponentBits);

  // Mask only the fraction, and discard the lower bits.
  const newFraction = (bits & 0x7fffff) >> fractionBitsToDiscard;
  return (sign << (exponentBits + fractionBits)) | (newBiasedExp << fractionBits) | newFraction;
}

// Three partial-precision floating-point numbers encoded into a single 32-bit value all
// sharing the same 5-bit exponent (variant of s10e5, which is sign bit, 10-bit mantissa,
// and 5-bit biased (15) exponent).
// There is no sign bit, and there is a shared 5-bit biased (15) exponent and a 9-bit
// mantissa for each channel.
export function encodeRGB9E5UFloat(r: number, g: number, b: number): number {
  assert(r >= 0 && g >= 0 && b >= 0);
  if (r === 0 && g === 0 && b === 0) {
    return 0;
  }

  const bias = 15;
  const fractionBits = 9;
  const exponentMask = 0b11111;

  const buf = new DataView(new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT));

  buf.setFloat32(0, r, true);
  const rBits = buf.getUint32(0, true);

  buf.setFloat32(0, g, true);
  const gBits = buf.getUint32(0, true);

  buf.setFloat32(0, b, true);
  const bBits = buf.getUint32(0, true);

  // >> to remove fraction, & to remove sign, - 127 to remove bias.
  let rExp = ((rBits >> 23) & 0xff) - 127;
  let gExp = ((gBits >> 23) & 0xff) - 127;
  let bExp = ((bBits >> 23) & 0xff) - 127;

  const fractionBitsToDiscard = 23 - fractionBits;

  let rFrac = (rBits & 0x7fffff) >> fractionBitsToDiscard;
  let gFrac = (gBits & 0x7fffff) >> fractionBitsToDiscard;
  let bFrac = (bBits & 0x7fffff) >> fractionBitsToDiscard;

  // RGB9E5UFloat does not have the implicit 1, so we need to add it to
  // the fraction and bump the exponent.
  rFrac = (rFrac >> 1) | 0b100000000;
  bFrac = (bFrac >> 1) | 0b100000000;
  gFrac = (gFrac >> 1) | 0b100000000;
  rExp += 1;
  gExp += 1;
  bExp += 1;

  // Start with the exponent of a non-zero component
  let exp = 0;
  if (r !== 0) exp = rExp;
  if (g !== 0) exp = gExp;
  if (b !== 0) exp = bExp;

  // Then get the smallest exponent
  if (r !== 0) exp = Math.min(exp, rExp);
  if (g !== 0) exp = Math.min(exp, gExp);
  if (b !== 0) exp = Math.min(exp, bExp);

  const biasedExp = (exp + bias) & exponentMask;
  return rFrac | (gFrac << 9) | (bFrac << 18) | (biasedExp << 27);
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
  n = n <= 0.0031308 ? (323 * n) / 25 : (211 * Math.pow(n, 5 / 12) - 11) / 200;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export function gammaDecompress(n: number): number {
  n = n <= 0.04045 ? (n * 25) / 323 : Math.pow((200 * n + 11) / 211, 12 / 5);
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
