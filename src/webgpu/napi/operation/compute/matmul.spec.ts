export const description = `
Accelerated Matrix Multiplication tests.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

const computeShaderCode = `
  #version 450
  #pragma shader_stage(compute)
  
  layout(std430, set = 0, binding = 0) readonly buffer FirstMatrix {
    vec2 size;
    float numbers[];
  } firstMatrix;

  layout(std430, set = 0, binding = 1) readonly buffer SecondMatrix {
    vec2 size;
    float numbers[];
  } secondMatrix;

  layout(std430, set = 0, binding = 2) buffer ResultMatrix {
    vec2 size;
    float numbers[];
  } resultMatrix;

  void main() {
    resultMatrix.size = vec2(firstMatrix.size.x, secondMatrix.size.y);
    ivec2 resultCell = ivec2(gl_GlobalInvocationID.x, gl_GlobalInvocationID.y);
    float result = 0.0;
    for (int i = 0; i < firstMatrix.size.y; i++) {
    int a = i + resultCell.x * int(firstMatrix.size.y);
    int b = resultCell.y + i * int(secondMatrix.size.y);
    result += firstMatrix.numbers[a] * secondMatrix.numbers[b];
  }
    int index = resultCell.y + resultCell.x * int(secondMatrix.size.y);
    resultMatrix.numbers[index] = result;
  } 
  `;

g.test('2x4X4x2').fn(async t => {
  const computeShaderModule = t.device.createShaderModule({ code: computeShaderCode });

  const computeDescriptor = {
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, type: 'storage-buffer' as const },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, type: 'storage-buffer' as const },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, type: 'storage-buffer' as const },
    ],
  };
  const computeBindGroupLayout = t.device.createBindGroupLayout(computeDescriptor);

  const computePipeline = t.device.createComputePipeline({
    layout: t.device.createPipelineLayout({ bindGroupLayouts: [computeBindGroupLayout] }),
    computeStage: {
      module: computeShaderModule,
      entryPoint: 'main',
    },
  });

  const firstMatrix = new Float32Array([2 /* rows */, 4 /* columns */, 1, 2, 3, 4, 5, 6, 7, 8]);
  const gpuBufferFirstMatrix = t.device.createBuffer({
    size: firstMatrix.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  gpuBufferFirstMatrix.setSubData(0, firstMatrix);

  const secondMatrix = new Float32Array([4 /* rows */, 2 /* columns */, 1, 2, 3, 4, 5, 6, 7, 8]);

  const gpuBufferSecondMatrix = t.device.createBuffer({
    size: secondMatrix.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  gpuBufferSecondMatrix.setSubData(0, secondMatrix);

  const resultMatrixBufferSize =
    Float32Array.BYTES_PER_ELEMENT * (2 + firstMatrix[0] * secondMatrix[1]);
  const resultMatrixBuffer = t.device.createBuffer({
    size: resultMatrixBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const gpuReadBuffer = t.device.createBuffer({
    size: resultMatrixBufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  const bindGroup = t.device.createBindGroup({
    layout: computeBindGroupLayout,
    entries: [
      {
        binding: 0,
        buffer: gpuBufferFirstMatrix,
        offset: 0,
        size: firstMatrix.byteLength,
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      } as any,
      {
        binding: 1,
        buffer: gpuBufferSecondMatrix,
        offset: 0,
        size: secondMatrix.byteLength,
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      } as any,
      {
        binding: 2,
        buffer: resultMatrixBuffer,
        offset: 0,
        size: resultMatrixBufferSize,
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      } as any,
    ],
  });

  const commandEncoder = t.device.createCommandEncoder({});
  {
    const passEncoder = commandEncoder.beginComputePass({});
    passEncoder.setPipeline(computePipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatch(firstMatrix[0] /* x */, secondMatrix[1] /* y */);
    passEncoder.endPass();
  }

  commandEncoder.copyBufferToBuffer(
    resultMatrixBuffer /* source buffer */,
    0 /* source offset */,
    gpuReadBuffer /* destination buffer */,
    0 /* destination offset */,
    resultMatrixBufferSize /* size */
  );

  t.device.defaultQueue.submit([commandEncoder.finish()]);

  const returnedBuffer = await gpuReadBuffer.mapReadAsync();

  const expectedBuffer = new Float32Array([2 /* rows */, 2 /* columns */, 50, 60, 114, 140]);

  //t.expectContents(returnedBuffer, expectedBuffer);
});
