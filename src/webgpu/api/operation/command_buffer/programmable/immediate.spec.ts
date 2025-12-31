export const description = `
Operation tests for immediate data usage in RenderPassEncoder, ComputePassEncoder, and RenderBundleEncoder.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { getGPU } from '../../../../../common/util/navigator_gpu.js';
import {
  hasFeature,
  kTypedArrayBufferViews,
  kTypedArrayBufferViewKeys,
  supportsImmediateData,
} from '../../../../../common/util/util.js';
import { AllFeaturesMaxLimitsGPUTest } from '../../../../gpu_test.js';
import {
  HostSharableTypes,
  kScalarTypeInfo,
  kVectorContainerTypes,
  ScalarType,
} from '../../../../shader/types.js';
import {
  kProgrammableEncoderTypes,
  ProgrammableEncoderType,
} from '../../../../util/command_buffer_maker.js';

class ImmediateDataOperationTest extends AllFeaturesMaxLimitsGPUTest {
  override async init() {
    await super.init();

    if (!supportsImmediateData(getGPU(this.rec))) {
      this.skip('Immediate data not supported');
      return;
    }
  }
}

function createPipeline(
  t: AllFeaturesMaxLimitsGPUTest,
  encoderType: ProgrammableEncoderType,
  wgslDecl: string,
  wgslUsage: string,
  immediateSize: number
) {
  const layout = t.device.createPipelineLayout({
    bindGroupLayouts: [
      t.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
            buffer: { type: 'storage' },
          },
          {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
            buffer: { type: 'uniform', hasDynamicOffset: true },
          },
        ],
      }),
    ],
    immediateSize,
  });

  const fullCode = `
    ${wgslDecl}
    @group(0) @binding(0) var<storage, read_write> output: array<u32>;
    @group(0) @binding(1) var<uniform> outIndex: u32;

    ${wgslUsage}
  `;

  if (encoderType === 'compute pass') {
    return t.device.createComputePipeline({
      layout,
      compute: {
        module: t.device.createShaderModule({ code: fullCode }),
        entryPoint: 'cs_main',
      },
    });
  } else {
    return t.device.createRenderPipeline({
      layout,
      vertex: {
        module: t.device.createShaderModule({
          code: `
            @vertex fn vs_main(@builtin(vertex_index) vIdx: u32) -> @builtin(position) vec4f {
              // Map vIdx 0..3 to pixel centers.
              // Uses a 4x1 texture.
              // vIdx 0 -> pixel 0 -> x in [-1, -0.5]
              // vIdx 1 -> pixel 1 -> x in [-0.5, 0]
              // ...
              // x = (vIdx + 0.5) / 4.0 * 2.0 - 1.0
              let x = (f32(vIdx) + 0.5) / 2.0 - 1.0;
              return vec4f(x, 0.0, 0.0, 1.0);
            }
          `,
        }),
        entryPoint: 'vs_main',
      },
      fragment: {
        module: t.device.createShaderModule({ code: fullCode }),
        entryPoint: 'fs_main',
        targets: [{ format: 'r32uint' }],
      },
      primitive: {
        topology: 'point-list',
      },
    });
  }
}

function executePass(
  t: AllFeaturesMaxLimitsGPUTest,
  encoderType: ProgrammableEncoderType,
  commandEncoder: GPUCommandEncoder,
  fn: (pass: GPURenderPassEncoder | GPUComputePassEncoder | GPURenderBundleEncoder) => void
) {
  if (encoderType === 'compute pass') {
    const pass = commandEncoder.beginComputePass();
    fn(pass);
    pass.end();
  } else {
    const renderTargetTexture = t.createTextureTracked({
      size: [4, 1, 1],
      format: 'r32uint',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    if (encoderType === 'render pass') {
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: renderTargetTexture.createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
          },
        ],
      });
      fn(pass);
      pass.end();
    } else {
      // Render Bundle
      const bundleEncoder = t.device.createRenderBundleEncoder({
        colorFormats: ['r32uint'],
      });
      fn(bundleEncoder);
      const bundle = bundleEncoder.finish();

      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: renderTargetTexture.createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
          },
        ],
      });
      pass.executeBundles([bundle]);
      pass.end();
    }
  }
}

function runAndCheck(
  t: AllFeaturesMaxLimitsGPUTest,
  encoderType: ProgrammableEncoderType,
  pipeline: GPURenderPipeline | GPUComputePipeline,
  setImmediatesFn: (
    encoder: GPUComputePassEncoder | GPURenderPassEncoder | GPURenderBundleEncoder
  ) => void,
  expectedValues: number[]
) {
  const outputBuffer = t.createBufferTracked({
    size: 4 * 4, // 4 u32s
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const indexUniformBuffer = t.createBufferTracked({
    size: 256 * 4, // Enough for dynamic offsets
    usage: GPUBufferUsage.UNIFORM,
    mappedAtCreation: true,
  });
  // Initialize indices 0, 1, 2, 3 at offsets 0, 256, 512, 768
  const indexData = new Uint32Array(indexUniformBuffer.getMappedRange());
  indexData[0] = 0;
  indexData[256 / 4] = 1;
  indexData[512 / 4] = 2;
  indexData[768 / 4] = 3;
  indexUniformBuffer.unmap();

  const bindGroup = t.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: outputBuffer } },
      { binding: 1, resource: { buffer: indexUniformBuffer, size: 4 } },
    ],
  });

  const commandEncoder = t.device.createCommandEncoder();
  executePass(t, encoderType, commandEncoder, encoder => {
    if (encoderType === 'compute pass') {
      const pass = encoder as GPUComputePassEncoder;
      pass.setPipeline(pipeline as GPUComputePipeline);
      pass.setBindGroup(0, bindGroup, [0]); // Index 0
      setImmediatesFn(pass);
      pass.dispatchWorkgroups(1);
    } else if (encoderType === 'render pass') {
      const pass = encoder as GPURenderPassEncoder;
      pass.setPipeline(pipeline as GPURenderPipeline);
      pass.setBindGroup(0, bindGroup, [0]);
      setImmediatesFn(pass);
      pass.draw(1, 1, 0, 0); // Vertex 0 -> Pixel 0
    } else if (encoderType === 'render bundle') {
      const bundleEncoder = encoder as GPURenderBundleEncoder;
      bundleEncoder.setPipeline(pipeline as GPURenderPipeline);
      bundleEncoder.setBindGroup(0, bindGroup, [0]);
      setImmediatesFn(bundleEncoder);
      bundleEncoder.draw(1, 1, 0, 0);
    }
  });

  t.device.queue.submit([commandEncoder.finish()]);

  // Verify
  if (encoderType === 'compute pass') {
    t.expectGPUBufferValuesEqual(outputBuffer, new Uint32Array(expectedValues));
  } else {
    // For render, the fragment shader writes to the storage buffer 'output'.
    t.expectGPUBufferValuesEqual(outputBuffer, new Uint32Array(expectedValues));
  }
}

export const g = makeTestGroup(ImmediateDataOperationTest);

g.test('basic_execution')
  .desc('Verify immediate data is correctly passed to shaders.')
  .params(u =>
    u.combine('encoderType', kProgrammableEncoderTypes).expandWithParams(function* () {
      // Scalars
      for (const s of HostSharableTypes) {
        if (s === 'f16') continue;
        yield { dataType: s, scalarType: s, vectorSize: 1 };
      }
      // Vectors
      for (const v of kVectorContainerTypes) {
        const size = parseInt(v[3]);
        for (const s of HostSharableTypes) {
          if (s === 'f16') continue;
          yield { dataType: `${v}<${s}>`, scalarType: s, vectorSize: size };
        }
      }
      // Struct
      yield { dataType: 'struct', scalarType: undefined, vectorSize: undefined };
    })
  )
  .fn(t => {
    const { encoderType, dataType, scalarType, vectorSize } = t.params;

    let wgslDecl = '';
    let wgslUsage = '';
    let immediateSize = 0;
    let expected: number[] = [];
    let inputData: Uint32Array;

    if (dataType === 'struct') {
      immediateSize = 8;
      wgslDecl = `
        struct S { a: u32, b: u32 }
        var<immediate> data: S;
      `;
      wgslUsage = `
        @compute @workgroup_size(1) fn cs_main() {
          output[0] = data.a; output[1] = data.b;
        }
        @fragment fn fs_main() -> @location(0) vec4u {
          output[0] = data.a; output[1] = data.b;
          return vec4u(0);
        }
      `;
      inputData = new Uint32Array([0xdeadbeef, 0xcafebabe]);
      expected = [0xdeadbeef, 0xcafebabe];
    } else {
      // Non-struct types (scalar or vector)
      const sType = scalarType as ScalarType;
      const vSize = vectorSize as number;

      const typeInfo = kScalarTypeInfo[sType];
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const feature = (typeInfo as any).feature;
      if (feature && !hasFeature(t.device.features, feature)) {
        t.skip(`Feature ${feature} not available`);
      }

      immediateSize = vSize * 4;
      wgslDecl = `var<immediate> data: ${dataType};`;

      let readCode = '';
      for (let i = 0; i < vSize; i++) {
        let valExpr = vSize === 1 ? 'data' : `data[${i}]`;
        if (sType === 'i32' || sType === 'f32') {
          valExpr = `bitcast<u32>(${valExpr})`;
        }
        readCode += `output[${i}] = ${valExpr};`;
      }

      wgslUsage = `
        @compute @workgroup_size(1) fn cs_main() {
          ${readCode}
        }
        @fragment fn fs_main() -> @location(0) vec4u {
          ${readCode}
          return vec4u(0);
        }
      `;

      inputData = new Uint32Array(vSize);
      for (let i = 0; i < vSize; i++) {
        if (sType === 'u32') {
          const val = 0x10000000 + i;
          inputData[i] = val;
          expected.push(val);
        } else if (sType === 'i32') {
          const val = -1000 - i;
          inputData[i] = new Uint32Array(new Int32Array([val]).buffer)[0];
          expected.push(inputData[i]);
        } else if (sType === 'f32') {
          const val = 1.5 + i;
          inputData[i] = new Uint32Array(new Float32Array([val]).buffer)[0];
          expected.push(inputData[i]);
        }
      }
    }

    const pipeline = createPipeline(t, encoderType, wgslDecl, wgslUsage, immediateSize);

    runAndCheck(
      t,
      encoderType,
      pipeline,
      encoder => {
        encoder.setImmediates!(0, inputData.buffer, 0, inputData.buffer.byteLength);
      },
      expected
    );
  });

g.test('update_data')
  .desc('Verify setImmediates updates data correctly within a pass, including partial updates.')
  .params(u => u.combine('encoderType', kProgrammableEncoderTypes))
  .fn(t => {
    const { encoderType } = t.params;
    const immediateSize = 16;
    const wgslDecl = 'var<immediate> data: vec4<u32>;';
    const wgslUsage = `
      @compute @workgroup_size(1) fn cs_main() {
        let base = outIndex * 4;
        output[base + 0] = data[0];
        output[base + 1] = data[1];
        output[base + 2] = data[2];
        output[base + 3] = data[3];
      }
      @fragment fn fs_main() -> @location(0) vec4u {
        let base = outIndex * 4;
        output[base + 0] = data[0];
        output[base + 1] = data[1];
        output[base + 2] = data[2];
        output[base + 3] = data[3];
        return vec4u(0);
      }
    `;

    const pipeline = createPipeline(t, encoderType, wgslDecl, wgslUsage, immediateSize);

    const outputBuffer = t.createBufferTracked({
      size: 4 * 4 * 3, // 3 steps, 4 u32s each
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const indexUniformBuffer = t.createBufferTracked({
      size: 256 * 3,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    });
    const indexData = new Uint32Array(indexUniformBuffer.getMappedRange());
    indexData[0] = 0;
    indexData[256 / 4] = 1;
    indexData[512 / 4] = 2;
    indexUniformBuffer.unmap();

    const bindGroup = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: outputBuffer } },
        { binding: 1, resource: { buffer: indexUniformBuffer, size: 4 } },
      ],
    });

    const commandEncoder = t.device.createCommandEncoder();

    const runStep = (
      pass: GPURenderPassEncoder | GPUComputePassEncoder | GPURenderBundleEncoder,
      stepIndex: number,
      data: Uint32Array,
      dstOffset: number = 0
    ) => {
      pass.setBindGroup(0, bindGroup, [stepIndex * 256]);
      pass.setImmediates!(dstOffset, data, 0, data.length);

      if (encoderType === 'compute pass') {
        (pass as GPUComputePassEncoder).dispatchWorkgroups(1);
      } else if (encoderType === 'render pass') {
        (pass as GPURenderPassEncoder).draw(1, 1, 0, 0);
      } else {
        (pass as GPURenderBundleEncoder).draw(1, 1, 0, 0);
      }
    };

    executePass(t, encoderType, commandEncoder, enc => {
      if (encoderType === 'compute pass') {
        (enc as GPUComputePassEncoder).setPipeline(pipeline as GPUComputePipeline);
      } else if (encoderType === 'render pass') {
        (enc as GPURenderPassEncoder).setPipeline(pipeline as GPURenderPipeline);
      } else {
        (enc as GPURenderBundleEncoder).setPipeline(pipeline as GPURenderPipeline);
      }

      // Step 1: Full set [1, 2, 3, 4]
      runStep(enc, 0, new Uint32Array([1, 2, 3, 4]));

      // Step 2: Full update [5, 6, 7, 8]
      runStep(enc, 1, new Uint32Array([5, 6, 7, 8]));

      // Step 3: Partial update offset 4 bytes (index 1) with [9, 10] -> [5, 9, 10, 8]
      runStep(enc, 2, new Uint32Array([9, 10]), 4);
    });

    t.device.queue.submit([commandEncoder.finish()]);

    const expected = new Uint32Array([1, 2, 3, 4, 5, 6, 7, 8, 5, 9, 10, 8]);
    t.expectGPUBufferValuesEqual(outputBuffer, expected);
  });

g.test('pipeline_switch')
  .desc('Verify immediate data is correctly set after switching pipelines.')
  .params(u => u.combine('encoderType', ['render pass', 'compute pass'] as const))
  .fn(t => {
    const { encoderType } = t.params;

    const wgslDecl = 'var<immediate> data: vec4<u32>;';
    const wgslUsage = `
      @compute @workgroup_size(1) fn cs_main() {
        let base = outIndex * 4;
        output[base] = data.x; output[base+1] = data.y; output[base+2] = data.z; output[base+3] = data.w;
      }
      @fragment fn fs_main() -> @location(0) vec4u {
        let base = outIndex * 4;
        output[base] = data.x; output[base+1] = data.y; output[base+2] = data.z; output[base+3] = data.w;
        return vec4u(0);
      }
      `;

    // Pipeline A and B have the same immediate layout but are separate pipeline objects.
    const pipelineA = createPipeline(t, encoderType, wgslDecl, wgslUsage, 16);
    const pipelineB = createPipeline(t, encoderType, wgslDecl, wgslUsage, 16);

    const outputBuffer = t.createBufferTracked({
      size: 32,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const indexUniformBuffer = t.createBufferTracked({
      size: 512,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    });
    const indexData = new Uint32Array(indexUniformBuffer.getMappedRange());
    indexData[0] = 0;
    indexData[256 / 4] = 1;
    indexUniformBuffer.unmap();

    const bindGroupA = t.device.createBindGroup({
      layout: pipelineA.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: outputBuffer } },
        { binding: 1, resource: { buffer: indexUniformBuffer, size: 4 } },
      ],
    });
    const bindGroupB = t.device.createBindGroup({
      layout: pipelineB.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: outputBuffer } },
        { binding: 1, resource: { buffer: indexUniformBuffer, size: 4 } },
      ],
    });

    const commandEncoder = t.device.createCommandEncoder();

    executePass(t, encoderType, commandEncoder, enc => {
      if (encoderType === 'compute pass') {
        const pass = enc as GPUComputePassEncoder;
        // 1. Set Pipeline A, set immediates [1, 2, 3, 4], dispatch
        pass.setPipeline(pipelineA as GPUComputePipeline);
        pass.setBindGroup(0, bindGroupA, [0]);
        pass.setImmediates!(0, new Uint32Array([1, 2, 3, 4]), 0, 4);
        pass.dispatchWorkgroups(1);

        // 2. Switch to Pipeline B, set new immediates [5, 6, 7, 8], dispatch
        pass.setPipeline(pipelineB as GPUComputePipeline);
        pass.setBindGroup(0, bindGroupB, [256]);
        pass.setImmediates!(0, new Uint32Array([5, 6, 7, 8]), 0, 4);
        pass.dispatchWorkgroups(1);
      } else {
        const pass = enc as GPURenderPassEncoder;
        // 1. Set Pipeline A, set immediates [1, 2, 3, 4], draw
        pass.setPipeline(pipelineA as GPURenderPipeline);
        pass.setBindGroup(0, bindGroupA, [0]);
        pass.setImmediates!(0, new Uint32Array([1, 2, 3, 4]), 0, 4);
        pass.draw(1, 1, 0, 0);

        // 2. Switch to Pipeline B, set new immediates [5, 6, 7, 8], draw
        pass.setPipeline(pipelineB as GPURenderPipeline);
        pass.setBindGroup(0, bindGroupB, [256]);
        pass.setImmediates!(0, new Uint32Array([5, 6, 7, 8]), 0, 4);
        pass.draw(1, 1, 1, 0);
      }
    });

    t.device.queue.submit([commandEncoder.finish()]);

    const expected = new Uint32Array([1, 2, 3, 4, 5, 6, 7, 8]);
    t.expectGPUBufferValuesEqual(outputBuffer, expected);
  });

g.test('use_max_immediate_size')
  .desc('Verify setImmediates with maxImmediateSize.')
  .params(u => u.combine('encoderType', kProgrammableEncoderTypes))
  .fn(t => {
    const { encoderType } = t.params;
    const maxImmediateSize = t.device.limits.maxImmediateSize!;
    // Create a pipeline that reads the first and last u32 of the immediate data
    const count = maxImmediateSize / 4;
    const members: string[] = [];
    for (let i = 0; i < count; i++) {
      members.push(`m${i}: u32`);
    }
    const wgslDecl = `struct Large { ${members.join(', ')} } var<immediate> data: Large;`;
    const wgslUsage = `
      @compute @workgroup_size(1) fn cs_main() {
        output[0] = data.m0;
        output[1] = data.m${count - 1};
      }
      @fragment fn fs_main() -> @location(0) vec4u {
        output[0] = data.m0;
        output[1] = data.m${count - 1};
        return vec4u(0);
      }
    `;

    const pipeline = createPipeline(t, encoderType, wgslDecl, wgslUsage, maxImmediateSize);

    const outputBuffer = t.createBufferTracked({
      size: 8,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const indexUniformBuffer = t.createBufferTracked({
      size: 256,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    });
    new Uint32Array(indexUniformBuffer.getMappedRange()).fill(0);
    indexUniformBuffer.unmap();

    const bindGroup = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: outputBuffer } },
        { binding: 1, resource: { buffer: indexUniformBuffer, size: 4 } },
      ],
    });

    const commandEncoder = t.device.createCommandEncoder();
    executePass(t, encoderType, commandEncoder, enc => {
      const data = new Uint32Array(count);
      data[0] = 0xdeadbeef;
      data[count - 1] = 0xcafebabe;

      if (encoderType === 'compute pass') {
        const pass = enc as GPUComputePassEncoder;
        pass.setPipeline(pipeline as GPUComputePipeline);
        pass.setBindGroup(0, bindGroup, [0]);
        pass.setImmediates!(0, data, 0, count);
        pass.dispatchWorkgroups(1);
      } else {
        const pass = enc as GPURenderPassEncoder | GPURenderBundleEncoder;
        pass.setPipeline(pipeline as GPURenderPipeline);
        pass.setBindGroup(0, bindGroup, [0]);
        pass.setImmediates!(0, data, 0, count);
        pass.draw(1, 1, 0, 0);
      }
    });

    t.device.queue.submit([commandEncoder.finish()]);
    t.expectGPUBufferValuesEqual(outputBuffer, new Uint32Array([0xdeadbeef, 0xcafebabe]));
  });

g.test('typed_array_arguments')
  .desc('Verify srcOffset and srcSize are in elements for TypedArrays.')
  .params(u =>
    u
      .combine(
        'typedArray',
        kTypedArrayBufferViewKeys.filter(k => k !== 'Float16Array')
      )
      .combine('encoderType', kProgrammableEncoderTypes)
  )
  .fn(t => {
    const { typedArray, encoderType } = t.params;
    const Ctor = kTypedArrayBufferViews[typedArray];
    const elementSize = Ctor.BYTES_PER_ELEMENT;

    // Write a known pattern.
    // Use a buffer of 8 bytes.
    // Pattern: 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08
    const bytePattern = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08];

    // Create a large buffer to test offset.
    // Use offset = 2 elements.
    // Need enough data.
    // Construct the TypedArray such that at index `offset`, the pattern exists.
    const offset = 2;
    const elementCount = 8 / elementSize; // Write 8 bytes.

    // Total elements needed: offset + elementCount + padding
    const totalElements = offset + elementCount + 2;
    const arr = new Ctor(totalElements);

    // Fill with non-zero value.
    const fillView = new Uint8Array(arr.buffer);
    fillView.fill(0xaa);

    // The bytes at `arr[offset]...` should match `bytePattern`.
    // Use a DataView on the array's buffer to set the bytes.
    const buffer = arr.buffer;
    const byteOffset = arr.byteOffset + offset * elementSize;
    const view = new DataView(buffer);

    for (let i = 0; i < 8; i++) {
      view.setUint8(byteOffset + i, bytePattern[i]);
    }

    // Now `arr` contains the pattern at `offset`.

    // Shader: read 2 u32s (8 bytes).
    const wgslDecl = 'var<immediate> data: array<u32, 2>;';
    const wgslUsage = `
      @compute @workgroup_size(1) fn cs_main() {
        output[0] = data[0];
        output[1] = data[1];
      }
      @fragment fn fs_main() -> @location(0) vec4u {
        output[0] = data[0];
        output[1] = data[1];
        return vec4u(0);
      }
    `;

    const pipeline = createPipeline(t, encoderType, wgslDecl, wgslUsage, 8);

    const outputBuffer = t.createBufferTracked({
      size: 8,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const indexUniformBuffer = t.createBufferTracked({
      size: 256,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    });
    new Uint32Array(indexUniformBuffer.getMappedRange()).fill(0);
    indexUniformBuffer.unmap();

    const bindGroup = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: outputBuffer } },
        { binding: 1, resource: { buffer: indexUniformBuffer, size: 4 } },
      ],
    });

    const commandEncoder = t.device.createCommandEncoder();
    executePass(t, encoderType, commandEncoder, enc => {
      if (encoderType === 'compute pass') {
        const pass = enc as GPUComputePassEncoder;
        pass.setPipeline(pipeline as GPUComputePipeline);
        pass.setBindGroup(0, bindGroup, [0]);
        pass.setImmediates!(0, arr, offset, elementCount);
        pass.dispatchWorkgroups(1);
      } else {
        const pass = enc as GPURenderPassEncoder | GPURenderBundleEncoder;
        pass.setPipeline(pipeline as GPURenderPipeline);
        pass.setBindGroup(0, bindGroup, [0]);
        pass.setImmediates!(0, arr, offset, elementCount);
        pass.draw(1, 1, 0, 0);
      }
    });

    t.device.queue.submit([commandEncoder.finish()]);

    // Expected: 0x04030201, 0x08070605 (Little Endian)
    const expected = new Uint32Array([0x04030201, 0x08070605]);
    t.expectGPUBufferValuesEqual(outputBuffer, expected);
  });

g.test('multiple_updates_before_draw_or_dispatch')
  .desc(
    'Verify that multiple setImmediates calls before a draw or dispatch result in the latest content being used (merging updates).'
  )
  .params(u => u.combine('encoderType', kProgrammableEncoderTypes))
  .fn(t => {
    const { encoderType } = t.params;
    // Use vec4<u32> to allow partial updates.
    const wgslDecl = 'var<immediate> data: vec4<u32>;';
    const wgslUsage = `
      @compute @workgroup_size(1) fn cs_main() {
        output[0] = data.x; output[1] = data.y; output[2] = data.z; output[3] = data.w;
      }
      @fragment fn fs_main() -> @location(0) vec4u {
        output[0] = data.x; output[1] = data.y; output[2] = data.z; output[3] = data.w;
        return vec4u(0);
      }
    `;
    const pipeline = createPipeline(t, encoderType, wgslDecl, wgslUsage, 16);

    runAndCheck(
      t,
      encoderType,
      pipeline,
      encoder => {
        // 1. Set all to [1, 2, 3, 4]
        encoder.setImmediates!(0, new Uint32Array([1, 2, 3, 4]), 0, 4);
        // 2. Update middle two to [5, 6] -> [1, 5, 6, 4]
        encoder.setImmediates!(4, new Uint32Array([5, 6]), 0, 2);
        // 3. Update last to [7] -> [1, 5, 6, 7]
        encoder.setImmediates!(12, new Uint32Array([7]), 0, 1);
      },
      [1, 5, 6, 7]
    );
  });

g.test('render_pass_and_bundle_mix')
  .desc('Verify interaction between executeBundles and direct render pass commands.')
  .fn(t => {
    const wgslDecl = 'var<immediate> data: vec2<u32>;';
    const wgslUsage = `
      @fragment fn fs_main() -> @location(0) vec4u {
        let base = outIndex * 2;
        output[base] = data.x;
        output[base + 1] = data.y;
        return vec4u(0);
      }
    `;
    // Use 'render pass' type to create the pipeline, but it works for bundle too.
    // Output size: 2 draws * 2 u32s * 4 bytes = 16 bytes.
    const pipeline = createPipeline(t, 'render pass', wgslDecl, wgslUsage, 16) as GPURenderPipeline;

    const outputBuffer = t.createBufferTracked({
      size: 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const indexUniformBuffer = t.createBufferTracked({
      size: 512,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    });
    const idxData = new Uint32Array(indexUniformBuffer.getMappedRange());
    idxData[0] = 0;
    idxData[256 / 4] = 1;
    indexUniformBuffer.unmap();

    const bindGroup = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: outputBuffer } },
        { binding: 1, resource: { buffer: indexUniformBuffer, size: 4 } },
      ],
    });

    // Bundle: Set [1, 10], Draw (Index 0)
    const bundleEncoder = t.device.createRenderBundleEncoder({ colorFormats: ['r32uint'] });
    bundleEncoder.setPipeline(pipeline);
    bundleEncoder.setBindGroup(0, bindGroup, [0]);
    bundleEncoder.setImmediates!(0, new Uint32Array([1, 10]), 0, 2);
    bundleEncoder.draw(1, 1, 0, 0);
    const bundle = bundleEncoder.finish();

    const renderTargetTexture = t.createTextureTracked({
      size: [4, 1, 1],
      format: 'r32uint',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });
    const commandEncoder = t.device.createCommandEncoder();
    const pass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: renderTargetTexture.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    });

    // Execute Bundle
    pass.executeBundles([bundle]);

    // Pass: Set [2, 20], Draw (Index 1)
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup, [256]);
    pass.setImmediates!(0, new Uint32Array([2, 20]), 0, 2);
    pass.draw(1, 1, 1, 0);

    pass.end();
    t.device.queue.submit([commandEncoder.finish()]);

    t.expectGPUBufferValuesEqual(outputBuffer, new Uint32Array([1, 10, 2, 20]));
  });

g.test('render_bundle_isolation')
  .desc('Verify that immediate data state is isolated between bundles executed in the same pass.')
  .fn(t => {
    const wgslDecl = 'var<immediate> data: vec2<u32>;';
    const wgslUsage = `
      @fragment fn fs_main() -> @location(0) vec4u {
        let base = outIndex * 2;
        output[base] = data.x;
        output[base + 1] = data.y;
        return vec4u(0);
      }
    `;
    const pipeline = createPipeline(t, 'render pass', wgslDecl, wgslUsage, 8) as GPURenderPipeline;

    const outputBuffer = t.createBufferTracked({
      size: 16, // 2 draws * 2 u32s * 4 bytes
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const indexUniformBuffer = t.createBufferTracked({
      size: 512,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    });
    const idxData = new Uint32Array(indexUniformBuffer.getMappedRange());
    idxData[0] = 0;
    idxData[256 / 4] = 1;
    indexUniformBuffer.unmap();

    const bindGroup = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: outputBuffer } },
        { binding: 1, resource: { buffer: indexUniformBuffer, size: 4 } },
      ],
    });

    // Bundle A: Set [1, 2], Draw (Index 0)
    const bundleEncoderA = t.device.createRenderBundleEncoder({ colorFormats: ['r32uint'] });
    bundleEncoderA.setPipeline(pipeline);
    bundleEncoderA.setBindGroup(0, bindGroup, [0]);
    bundleEncoderA.setImmediates!(0, new Uint32Array([1, 2]), 0, 2);
    bundleEncoderA.draw(1, 1, 0, 0);
    const bundleA = bundleEncoderA.finish();

    // Bundle B: Set [3, 4], Draw (Index 1)
    const bundleEncoderB = t.device.createRenderBundleEncoder({ colorFormats: ['r32uint'] });
    bundleEncoderB.setPipeline(pipeline);
    bundleEncoderB.setBindGroup(0, bindGroup, [256]);
    bundleEncoderB.setImmediates!(0, new Uint32Array([3, 4]), 0, 2);
    bundleEncoderB.draw(1, 1, 1, 0);
    const bundleB = bundleEncoderB.finish();

    const renderTargetTexture = t.createTextureTracked({
      size: [4, 1, 1],
      format: 'r32uint',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });
    const commandEncoder = t.device.createCommandEncoder();
    const pass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: renderTargetTexture.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    });

    // Execute Bundles
    pass.executeBundles([bundleA, bundleB]);

    pass.end();
    t.device.queue.submit([commandEncoder.finish()]);

    t.expectGPUBufferValuesEqual(outputBuffer, new Uint32Array([1, 2, 3, 4]));
  });
