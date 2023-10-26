import { assert } from '../../common/util/util.js';
import { Float16Array } from '../../external/petamoriken/float16/float16.js';

import { align } from './math.js';

/**
 * BinaryStream is a utility to efficiently encode and decode numbers to / from a Uint8Array.
 * BinaryStream uses a number of internal typed arrays to avoid small array allocations when reading
 * and writing.
 */
export default class BinaryStream {
  /**
   * Constructor
   * @param buffer the buffer to read from / write to. Array length must be a multiple of 8 bytes.
   */
  constructor(buffer: Uint8Array) {
    this.offset = 0;
    this.u8 = buffer;
    this.u16 = new Uint16Array(this.u8.buffer);
    this.u32 = new Uint32Array(this.u8.buffer);
    this.i8 = new Int8Array(this.u8.buffer);
    this.i16 = new Int16Array(this.u8.buffer);
    this.i32 = new Int32Array(this.u8.buffer);
    this.f16 = new Float16Array(this.u8.buffer);
    this.f32 = new Float32Array(this.u8.buffer);
    this.f64 = new Float64Array(this.u8.buffer);
  }

  /** buffer() returns the stream's buffer sliced to the 8-byte rounded read or write offset */
  buffer(): Uint8Array {
    return this.u8.slice(0, align(this.offset, 8));
  }

  /** writeBool() writes a boolean as 255 or 0 to the buffer at the next byte offset */
  writeBool(value: boolean) {
    this.u8[this.offset++] = value ? 255 : 0;
  }

  /** readBool() reads a boolean from the buffer at the next byte offset */
  readBool(): boolean {
    const val = this.u8[this.offset++];
    assert(val === 0 || val === 255);
    return val !== 0;
  }

  /** writeU8() writes a uint8 to the buffer at the next byte offset */
  writeU8(value: number) {
    this.u8[this.offset++] = value;
  }

  /** readU8() reads a uint8 from the buffer at the next byte offset */
  readU8(): number {
    return this.u8[this.offset++];
  }

  /** u8View() returns a Uint8Array view of the uint8 at the next byte offset */
  u8View(): Uint8Array {
    const at = this.offset++;
    return new Uint8Array(this.u8.buffer, at, 1);
  }

  /** writeU16() writes a uint16 to the buffer at the next 16-bit aligned offset */
  writeU16(value: number) {
    this.u16[this.bumpWord(2)] = value;
  }

  /** readU16() reads a uint16 from the buffer at the next 16-bit aligned offset */
  readU16(): number {
    return this.u16[this.bumpWord(2)];
  }

  /** u16View() returns a Uint16Array view of the uint16 at the next 16-bit aligned offset */
  u16View(): Uint16Array {
    const at = this.bumpWord(2);
    return new Uint16Array(this.u16.buffer, at * 2, 1);
  }

  /** writeU32() writes a uint32 to the buffer at the next 32-bit aligned offset */
  writeU32(value: number) {
    this.u32[this.bumpWord(4)] = value;
  }

  /** readU32() reads a uint32 from the buffer at the next 32-bit aligned offset */
  readU32(): number {
    return this.u32[this.bumpWord(4)];
  }

  /** u32View() returns a Uint32Array view of the uint32 at the next 32-bit aligned offset */
  u32View(): Uint32Array {
    const at = this.bumpWord(4);
    return new Uint32Array(this.u32.buffer, at * 4, 1);
  }

  /** writeI8() writes a int8 to the buffer at the next byte offset */
  writeI8(value: number) {
    this.i8[this.offset++] = value;
  }

  /** readI8() reads a int8 from the buffer at the next byte offset */
  readI8(): number {
    return this.i8[this.offset++];
  }

  /** i8View() returns a Uint8Array view of the uint8 at the next byte offset */
  i8View(): Int8Array {
    const at = this.offset++;
    return new Int8Array(this.i8.buffer, at, 1);
  }

  /** writeI16() writes a int16 to the buffer at the next 16-bit aligned offset */
  writeI16(value: number) {
    this.i16[this.bumpWord(2)] = value;
  }

  /** readI16() reads a int16 from the buffer at the next 16-bit aligned offset */
  readI16(): number {
    return this.i16[this.bumpWord(2)];
  }

  /** i16View() returns a Int16Array view of the uint16 at the next 16-bit aligned offset */
  i16View(): Int16Array {
    const at = this.bumpWord(2);
    return new Int16Array(this.i16.buffer, at * 2, 1);
  }

  /** writeI32() writes a int32 to the buffer at the next 32-bit aligned offset */
  writeI32(value: number) {
    this.i32[this.bumpWord(4)] = value;
  }

  /** readI32() reads a int32 from the buffer at the next 32-bit aligned offset */
  readI32(): number {
    return this.i32[this.bumpWord(4)];
  }

  /** i32View() returns a Int32Array view of the uint32 at the next 32-bit aligned offset */
  i32View(): Int32Array {
    const at = this.bumpWord(4);
    return new Int32Array(this.i32.buffer, at * 4, 1);
  }

  /** writeF16() writes a float16 to the buffer at the next 16-bit aligned offset */
  writeF16(value: number) {
    this.f16[this.bumpWord(2)] = value;
  }

  /** readF16() reads a float16 from the buffer at the next 16-bit aligned offset */
  readF16(): number {
    return this.f16[this.bumpWord(2)];
  }

  /** f16View() returns a Float16Array view of the uint16 at the next 16-bit aligned offset */
  f16View(): Float16Array {
    const at = this.bumpWord(2);
    return new Float16Array(this.f16.buffer, at * 2, 1);
  }

  /** writeF32() writes a float32 to the buffer at the next 32-bit aligned offset */
  writeF32(value: number) {
    this.f32[this.bumpWord(4)] = value;
  }

  /** readF32() reads a float32 from the buffer at the next 32-bit aligned offset */
  readF32(): number {
    return this.f32[this.bumpWord(4)];
  }

  /** f32View() returns a Float32Array view of the uint32 at the next 32-bit aligned offset */
  f32View(): Float32Array {
    const at = this.bumpWord(4);
    return new Float32Array(this.f32.buffer, at * 4, 1);
  }

  /** writeF64() writes a float64 to the buffer at the next 64-bit aligned offset */
  writeF64(value: number) {
    this.f64[this.bumpWord(8)] = value;
  }

  /** readF64() reads a float64 from the buffer at the next 64-bit aligned offset */
  readF64(): number {
    return this.f64[this.bumpWord(8)];
  }

  /** f64View() returns a Float64Array view of the uint64 at the next 64-bit aligned offset */
  f64View(): Float64Array {
    const at = this.bumpWord(8);
    return new Float64Array(this.f64.buffer, at * 8, 1);
  }

  /**
   * writeString() writes a length-prefixed UTF-16 string to the buffer at the next 32-bit aligned
   * offset
   */
  writeString(value: string) {
    this.writeU32(value.length);
    for (let i = 0; i < value.length; i++) {
      this.writeU16(value.charCodeAt(i));
    }
  }

  /**
   * readString() writes a length-prefixed UTF-16 string from the buffer at the next 32-bit aligned
   * offset
   */
  readString(): string {
    const len = this.readU32();
    const codes = new Array<number>(len);
    for (let i = 0; i < len; i++) {
      codes[i] = this.readU16();
    }
    return String.fromCharCode(...codes);
  }

  /**
   * writeArray() writes a length-prefixed array of T elements to the buffer at the next 32-bit
   * aligned offset, using the provided callback to write the individual elements
   */
  writeArray<T>(value: readonly T[], writeElement: (s: BinaryStream, element: T) => void) {
    this.writeU32(value.length);
    for (const element of value) {
      writeElement(this, element);
    }
  }

  /**
   * readArray() reads a length-prefixed array of T elements from the buffer at the next 32-bit
   * aligned offset, using the provided callback to read the individual elements
   */
  readArray<T>(readElement: (s: BinaryStream) => T): T[] {
    const len = this.readU32();
    const array = new Array<T>(len);
    for (let i = 0; i < len; i++) {
      array[i] = readElement(this);
    }
    return array;
  }

  /**
   * writeCond() writes the boolean condition `cond` to the buffer, then either calls if_true if
   * `cond` is true, otherwise if_false
   */
  writeCond<T, F>(cond: boolean, fns: { if_true: () => T; if_false: () => F }) {
    this.writeBool(cond);
    if (cond) {
      return fns.if_true();
    } else {
      return fns.if_false();
    }
  }

  /**
   * readCond() reads a boolean condition from the buffer, then either calls if_true if
   * the condition was is true, otherwise if_false
   */
  readCond<T, F>(fns: { if_true: () => T; if_false: () => F }) {
    if (this.readBool()) {
      return fns.if_true();
    } else {
      return fns.if_false();
    }
  }

  /**
   * bumpWord() increments this.offset by `bytes`, after first aligning this.offset to `bytes`.
   * @returns the old offset aligned to the next multiple of `bytes`, divided by `bytes`.
   */
  private bumpWord(bytes: number) {
    const multiple = Math.floor((this.offset + bytes - 1) / bytes);
    this.offset = (multiple + 1) * bytes;
    return multiple;
  }

  private offset: number;
  private u8: Uint8Array;
  private u16: Uint16Array;
  private u32: Uint32Array;
  private i8: Int8Array;
  private i16: Int16Array;
  private i32: Int32Array;
  private f16: Float16Array;
  private f32: Float32Array;
  private f64: Float64Array;
}
