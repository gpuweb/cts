export const PositiveInf = 0x7f800000;
export const NegativeInf = 0xff800000;

export enum NumberType {
  Float,
  Int,
  Uint,
  Hex,
}

export type Case = {
  input: number;
  expected: number[];
};

export function float32ToUint32(f32: number): number {
  const f32Arr = new Float32Array(1);
  f32Arr[0] = f32;
  const u32Arr = new Uint32Array(f32Arr.buffer);
  return u32Arr[0];
}

export function uint32ToFloat32(u32: number): number {
  const u32Arr = new Uint32Array(1);
  u32Arr[0] = u32;
  const f32Arr = new Float32Array(u32Arr.buffer);
  return f32Arr[0];
}

export function float32ToInt32(f32: number): number {
  const f32Arr = new Float32Array(1);
  f32Arr[0] = f32;
  const i32Arr = new Int32Array(f32Arr.buffer);
  return i32Arr[0];
}

export function uint32ToInt32(u32: number): number {
  const u32Arr = new Uint32Array(1);
  u32Arr[0] = u32;
  const i32Arr = new Int32Array(u32Arr.buffer);
  return i32Arr[0];
}
