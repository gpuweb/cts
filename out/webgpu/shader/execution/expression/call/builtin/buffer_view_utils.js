/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/import { iterRange, typedArrayParam,
  typedArrayFromParam } from

'../../../../../../common/util/util.js';

import {
  Type,

  ArrayType,
  MatrixType,
  VectorType } from
'../../../../../util/conversion.js';

export const kBufferSizes = [128, 256, 512, 1024];
export const kOffsets = [0, 1, 2, 3, 4, 8, 12, 16, 32, 100, 156, 480, 768];
export const kSizes = [...kBufferSizes, 32, 48, 64];
export const kCalls = ['unsized', 'sized', 'sized_indirect', 'sized_sized_indirect'];











/**
 * Return true if the case is valid
 *
 * @param type The testcase
 * @param offset The offset to the view call
 * @param size The size to the view call
 * @param bufferSize The size of the buffer
 * @returns true if case is valid.
 */
export function isValidArrayLengthCase(
type,
offset,
size,
bufferSize)
{
  if (size === 0) {
    // bufferView case
    return offset + (type.arrayOffset ?? 0) + type.stride <= bufferSize;
  } else {
    // bufferArrayView case
    if ((type.arrayOffset ?? 0) + type.stride > size) {
      return false;
    }
    return offset + size <= bufferSize;
  }
}

/**
 * Calculates the return length in elements
 *
 * @param type The testcase
 * @param offset The offset to the view call
 * @param size The size to the view call
 * @param bufferSize The buffer size
 * @returns The number of elements in the arrayLength call
 */
export function calculateArrayLength(
type,
offset,
size,
bufferSize)
{
  const alignOffset = offset & ~(type.align - 1);
  if (size === 0) {
    // bufferView case
    return Math.floor((bufferSize - alignOffset - (type.arrayOffset ?? 0)) / type.stride);
  } else {
    // bufferArrayView case
    return Math.floor((size - (type.arrayOffset ?? 0)) / type.stride);
  }
}

export const kStructDecls = `
struct S {
  a: vec4u,
  b: u32,
}
struct T {
  a : u32,
  b : array<u32, 5>
}
struct S_arr {
  a : vec4u,
  b : array<u32>,
}
struct T_arr {
  a : S,
  b : array<T>,
}
`;

export const kArrayLengthTypes = {
  // Scalars and vectors
  u32: {
    type: 'array<u32>',
    align: 4,
    stride: 4,
    uniformStdLayout: true
  },
  vec2f: {
    type: 'array<vec2f>',
    align: 8,
    stride: 8,
    uniformStdLayout: true
  },
  vec3i: {
    type: 'array<vec3i>',
    align: 16,
    stride: 16
  },
  vec4u: {
    type: 'array<vec4u>',
    align: 16,
    stride: 16
  },
  f16: {
    type: 'array<f16>',
    align: 2,
    stride: 2,
    f16: true,
    uniformStdLayout: true
  },
  vec2h: {
    type: 'array<vec2h>',
    align: 4,
    stride: 4,
    f16: true,
    uniformStdLayout: true
  },
  vec3h: {
    type: 'array<vec3h>',
    align: 8,
    stride: 8,
    f16: true,
    uniformStdLayout: true
  },
  vec4h: {
    type: 'array<vec4h>',
    align: 8,
    stride: 8,
    f16: true,
    uniformStdLayout: true
  },
  // Matrices
  mat2x2f: {
    type: 'array<mat2x2f>',
    align: 8,
    stride: 16
  },
  mat2x3f: {
    type: 'array<mat2x3f>',
    align: 16,
    stride: 32
  },
  mat2x4f: {
    type: 'array<mat2x4f>',
    align: 16,
    stride: 32
  },
  mat4x2f: {
    type: 'array<mat4x2f>',
    align: 8,
    stride: 32
  },
  mat4x3f: {
    type: 'array<mat4x3f>',
    align: 16,
    stride: 64
  },
  mat4x4f: {
    type: 'array<mat4x4f>',
    align: 16,
    stride: 64
  },
  mat3x2h: {
    type: 'array<mat3x2h>',
    align: 4,
    stride: 12,
    f16: true
  },
  mat3x3h: {
    type: 'array<mat3x3h>',
    align: 8,
    stride: 24,
    f16: true,
    uniformStdLayout: true
  },
  mat3x4h: {
    type: 'array<mat3x4h>',
    align: 8,
    stride: 24,
    f16: true,
    uniformStdLayout: true
  },
  // Structs without arrays
  S: {
    type: 'array<S>',
    align: 16,
    stride: 32
  },
  T: {
    type: 'array<T>',
    align: 4,
    stride: 24,
    uniformStdLayout: true
  },
  // Sized arrays
  array_u32_4: {
    type: 'array<array<u32, 4>>',
    align: 4,
    stride: 16,
    uniformStdLayout: true
  },
  array_f16_6: {
    type: 'array<array<f16, 6>>',
    align: 2,
    stride: 12,
    f16: true,
    uniformStdLayout: true
  },
  array_vec2f_2: {
    type: 'array<array<vec2f, 2>>',
    align: 8,
    stride: 16,
    uniformStdLayout: true
  },
  array_S_2: {
    type: 'array<array<S, 2>>',
    align: 16,
    stride: 64
  },
  array_T_2: {
    type: 'array<array<T, 2>>',
    align: 4,
    stride: 48
  },
  // Structs with runtime arrays
  S_arr: {
    type: 'S_arr',
    access: '.b',
    align: 16,
    stride: 4,
    arrayOffset: 16
  },
  T_arr: {
    type: 'T_arr',
    access: '.b',
    align: 16,
    stride: 24,
    arrayOffset: 32
  }
};

/**
 * Run arrayLength tests for bufferView and bufferArrayView
 *
 * @param t The test
 * @param wgsl The shader code. Interface requirements:
 *             * Overrides:
 *               * wgx: workgroup size x
 *               * bufferSize: size of the buffer
 *             * (0, 0): input buffer with 'usage' usage
 *             * (0, 1): read-only-storage-buffer for offsets
 *             * (0, 2): read-only-storage-buffer for sizes
 *             * (0, 3): storage-buffer for output
 * @param usage The test buffer usage
 * @param bufferSize The size of the test buffer
 * @param dynOffset The size of the dynamic offset for the test buffer
 * @param offsets The values for the offset buffer
 * @param sizes The values for the size buffer
 * @param values The expected results
 */
export function runLengthTest(
t,
wgsl,
usage,
bufferSize,
dynOffset,
offsets,
sizes,
values)
{
  const fullBufferSize = bufferSize + dynOffset;
  const inputBuffer = t.createBufferTracked({
    size: fullBufferSize,
    usage
  });
  const offsetBuffer = t.makeBufferWithContents(
    new Uint32Array(offsets),
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  );
  const sizeBuffer = t.makeBufferWithContents(
    new Uint32Array(sizes),
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  );
  const outputBuffer = t.createBufferTracked({
    size: values.length * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
  });

  const bgLayout = t.device.createBindGroupLayout({
    entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {
        type: usage === GPUBufferUsage.UNIFORM ? 'uniform' : 'read-only-storage',
        hasDynamicOffset: dynOffset !== 0
      }
    },
    {
      binding: 1,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {
        type: 'read-only-storage'
      }
    },
    {
      binding: 2,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {
        type: 'read-only-storage'
      }
    },
    {
      binding: 3,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {
        type: 'storage'
      }
    }]

  });

  // Limit the number of invocations per workgroup to 128 to fit the default compat limits. Launch extra workgroups to fit all the required invocations.
  const wgx = Math.min(values.length, 128);
  const num_wgs = Math.ceil(values.length / wgx);

  const pipelineLayout = t.device.createPipelineLayout({
    bindGroupLayouts: [bgLayout]
  });
  const pipeline = t.device.createComputePipeline({
    layout: pipelineLayout,
    compute: {
      module: t.device.createShaderModule({ code: wgsl }),
      constants: { wgx, bufferSize }
    }
  });

  const bg = t.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
    {
      binding: 0,
      resource: {
        buffer: inputBuffer,
        size: bufferSize
      }
    },
    {
      binding: 1,
      resource: {
        buffer: offsetBuffer
      }
    },
    {
      binding: 2,
      resource: {
        buffer: sizeBuffer
      }
    },
    {
      binding: 3,
      resource: {
        buffer: outputBuffer
      }
    }]

  });

  const encoder = t.device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bg, dynOffset === 0 ? [] : [dynOffset]);
  pass.dispatchWorkgroups(num_wgs, 1, 1);
  pass.end();
  t.queue.submit([encoder.finish()]);

  t.expectGPUBufferValuesEqual(outputBuffer, new Uint32Array(values));
}













export const kLayoutCases = {
  vec2u_align8: {
    type: 'S_vec2u_align',
    decl: 'struct S_vec2u_align { x : u32, y : vec2u, }',
    access: '.y[1]',
    align: 8,
    offset: 12,
    uniformStdLayoutArrayView: true
  },
  vec3u_align16: {
    type: 'S_vec3u_align',
    decl: 'struct S_vec3u_align { x : u32, y : vec3u, }',
    access: '.y[2]',
    align: 16,
    offset: 24
  },
  vec4u_align16: {
    type: 'S_vec4u_align',
    decl: 'struct S_vec4u_align { x : u32, y : vec4u, }',
    access: '.y[0]',
    align: 16,
    offset: 16
  },
  struct_align32: {
    type: 'S_align32',
    decl: 'struct S_align32 { x : u32, @align(32) y : u32, }',
    access: '.y',
    align: 32,
    offset: 32
  },
  vec2h_align4: {
    type: 'S_vec2h_align',
    decl: 'struct S_vec2h_align { x : f16, y : vec2h }',
    access: '.y[0]',
    align: 4,
    offset: 4,
    f16: true,
    uniformStdLayoutArrayView: true
  },
  vec3h_align8: {
    type: 'S_vec3h_align',
    decl: 'struct S_vec3h_align { x : f16, y : vec3h }',
    access: '.y.z',
    align: 8,
    offset: 12,
    f16: true,
    uniformStdLayoutArrayView: true
  },
  vec4h_align8: {
    type: 'S_vec4h_align',
    decl: 'struct S_vec4h_align { x : f16, y : vec4h }',
    access: '.y.z',
    align: 8,
    offset: 12,
    f16: true,
    uniformStdLayoutArrayView: true
  },
  vec3i_size12: {
    type: 'S_vec3i_size',
    decl: 'struct S_vec3i_size { x : vec3i, y : u32 }',
    access: '.y',
    align: 16,
    offset: 12
  },
  vec3h_size6: {
    type: 'S_vec3h_size',
    decl: 'struct S_vec3h_size { x : vec3h, y : f16, z : f16 }',
    access: '.z',
    align: 8,
    offset: 8,
    f16: true,
    uniformStdLayoutArrayView: true
  },
  size80: {
    type: 'S_size80',
    decl: 'struct S_size80 { @size(80) x : u32, y : u32 }',
    access: '.y',
    align: 4,
    offset: 80,
    uniformStdLayoutArrayView: true
  },
  mat2x2f_align8: {
    type: 'S_mat2x2f_align',
    decl: 'struct S_mat2x2f_align { x : u32, y : mat2x2f }',
    access: '.y[0][0]',
    align: 8,
    offset: 8,
    f32: true,
    uniformStdLayoutArrayView: true
  },
  mat3x3f_align16: {
    type: 'S_mat3x3f_align',
    decl: 'struct S_mat3x3f_align { x : u32, y : mat3x3f }',
    access: '.y[0][0]',
    align: 16,
    offset: 16,
    f32: true
  },
  mat4x4f_align16: {
    type: 'S_mat4x4f_align',
    decl: 'struct S_mat4x4f_align { x : u32, y : mat4x4f }',
    access: '.y[1][0]',
    align: 16,
    offset: 32,
    f32: true
  },
  mat3x2h_align4: {
    type: 'S_mat3x2h_align',
    decl: 'struct S_mat3x2h_align { x : f16, y : mat3x2h }',
    access: '.y[0][0]',
    align: 4,
    offset: 4,
    f16: true,
    uniformStdLayoutArrayView: true
  },
  mat4x3h_align8: {
    type: 'S_mat4x3h_align',
    decl: 'struct S_mat4x3h_align { x : f16, y : mat4x3h }',
    access: '.y[0][0]',
    align: 8,
    offset: 8,
    f16: true,
    uniformStdLayoutArrayView: true
  },
  mat2x4h_align8: {
    type: 'S_mat2x4h_align',
    decl: 'struct S_mat2x4h_align { x : f16, y : mat2x4h }',
    access: '.y[0][0]',
    align: 8,
    offset: 8,
    f16: true,
    uniformStdLayoutArrayView: true
  },
  mat2x2f_size: {
    type: 'S_mat2x2f_size',
    decl: 'struct S_mat2x2f_size { x : mat2x2f, y : u32 }',
    access: '.y',
    align: 8,
    offset: 16,
    uniformStdLayoutArrayView: true
  },
  mat3x2f_size: {
    type: 'S_mat3x2f_size',
    decl: 'struct S_mat3x2f_size { x : mat3x2f, y : u32 }',
    access: '.y',
    align: 8,
    offset: 24,
    uniformStdLayoutArrayView: true
  },
  mat2x3f_size: {
    type: 'S_mat2x3f_size',
    decl: 'struct S_mat2x3f_size { x : mat2x3f, y : u32 }',
    access: '.y',
    align: 16,
    offset: 32
  },
  mat3x3f_size: {
    type: 'S_mat3x3f_size',
    decl: 'struct S_mat3x3f_size { x : mat3x3f, y : u32 }',
    access: '.y',
    align: 16,
    offset: 48
  },
  mat2x4f_size: {
    type: 'S_mat2x4f_size',
    decl: 'struct S_mat2x4f_size { x : mat2x4f, y : u32 }',
    access: '.y',
    align: 16,
    offset: 32
  },
  mat3x4f_size: {
    type: 'S_mat3x4f_size',
    decl: 'struct S_mat3x4f_size { x : mat3x4f, y : u32 }',
    access: '.y',
    align: 16,
    offset: 48
  },
  mat2x2h_size: {
    type: 'S_mat2x2h_size',
    decl: 'struct S_mat2x2h_size { x : mat2x2h, y : f16 }',
    access: '.y',
    align: 4,
    offset: 8,
    f16: true,
    uniformStdLayoutArrayView: true
  },
  mat4x2h_size: {
    type: 'S_mat4x2h_size',
    decl: 'struct S_mat4x2h_size { x : mat4x2h, y : f16 }',
    access: '.y',
    align: 4,
    offset: 16,
    f16: true,
    uniformStdLayoutArrayView: true
  },
  mat2x3h_size: {
    type: 'S_mat2x3h_size',
    decl: 'struct S_mat2x3h_size { x : mat2x3h, y : f16 }',
    access: '.y',
    align: 8,
    offset: 16,
    f16: true,
    uniformStdLayoutArrayView: true
  },
  mat4x3h_size: {
    type: 'S_mat4x3h_size',
    decl: 'struct S_mat4x3h_size { x : mat4x3h, y : f16 }',
    access: '.y',
    align: 8,
    offset: 32,
    f16: true,
    uniformStdLayoutArrayView: true
  },
  mat2x4h_size: {
    type: 'S_mat2x4h_size',
    decl: 'struct S_mat2x4h_size { x : mat2x4h, y : f16 }',
    access: '.y',
    align: 8,
    offset: 16,
    f16: true,
    uniformStdLayoutArrayView: true
  },
  mat4x4h_size: {
    type: 'S_mat4x4h_size',
    decl: 'struct S_mat4x4h_size { x : mat4x4h, y : f16 }',
    access: '.y',
    align: 8,
    offset: 32,
    f16: true,
    uniformStdLayoutArrayView: true
  },
  struct_size_roundup: {
    type: 'S_struct_size_roundup',
    decl: `struct Inner { x : vec3u }
           struct S_struct_size_roundup { x : Inner, y : u32 }`,
    access: '.y',
    align: 16,
    offset: 16
  },
  struct_inner_size: {
    type: 'S_struct_inner_size',
    decl: `struct Inner { @size(112) x : u32 }
           struct S_struct_inner_size { x : Inner, y : u32 }`,
    access: '.y',
    align: 4,
    offset: 112,
    uniformStdLayoutArrayView: true
  },
  struct_inner_align: {
    type: 'S_struct_inner_align',
    decl: `struct Inner { @align(64) x : u32 }
           struct S_struct_inner_align { x : Inner, y : u32 }`,
    access: '.y',
    align: 64,
    offset: 64
  },
  struct_inner_size_and_align: {
    type: 'S_struct_inner_size_and_align',
    decl: `struct Inner { @align(32) @size(33) x : u32 }
           struct S_struct_inner_size_and_align { x : Inner, y : u32 }`,
    access: '.y',
    align: 32,
    offset: 64
  },
  struct_override_size: {
    type: 'S_struct_override_size',
    decl: `struct Inner { @size(32) x : u32 }
           struct S_struct_override_size { @size(64) x : Inner, y : u32 }`,
    access: '.y',
    align: 4,
    offset: 64,
    uniformStdLayoutArrayView: true
  },
  struct_double_align: {
    type: 'S_struct_double_align',
    decl: `struct Inner { x : u32, @align(32) y : u32 }
           struct S_struct_double_align { x : u32, @align(64) y : Inner }`,
    access: '.y.y',
    align: 64,
    offset: 96
  },
  array_stride_size: {
    type: 'array<S_stride, 4>',
    decl: 'struct S_stride { @size(16) x : u32 }',
    access: '[2].x',
    align: 4,
    offset: 32
  }
};

/**
 * Runs a read test for memory layouts from bufferView and bufferArrayView
 *
 * @param t The GPUTest
 * @param testcase the LayoutCase
 * @param wgsl the shader code
 *             * (0, 0) - uniform or storage buffer
 *             * (0, 1) - storage buffer
 * @param aspace the address space being tested
 * @param offset the offset to the view call
 */
export function runReadLayoutTest(
t,
testcase,
wgsl,
aspace,
offset)
{
  let usage = GPUBufferUsage.COPY_DST;
  if (aspace === 'uniform') {
    usage |= GPUBufferUsage.UNIFORM;
  } else {
    usage |= GPUBufferUsage.STORAGE;
  }

  const kBufferLength = 256;
  // Magic number is 42 in various representations.
  const inMagicNumber = testcase.f16 ? 0x5140 : testcase.f32 ? 0x42280000 : 42;
  const inputBuffer = t.makeBufferWithContents(
    new Uint32Array([
    ...iterRange(kBufferLength, (x) => {
      if (x * 4 === testcase.offset + offset) {
        return inMagicNumber;
      } else {
        return 0;
      }
    })]
    ),
    usage
  );

  const outputBuffer = t.createBufferTracked({
    size: 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
  });

  const pipeline = t.device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: t.device.createShaderModule({ code: wgsl })
    }
  });

  const bg = t.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
    {
      binding: 0,
      resource: {
        buffer: inputBuffer
      }
    },
    {
      binding: 1,
      resource: {
        buffer: outputBuffer
      }
    }]

  });

  const encoder = t.device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(1, 1, 1);
  pass.end();
  t.queue.submit([encoder.finish()]);

  t.expectGPUBufferValuesEqual(outputBuffer, new Uint32Array([42]));
}

/**
 * Runs a write test for memory layout from bufferView and bufferArrayView
 *
 * @param t The GPUTest
 * @param testcase the LayoutCase
 * @param wgsl The shader code
 *             * (0, 0) - a read-only storage buffer
 *             * (0, 1) - a read-write storage buffer
 * @param offset The offset for the view call
 */
export function runWriteLayoutTest(t, testcase, wgsl, offset) {
  const inputBuffer = t.makeBufferWithContents(
    new Uint32Array([42]),
    GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE
  );

  const outputBuffer = t.createBufferTracked({
    size: 256 * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
  });

  const pipeline = t.device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: t.device.createShaderModule({ code: wgsl })
    }
  });

  const bg = t.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
    {
      binding: 0,
      resource: {
        buffer: inputBuffer
      }
    },
    {
      binding: 1,
      resource: {
        buffer: outputBuffer
      }
    }]

  });

  const encoder = t.device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(1, 1, 1);
  pass.end();
  t.queue.submit([encoder.finish()]);

  // Magic number is 42 in various representations.
  const outMagicNumber = testcase.f16 ? 0x5140 : testcase.f32 ? 0x42280000 : 42;
  const expect = new Uint32Array([
  ...iterRange(128, (x) => {
    if (x * 4 === testcase.offset + offset) {
      return outMagicNumber;
    } else {
      return 0;
    }
  })]
  );
  t.expectGPUBufferValuesEqual(outputBuffer, expect);
}

/**
 * Performs a type-based read or write test for bufferView and bufferArrayView
 *
 * Note: This only covers types with no padding. Padding is covered by the layout tests.
 * @param read Test read if true
 * @param t The GPUTest
 * @param wgsl The shader code
 * @param eleTy The base element type
 * @param ty The test type
 * @param aspace The address space to test
 * @param offset The offset for the call
 * @param bufferSize The test buffer size
 */
export function runReadWriteTest(
read,
t,
wgsl,
eleTy,
ty,
aspace,
offset,
bufferSize)
{
  let num_eles = 1;
  if (ty instanceof VectorType) {
    num_eles *= ty.width;
  } else if (ty instanceof ArrayType) {
    num_eles *= ty.count;
  } else if (ty instanceof MatrixType) {
    num_eles *= ty.rows * ty.cols;
  }

  const bufferElements = bufferSize / eleTy.size;

  const start = offset / eleTy.size;
  const end = start + num_eles;
  const ins = [];
  const outs = [];
  for (let i = 0; i < bufferElements; i++) {
    if (i >= start && i < end) {
      ins.push(i + 4);
      outs.push(i + 4);
    } else {
      if (read) {
        ins.push(0);
      } else {
        outs.push(0);
      }
    }
  }
  if (!read && eleTy === Type.f16 && ins.length % 2 === 1) {
    ins.push(0);
  }
  if (read && eleTy === Type.f16 && outs.length % 2 === 1) {
    outs.push(0);
  }

  const inMap = {
    u32: typedArrayParam('Uint32Array', ins),
    i32: typedArrayParam('Int32Array', ins),
    f32: typedArrayParam('Float32Array', ins),
    f16: typedArrayParam('Float16Array', ins)
  };
  const inputData = typedArrayFromParam(
    inMap[eleTy.toString()]
  );

  const outMap = {
    u32: typedArrayParam('Uint32Array', outs),
    i32: typedArrayParam('Int32Array', outs),
    f32: typedArrayParam('Float32Array', outs),
    f16: typedArrayParam('Float16Array', outs)
  };
  const outputData = typedArrayFromParam(
    outMap[eleTy.toString()]
  );

  const inputBuffer = t.makeBufferWithContents(
    inputData,
    GPUBufferUsage.COPY_SRC | (
    aspace === 'uniform' ? GPUBufferUsage.UNIFORM : GPUBufferUsage.STORAGE)
  );
  const outputBuffer = t.createBufferTracked({
    size: outs.length * eleTy.size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
  });

  const pipeline = t.device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: t.device.createShaderModule({ code: wgsl })
    }
  });

  const bg = t.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
    {
      binding: 0,
      resource: {
        buffer: inputBuffer
      }
    },
    {
      binding: 1,
      resource: {
        buffer: outputBuffer
      }
    }]

  });

  const encoder = t.device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(1, 1, 1);
  pass.end();
  t.queue.submit([encoder.finish()]);

  t.expectGPUBufferValuesEqual(outputBuffer, outputData);
}
//# sourceMappingURL=buffer_view_utils.js.map