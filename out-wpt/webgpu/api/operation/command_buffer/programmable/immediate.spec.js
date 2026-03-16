/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Operation tests for immediate data usage in RenderPassEncoder, ComputePassEncoder, and RenderBundleEncoder.
`;import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { getGPU } from '../../../../../common/util/navigator_gpu.js';
import {
  assert,
  kTypedArrayBufferViews,
  kTypedArrayBufferViewKeys,
  memcpy,
  supportsImmediateData,
  unreachable } from
'../../../../../common/util/util.js';
import { AllFeaturesMaxLimitsGPUTest } from '../../../../gpu_test.js';
import { HostSharableTypes, kVectorContainerTypes } from '../../../../shader/types.js';
import {
  kProgrammableEncoderTypes } from

'../../../../util/command_buffer_maker.js';

class ImmediateDataOperationTest extends AllFeaturesMaxLimitsGPUTest {
  async init() {
    await super.init();

    if (!supportsImmediateData(getGPU(this.rec))) {
      this.skip('Immediate data not supported');
      return;
    }
  }

  skipIfStorageBuffersInFragmentStageNotAvailable(encoderType) {
    if (!this.isCompatibility) {
      return;
    }
    const needsStorageBuffersInFragmentStage =
    encoderType === 'render pass' || encoderType === 'render bundle';
    this.skipIf(
      needsStorageBuffersInFragmentStage &&
      !(this.device.limits.maxStorageBuffersInFragmentStage >= 1),
      `maxStorageBuffersInFragmentStage(${this.device.limits.maxStorageBuffersInFragmentStage}) < 1`
    );
  }
}

function createPipeline(
t,
encoderType,
wgslDecl,
copyCode,
immediateSize,
pipelineLayout)
{
  const layout =
  pipelineLayout ||
  t.device.createPipelineLayout({
    bindGroupLayouts: [
    t.device.createBindGroupLayout({
      entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
        buffer: { type: 'storage' }
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
        buffer: { type: 'uniform', hasDynamicOffset: true }
      }]

    })],

    immediateSize
  });

  const fullCode = `
    ${wgslDecl}
    @group(0) @binding(0) var<storage, read_write> output: array<u32>;
    @group(0) @binding(1) var<uniform> outIndex: u32;

    @compute @workgroup_size(1) fn cs_main() {
      ${copyCode}
    }
    @fragment fn fs_main() -> @location(0) vec4u {
      ${copyCode}
      return vec4u(0);
    }
  `;

  if (encoderType === 'compute pass') {
    return t.device.createComputePipeline({
      layout,
      compute: {
        module: t.device.createShaderModule({ code: fullCode })
      }
    });
  } else {
    return t.device.createRenderPipeline({
      layout,
      vertex: {
        module: t.device.createShaderModule({
          code: `
            // Re-declare outIndex in the vertex shader
            @group(0) @binding(1) var<uniform> outIndex: u32;

            @vertex fn vs_main() -> @builtin(position) vec4f {
              // Map outIndex 0..3 to pixel centers in a 4x1 render target.
              // x = (f32(outIndex) + 0.5) / 2.0 - 1.0
              let x = (f32(outIndex) + 0.5) / 2.0 - 1.0;
              return vec4f(x, 0.0, 0.0, 1.0);
            }
          `
        })
      },
      fragment: {
        module: t.device.createShaderModule({ code: fullCode }),
        targets: [{ format: 'r32uint' }]
      },
      primitive: {
        topology: 'point-list'
      }
    });
  }
}

/** Dispatch or draw based on encoder type. */
function dispatchOrDraw(
encoderType,
encoder)
{
  if (encoderType === 'compute pass') {
    encoder.dispatchWorkgroups(1);
  } else {
    encoder.draw(1); // 1 Vertex over 1 Instance
  }
}

/**
 * Create a uniform buffer with output indices at 256-byte aligned offsets for dynamic binding.
 * A uniform buffer with dynamic offsets is used to provide the output index because:
 *  1. It works uniformly across all shader stages (compute, vertex, fragment).
 *  2. It doesn't consume the immediate data capability that these tests are actively exercising.
 */
function createOutputIndexBuffer(t, count) {
  const buffer = t.createBufferTracked({
    size: 256 * count,
    usage: GPUBufferUsage.UNIFORM,
    mappedAtCreation: true
  });
  const data = new Uint32Array(buffer.getMappedRange());
  for (let i = 0; i < count; i++) {
    data[i * 256 / 4] = i;
  }
  buffer.unmap();
  return buffer;
}

function encodeForPassType(
t,
encoderType,
commandEncoder,
fn)
{
  if (encoderType === 'compute pass') {
    const pass = commandEncoder.beginComputePass();
    fn(pass);
    pass.end();
  } else {
    const renderTargetTexture = t.createTextureTracked({
      size: [4, 1, 1],
      format: 'r32uint',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });

    if (encoderType === 'render pass') {
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
        {
          view: renderTargetTexture.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 0 }
        }]

      });
      fn(pass);
      pass.end();
    } else {
      // Render Bundle
      const bundleEncoder = t.device.createRenderBundleEncoder({
        colorFormats: ['r32uint']
      });
      fn(bundleEncoder);
      const bundle = bundleEncoder.finish();

      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
        {
          view: renderTargetTexture.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 0 }
        }]

      });
      pass.executeBundles([bundle]);
      pass.end();
    }
  }
}

function setPipeline(
encoderType,
encoder,
pipeline)
{
  if (encoderType === 'compute pass') {
    encoder.setPipeline(pipeline);
  } else {
    encoder.setPipeline(
      pipeline
    );
  }
}

function runAndCheck(
t,
encoderType,
pipeline,
setImmediatesFn,


expectedValues)
{
  assert(expectedValues.length > 0, 'expectedValues must not be empty');
  const outputBuffer = t.createBufferTracked({
    size: expectedValues.length * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
  });
  // A dynamic-offset uniform buffer supplies outIndex = 0 here.
  // We use a uniform buffer (rather than e.g. firstVertex via @builtin(vertex_index)) because:
  //  - It works across all shader stages (compute, vertex, fragment).
  //  - firstVertex is emulated via root constants on D3D12, which is the same mechanism
  //    backing var<immediate>, so using it could mask bugs in the path under test.
  // The pipeline layout declares hasDynamicOffset, so we must always pass a dynamic offset
  // array — even though this simple helper only ever uses offset [0].
  const indexUniformBuffer = t.makeBufferWithContents(new Uint32Array([0]), GPUBufferUsage.UNIFORM);

  const bindGroup = t.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
    { binding: 0, resource: { buffer: outputBuffer } },
    { binding: 1, resource: { buffer: indexUniformBuffer, size: 4 } }]

  });

  const commandEncoder = t.device.createCommandEncoder();
  encodeForPassType(t, encoderType, commandEncoder, (encoder) => {
    setPipeline(encoderType, encoder, pipeline);
    encoder.setBindGroup(0, bindGroup, [0]);
    setImmediatesFn(encoder);
    dispatchOrDraw(encoderType, encoder);
  });

  t.device.queue.submit([commandEncoder.finish()]);

  t.expectGPUBufferValuesEqual(outputBuffer, new Uint32Array(expectedValues));
}

export const g = makeTestGroup(ImmediateDataOperationTest);

g.test('basic_execution').
desc('Verify immediate data is correctly passed to shaders.').
params((u) =>
u.combine('encoderType', kProgrammableEncoderTypes).expandWithParams(function* () {
  // Scalars
  for (const s of HostSharableTypes) {
    yield { dataType: s, scalarType: s, vectorSize: 1 };
  }
  // Vectors
  for (const v of kVectorContainerTypes) {
    const size = parseInt(v[3]);
    for (const s of HostSharableTypes) {
      yield { dataType: `${v}<${s}>`, scalarType: s, vectorSize: size };
    }
  }
  // Struct
  yield { dataType: 'struct', scalarType: undefined, vectorSize: undefined };
})
).
fn((t) => {
  const { encoderType, dataType, scalarType, vectorSize } = t.params;
  t.skipIf(scalarType === 'f16', 'Immediate data blocks do not yet support f16 types');
  t.skipIfStorageBuffersInFragmentStageNotAvailable(encoderType);

  let wgslDecl = '';
  let copyCode = '';
  let immediateSize = 0;
  let expected = [];
  let inputData;

  if (dataType === 'struct') {
    immediateSize = 8;
    wgslDecl = `
        struct S { a: u32, b: u32 }
        var<immediate> data: S;
      `;
    copyCode = 'output[0] = data.a; output[1] = data.b;';
    inputData = new Uint32Array([0xdeadbeef, 0xcafebabe]);
    expected = [0xdeadbeef, 0xcafebabe];
  } else {
    // Non-struct types (scalar or vector)
    const sType = scalarType;
    const vSize = vectorSize;

    immediateSize = vSize * 4;
    wgslDecl = `var<immediate> data: ${dataType};`;

    // bitcast<u32> is identity for u32, so we can use it unconditionally.
    for (let i = 0; i < vSize; i++) {
      const valExpr = vSize === 1 ? 'data' : `data[${i}]`;
      copyCode += `output[${i}] = bitcast<u32>(${valExpr});\n`;
    }

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
      } else {
        unreachable(`Unhandled scalar type: ${sType}`);
      }
    }
  }

  const pipeline = createPipeline(t, encoderType, wgslDecl, copyCode, immediateSize);

  runAndCheck(
    t,
    encoderType,
    pipeline,
    (encoder) => {
      encoder.setImmediates(0, inputData);
    },
    expected
  );
});

g.test('update_data').
desc('Verify setImmediates updates data correctly within a pass, including partial updates.').
params((u) => u.combine('encoderType', kProgrammableEncoderTypes)).
fn((t) => {
  const { encoderType } = t.params;
  t.skipIfStorageBuffersInFragmentStageNotAvailable(encoderType);
  const immediateSize = 16;
  const wgslDecl = 'var<immediate> data: vec4<u32>;';
  const copyCode = `
      let base = outIndex * 4;
      output[base + 0] = data[0];
      output[base + 1] = data[1];
      output[base + 2] = data[2];
      output[base + 3] = data[3];
    `;

  const pipeline = createPipeline(t, encoderType, wgslDecl, copyCode, immediateSize);

  const outputBuffer = t.createBufferTracked({
    size: 4 * 4 * 3, // 3 steps, 4 u32s each
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
  });

  // Uniform buffer with output indices [0, 1, 2] at 256-byte aligned offsets,
  // used to direct each dispatch/draw step to a separate region of the output buffer.
  const indexUniformBuffer = createOutputIndexBuffer(t, 3);

  const bindGroup = t.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
    { binding: 0, resource: { buffer: outputBuffer } },
    { binding: 1, resource: { buffer: indexUniformBuffer, size: 4 } }]

  });

  const commandEncoder = t.device.createCommandEncoder();

  /** Set bind group with dynamic offset for output index, set immediates, and dispatch/draw. */
  const runStep = (
  pass,
  stepIndex,
  data,
  dstOffset = 0) =>
  {
    pass.setBindGroup(0, bindGroup, [stepIndex * 256]);
    pass.setImmediates(dstOffset, data);
    dispatchOrDraw(encoderType, pass);
  };

  encodeForPassType(t, encoderType, commandEncoder, (enc) => {
    setPipeline(encoderType, enc, pipeline);

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

g.test('pipeline_switch').
desc(
  `Verify immediate data is correctly set after switching pipelines.
    - sameImmediateSize=true: Both pipelines use the same immediateSize.
    - sameImmediateSize=false: Pipelines use different immediateSize values.
    In both cases, immediates must be set correctly between draws/dispatches.`
).
params((u) =>
u.
combine('encoderType', ['render pass', 'compute pass']).
combine('sameImmediateSize', [true, false])
).
fn((t) => {
  const { encoderType, sameImmediateSize } = t.params;
  t.skipIfStorageBuffersInFragmentStageNotAvailable(encoderType);

  // Pipeline A always uses vec4<u32> (16 bytes).
  const wgslDeclA = 'var<immediate> data: vec4<u32>;';
  const copyCodeA = `
      output[0] = data.x; output[1] = data.y; output[2] = data.z; output[3] = data.w;
    `;

  let wgslDeclB;
  let copyCodeB;
  let immediateSizeB;

  if (sameImmediateSize) {
    // Pipeline B has the same immediate layout as A (vec4<u32>, 16 bytes).
    wgslDeclB = wgslDeclA;
    copyCodeB = copyCodeA;
    immediateSizeB = 16;
  } else {
    // Pipeline B uses vec2<u32> (8 bytes) — different/incompatible layout.
    wgslDeclB = 'var<immediate> data: vec2<u32>;';
    copyCodeB = `
        output[0] = data.x; output[1] = data.y; output[2] = 0u; output[3] = 0u;
      `;
    immediateSizeB = 8;
  }

  // Same source data for both cases; dataSize controls how many elements are written.
  const immDataB = new Uint32Array([5, 6, 7, 8]);
  const immDataSizeB = sameImmediateSize ? undefined : immediateSizeB / 4;
  const expectedB = sameImmediateSize ? [5, 6, 7, 8] : [5, 6, 0, 0];

  const bindGroupLayout = t.device.createBindGroupLayout({
    entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
      buffer: { type: 'storage' }
    },
    {
      binding: 1,
      visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
      buffer: { type: 'uniform', hasDynamicOffset: true }
    }]

  });

  const layoutA = t.device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
    immediateSize: 16
  });
  const pipelineA = createPipeline(t, encoderType, wgslDeclA, copyCodeA, 16, layoutA);

  const layoutB = t.device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
    immediateSize: immediateSizeB
  });
  const pipelineB = createPipeline(t, encoderType, wgslDeclB, copyCodeB, immediateSizeB, layoutB);

  const outputBuffer = t.createBufferTracked({
    size: 16, // 4 u32s at outIndex 0
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
  });
  const indexUniformBuffer = createOutputIndexBuffer(t, 1);

  const bindGroup = t.device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
    { binding: 0, resource: { buffer: outputBuffer } },
    { binding: 1, resource: { buffer: indexUniformBuffer, size: 4 } }]

  });

  const commandEncoder = t.device.createCommandEncoder();
  encodeForPassType(t, encoderType, commandEncoder, (enc) => {
    // Only set bind group once between bind group compatible pipelines.
    setPipeline(encoderType, enc, pipelineA);
    enc.setBindGroup(0, bindGroup, [0]);
    enc.setImmediates(0, new Uint32Array([1, 2, 3, 4]));

    // Switch to Pipeline B without re-setting the bind group.
    // The bind group set under Pipeline A must remain valid.
    setPipeline(encoderType, enc, pipelineB);
    // Same source data; dataSize controls how many elements are written.
    // Passing undefined for srcOffset/srcSize relies on WebIDL defaults (0 / array.length).
    enc.setImmediates(0, immDataB, undefined, immDataSizeB);
    dispatchOrDraw(encoderType, enc);
  });

  t.device.queue.submit([commandEncoder.finish()]);

  // Pipeline B's draw used the bind group set under Pipeline A.
  t.expectGPUBufferValuesEqual(outputBuffer, new Uint32Array(expectedB));
});

g.test('use_max_immediate_size').
desc('Verify setImmediates with maxImmediateSize.').
params((u) => u.combine('encoderType', kProgrammableEncoderTypes)).
fn((t) => {
  const { encoderType } = t.params;
  t.skipIfStorageBuffersInFragmentStageNotAvailable(encoderType);

  const maxImmediateSize = t.device.limits.maxImmediateSize;
  if (maxImmediateSize === undefined) {
    t.skip('maxImmediateSize limit is undefined');
    return;
  }

  // Create a pipeline that reads the first and last u32 of the immediate data
  const count = maxImmediateSize / 4;
  const members = [];
  for (let i = 0; i < count; i++) {
    members.push(`m${i}: u32`);
  }
  const wgslDecl = `struct Large { ${members.join(', ')} } var<immediate> data: Large;`;
  const copyCode = `
      output[0] = data.m0;
      output[1] = data.m${count - 1};
    `;

  const pipeline = createPipeline(t, encoderType, wgslDecl, copyCode, maxImmediateSize);

  const outputBuffer = t.createBufferTracked({
    size: 8,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
  });
  const indexUniformBuffer = createOutputIndexBuffer(t, 1);

  const bindGroup = t.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
    { binding: 0, resource: { buffer: outputBuffer } },
    { binding: 1, resource: { buffer: indexUniformBuffer, size: 4 } }]

  });

  const commandEncoder = t.device.createCommandEncoder();
  encodeForPassType(t, encoderType, commandEncoder, (enc) => {
    const data = new Uint32Array(count);
    data[0] = 0xdeadbeef;
    data[count - 1] = 0xcafebabe;

    setPipeline(encoderType, enc, pipeline);
    enc.setBindGroup(0, bindGroup, [0]);
    enc.setImmediates(0, data);
    dispatchOrDraw(encoderType, enc);
  });

  t.device.queue.submit([commandEncoder.finish()]);
  t.expectGPUBufferValuesEqual(outputBuffer, new Uint32Array([0xdeadbeef, 0xcafebabe]));
});

g.test('typed_array_arguments').
desc('Verify dataOffset and dataSize arguments work correctly for all TypedArray types.').
params((u) =>
u.
combine('typedArray', kTypedArrayBufferViewKeys).
combine('encoderType', kProgrammableEncoderTypes).
beginSubcases().
expandWithParams(function* (p) {
  const elementSize = kTypedArrayBufferViews[p.typedArray].BYTES_PER_ELEMENT;
  // Smallest element count that produces a 4-byte-aligned byte size.
  const smallCount = Math.max(1, Math.ceil(4 / elementSize));
  yield { dataOffset: undefined, dataSize: undefined };
  yield { dataOffset: 0, dataSize: undefined };
  yield { dataOffset: smallCount, dataSize: undefined };
  yield { dataOffset: undefined, dataSize: smallCount };
  yield { dataOffset: 0, dataSize: smallCount };
  yield { dataOffset: smallCount, dataSize: smallCount };
})
).
fn((t) => {
  const { typedArray, encoderType, dataOffset, dataSize } = t.params;
  t.skipIf(typedArray === 'Float16Array', 'TODO(#4297): Float16Array not yet supported');
  t.skipIfStorageBuffersInFragmentStageNotAvailable(encoderType);
  const Ctor = kTypedArrayBufferViews[typedArray];
  const elementSize = Ctor.BYTES_PER_ELEMENT;

  // 64 bytes of immediate data (4 x vec4<u32>). This size must match the WGSL struct below.
  const kImmediateByteSize = 64;
  const kImmediateU32Count = kImmediateByteSize / 4;
  const wgslDecl = `
      struct ImmediateData {
        m0: vec4<u32>,
        m1: vec4<u32>,
        m2: vec4<u32>,
        m3: vec4<u32>
      }
      var<immediate> data: ImmediateData;
    `;
  const copyCode = `
      output[0] = data.m0.x;
      output[1] = data.m0.y;
      output[2] = data.m0.z;
      output[3] = data.m0.w;
      output[4] = data.m1.x;
      output[5] = data.m1.y;
      output[6] = data.m1.z;
      output[7] = data.m1.w;
      output[8] = data.m2.x;
      output[9] = data.m2.y;
      output[10] = data.m2.z;
      output[11] = data.m2.w;
      output[12] = data.m3.x;
      output[13] = data.m3.y;
      output[14] = data.m3.z;
      output[15] = data.m3.w;
    `;
  const pipeline = createPipeline(t, encoderType, wgslDecl, copyCode, kImmediateByteSize);

  const actualDataOffset = dataOffset ?? 0;
  const maxElements = kImmediateByteSize / elementSize;
  const actualDataSize = dataSize ?? maxElements - actualDataOffset;

  // Validate that the byte size is 4-byte aligned and fits in the immediate block.
  const byteSize = actualDataSize * elementSize;
  assert(
    byteSize <= kImmediateByteSize && byteSize % 4 === 0,
    `byteSize ${byteSize} must be <= ${kImmediateByteSize} and a multiple of 4`
  );

  // When dataSize is explicit, add padding elements to verify setImmediates
  // respects the dataSize boundary and doesn't read beyond it.
  // When dataSize is undefined, no padding since setImmediates reads to the end of the array.
  const paddingElements = dataSize !== undefined ? 4 : 0;
  const arr = new Ctor(actualDataOffset + actualDataSize + paddingElements);
  const view = new DataView(arr.buffer);

  // Fill the data region with a recognizable byte pattern.
  const dataByteOffset = actualDataOffset * elementSize;
  const dataByteSize = actualDataSize * elementSize;
  for (let byte = 0; byte < dataByteSize; byte++) {
    view.setUint8(dataByteOffset + byte, 0x10 + byte);
  }

  // Baseline clear pattern for the full immediate block.
  const clearData = new Uint32Array(kImmediateU32Count);
  for (let i = 0; i < kImmediateU32Count; i++) clearData[i] = 0xaaaaaaaa + i * 0x11111111;

  const outputBuffer = t.createBufferTracked({
    size: kImmediateByteSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
  });
  const indexUniformBuffer = createOutputIndexBuffer(t, 1);
  const bindGroup = t.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
    { binding: 0, resource: { buffer: outputBuffer } },
    { binding: 1, resource: { buffer: indexUniformBuffer, size: 4 } }]

  });

  const commandEncoder = t.device.createCommandEncoder();
  encodeForPassType(t, encoderType, commandEncoder, (enc) => {
    setPipeline(encoderType, enc, pipeline);
    enc.setBindGroup(0, bindGroup, [0]);

    // Initialize immediates to the baseline clear pattern.
    enc.setImmediates(0, clearData);

    // Overwrite with typed array data using the parametrized offset/size.
    // Passing undefined for dataOffset/dataSize uses the WebIDL default (0 / array.length).
    enc.setImmediates(0, arr, dataOffset, dataSize);

    dispatchOrDraw(encoderType, enc);
  });
  t.device.queue.submit([commandEncoder.finish()]);

  // Build expected: baseline pattern with the written typed-array bytes overlaid at offset 0.
  const expected = new Uint32Array(clearData);
  memcpy(
    {
      src: arr.buffer,
      start: actualDataOffset * elementSize,
      length: actualDataSize * elementSize
    },
    { dst: expected.buffer, start: 0 }
  );

  t.expectGPUBufferValuesEqual(outputBuffer, expected);
});

g.test('multiple_updates_before_draw_or_dispatch').
desc(
  'Verify that multiple setImmediates calls before a draw or dispatch result in the latest content being used (merging updates).'
).
params((u) => u.combine('encoderType', kProgrammableEncoderTypes)).
fn((t) => {
  const { encoderType } = t.params;
  t.skipIfStorageBuffersInFragmentStageNotAvailable(encoderType);
  // Use vec4<u32> to allow partial updates.
  const wgslDecl = 'var<immediate> data: vec4<u32>;';
  const copyCode =
  'output[0] = data.x; output[1] = data.y; output[2] = data.z; output[3] = data.w;';
  const pipeline = createPipeline(t, encoderType, wgslDecl, copyCode, 16);

  runAndCheck(
    t,
    encoderType,
    pipeline,
    (encoder) => {
      // 1. Set all to [1, 2, 3, 4]
      encoder.setImmediates(0, new Uint32Array([1, 2, 3, 4]));
      // 2. Update middle two to [5, 6] -> [1, 5, 6, 4]
      encoder.setImmediates(4, new Uint32Array([5, 6]));
      // 3. Update last to [7] -> [1, 5, 6, 7]
      encoder.setImmediates(12, new Uint32Array([7]));
    },
    [1, 5, 6, 7]
  );
});

g.test('render_pass_and_bundle_mix').
desc('Verify interaction between executeBundles and direct render pass commands.').
fn((t) => {
  t.skipIfStorageBuffersInFragmentStageNotAvailable('render pass');
  const wgslDecl = 'var<immediate> data: vec2<u32>;';
  const copyCode = `
      let base = outIndex * 2;
      output[base] = data.x;
      output[base + 1] = data.y;
    `;
  // Use 'render pass' type to create the pipeline, but it works for bundle too.
  // Immediate size: vec2<u32> = 2 * 4 bytes = 8 bytes.
  const pipeline = createPipeline(t, 'render pass', wgslDecl, copyCode, 8);

  const outputBuffer = t.createBufferTracked({
    size: 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
  });
  const indexUniformBuffer = createOutputIndexBuffer(t, 2);

  const bindGroup = t.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
    { binding: 0, resource: { buffer: outputBuffer } },
    { binding: 1, resource: { buffer: indexUniformBuffer, size: 4 } }]

  });

  // Bundle: Set [1, 10], Draw (Index 0)
  const bundleEncoder = t.device.createRenderBundleEncoder({ colorFormats: ['r32uint'] });
  bundleEncoder.setPipeline(pipeline);
  bundleEncoder.setBindGroup(0, bindGroup, [0]);
  bundleEncoder.setImmediates(0, new Uint32Array([1, 10]));
  bundleEncoder.draw(1);
  const bundle = bundleEncoder.finish();

  const renderTargetTexture = t.createTextureTracked({
    size: [4, 1, 1],
    format: 'r32uint',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
  });
  const commandEncoder = t.device.createCommandEncoder();
  const pass = commandEncoder.beginRenderPass({
    colorAttachments: [
    {
      view: renderTargetTexture.createView(),
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: { r: 0, g: 0, b: 0, a: 0 }
    }]

  });

  // Execute Bundle
  pass.executeBundles([bundle]);

  // Pass: Set [2, 20], Draw (Index 1)
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup, [256]);
  pass.setImmediates(0, new Uint32Array([2, 20]));
  pass.draw(1);

  pass.end();
  t.device.queue.submit([commandEncoder.finish()]);

  t.expectGPUBufferValuesEqual(outputBuffer, new Uint32Array([1, 10, 2, 20]));
});

g.test('render_bundle_isolation').
desc('Verify that immediate data state is isolated between bundles executed in the same pass.').
fn((t) => {
  t.skipIfStorageBuffersInFragmentStageNotAvailable('render bundle');
  const wgslDecl = 'var<immediate> data: vec2<u32>;';
  const copyCode = `
      let base = outIndex * 2;
      output[base] = data.x;
      output[base + 1] = data.y;
    `;
  const pipeline = createPipeline(t, 'render pass', wgslDecl, copyCode, 8);

  const outputBuffer = t.createBufferTracked({
    size: 16, // 2 draws * 2 u32s * 4 bytes
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
  });
  const indexUniformBuffer = createOutputIndexBuffer(t, 2);

  const bindGroup = t.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
    { binding: 0, resource: { buffer: outputBuffer } },
    { binding: 1, resource: { buffer: indexUniformBuffer, size: 4 } }]

  });

  // Bundle A: Set [1, 2], Draw (Index 0)
  const bundleEncoderA = t.device.createRenderBundleEncoder({ colorFormats: ['r32uint'] });
  bundleEncoderA.setPipeline(pipeline);
  bundleEncoderA.setBindGroup(0, bindGroup, [0]);
  bundleEncoderA.setImmediates(0, new Uint32Array([1, 2]));
  bundleEncoderA.draw(1);
  const bundleA = bundleEncoderA.finish();

  // Bundle B: Set [3, 4], Draw (Index 1)
  const bundleEncoderB = t.device.createRenderBundleEncoder({ colorFormats: ['r32uint'] });
  bundleEncoderB.setPipeline(pipeline);
  bundleEncoderB.setBindGroup(0, bindGroup, [256]);
  bundleEncoderB.setImmediates(0, new Uint32Array([3, 4]));
  bundleEncoderB.draw(1);
  const bundleB = bundleEncoderB.finish();

  const renderTargetTexture = t.createTextureTracked({
    size: [4, 1, 1],
    format: 'r32uint',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
  });
  const commandEncoder = t.device.createCommandEncoder();
  const pass = commandEncoder.beginRenderPass({
    colorAttachments: [
    {
      view: renderTargetTexture.createView(),
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: { r: 0, g: 0, b: 0, a: 0 }
    }]

  });

  // Execute Bundles
  pass.executeBundles([bundleA, bundleB]);

  pass.end();
  t.device.queue.submit([commandEncoder.finish()]);

  t.expectGPUBufferValuesEqual(outputBuffer, new Uint32Array([1, 2, 3, 4]));
});