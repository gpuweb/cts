export const description = `
Operation tests for immediate data usage in RenderPassEncoder, ComputePassEncoder, and RenderBundleEncoder.
`;

import { kUnitCaseParamsBuilder } from '../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { getGPU } from '../../../../../common/util/navigator_gpu.js';
import {
  assert,
  hasFeature,
  kTypedArrayBufferViews,
  kTypedArrayBufferViewKeys,
  memcpy,
  supportsImmediateData,
  unreachable,
} from '../../../../../common/util/util.js';
import { AllFeaturesMaxLimitsGPUTest } from '../../../../gpu_test.js';
import { HostSharableTypes, kVectorContainerTypes, ScalarType } from '../../../../shader/types.js';
import {
  kProgrammableEncoderTypes,
  ProgrammableEncoderType,
} from '../../../../util/command_buffer_maker.js';
import { align } from '../../../../util/math.js';

const kRenderTargetFormat = 'rgba32uint' as const;
const kBytesPerPixel = 16; // rgba32uint = 4 x u32 = 16 bytes
const kMinBytesPerRow = 256; // WebGPU requires bytesPerRow to be a multiple of 256

type ImmediateStage = 'compute' | 'vertex' | 'fragment';

interface DrawOptions {
  indirectBuffer?: GPUBuffer;
  indirectOffset?: number;
  indexBuffer?: GPUBuffer;
  maxDrawCount?: number;
  drawCountBuffer?: GPUBuffer;
  drawCountOffset?: number;
}

const kIndirectExecutionParams = kUnitCaseParamsBuilder
  .combine('encoderType', kProgrammableEncoderTypes)
  .expand('stage', p =>
    p.encoderType === 'compute pass' ? (['compute'] as const) : (['vertex', 'fragment'] as const)
  )
  .expand('indexed', p => (p.encoderType === 'compute pass' ? [false] : [false, true]));

const kBundleExecutionParams = kUnitCaseParamsBuilder
  .combine('drawType', ['direct', 'indexed', 'indirect', 'indexed-indirect'] as const)
  .combine('stage', ['vertex', 'fragment'] as const);

class ImmediateDataOperationTest extends AllFeaturesMaxLimitsGPUTest {
  override async init() {
    await super.init();

    if (!supportsImmediateData(getGPU(this.rec))) {
      this.skip('Immediate data not supported');
      return;
    }
  }
}

/**
 * Creates a pipeline for testing immediate data.
 *
 * For compute pipelines: uses a storage buffer to write results.
 * For render pipelines: reads immediates in the selected shader stage and returns results via
 *   rgba32uint color output. The output pixel is selected by outIndex plus vertex_index.
 *
 * @param copyCode - Code that writes to `output[]` array (used by compute shader)
 * @param fragmentReturnExpr - WGSL expression returning vec4u (used by fragment shader)
 * @param renderTargetWidth - Width of the render target in pixels (for vertex positioning)
 * @param immediateStage - Shader stage that reads immediate data (ignored for compute pipelines)
 */
function createPipeline(
  t: AllFeaturesMaxLimitsGPUTest,
  encoderType: ProgrammableEncoderType,
  wgslDecl: string,
  copyCode: string,
  fragmentReturnExpr: string,
  immediateSize: number,
  renderTargetWidth: number = 4,
  pipelineLayout?: GPUPipelineLayout,
  immediateStage: ImmediateStage = 'fragment'
) {
  if (encoderType === 'compute pass') {
    const layout =
      pipelineLayout ||
      t.device.createPipelineLayout({
        bindGroupLayouts: [
          t.device.createBindGroupLayout({
            entries: [
              {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: 'storage' },
              },
              {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: 'uniform', hasDynamicOffset: true },
              },
            ],
          }),
        ],
        immediateSize,
      });

    const computeCode = `
      ${wgslDecl}
      @group(0) @binding(0) var<storage, read_write> output: array<u32>;
      @group(0) @binding(1) var<uniform> outIndex: u32;

      @compute @workgroup_size(1) fn cs_main() {
        ${copyCode}
      }
    `;

    return t.device.createComputePipeline({
      layout,
      compute: {
        module: t.device.createShaderModule({ code: computeCode }),
      },
    });
  } else {
    // Render pipeline: no storage buffer needed.
    // The fragment shader returns results via the render target color output.
    const layout =
      pipelineLayout ||
      t.device.createPipelineLayout({
        bindGroupLayouts: [
          t.device.createBindGroupLayout({
            entries: [
              {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                buffer: { type: 'uniform', hasDynamicOffset: true },
              },
            ],
          }),
        ],
        immediateSize,
      });

    let vertexCode = `
      @group(0) @binding(0) var<uniform> outIndex: u32;

      @vertex fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
        // Map outIndex to pixel centers in a ${renderTargetWidth}x1 render target.
        let x = (f32(outIndex + vertexIndex) + 0.5) / f32(${renderTargetWidth}) * 2.0 - 1.0;
        return vec4f(x, 0.0, 0.0, 1.0);
      }
    `;

    let fragmentCode = `
      ${wgslDecl}
      @group(0) @binding(0) var<uniform> outIndex: u32;

      @fragment fn fs_main() -> @location(0) vec4u {
        return ${fragmentReturnExpr};
      }
    `;

    if (immediateStage === 'vertex') {
      vertexCode = `
        ${wgslDecl}
        @group(0) @binding(0) var<uniform> outIndex: u32;
        struct VertexOutput {
          @builtin(position) position: vec4f,
          @location(0) @interpolate(flat, either) value: vec4u,
        }
        @vertex fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
          let x = (f32(outIndex + vertexIndex) + 0.5) / f32(${renderTargetWidth}) * 2.0 - 1.0;
          return VertexOutput(vec4f(x, 0.0, 0.0, 1.0), ${fragmentReturnExpr});
        }
      `;
      fragmentCode = `
        @fragment fn fs_main(@location(0) @interpolate(flat, either) value: vec4u) -> @location(0) vec4u {
          return value;
        }
      `;
    }

    return t.device.createRenderPipeline({
      layout,
      vertex: {
        module: t.device.createShaderModule({ code: vertexCode }),
      },
      fragment: {
        module: t.device.createShaderModule({ code: fragmentCode }),
        targets: [{ format: kRenderTargetFormat }],
      },
      primitive: {
        topology: 'point-list',
      },
    });
  }
}

/** Issue a direct, indirect, or indexed command; maxDrawCount selects render-pass multi-draw. */
function dispatchOrDraw(
  encoderType: ProgrammableEncoderType,
  encoder: GPUComputePassEncoder | GPURenderPassEncoder | GPURenderBundleEncoder,
  {
    indirectBuffer,
    indirectOffset = 0,
    indexBuffer,
    maxDrawCount,
    drawCountBuffer,
    drawCountOffset = 0,
  }: DrawOptions = {}
) {
  if (encoderType === 'compute pass') {
    const pass = encoder as GPUComputePassEncoder;
    if (indirectBuffer) {
      pass.dispatchWorkgroupsIndirect(indirectBuffer, indirectOffset);
    } else {
      pass.dispatchWorkgroups(1);
    }
  } else {
    const pass = encoder as GPURenderPassEncoder | GPURenderBundleEncoder;
    if (indexBuffer) {
      pass.setIndexBuffer(indexBuffer, 'uint32');
    }
    if (maxDrawCount !== undefined) {
      assert(encoderType === 'render pass' && indirectBuffer !== undefined);
      const method = indexBuffer ? 'multiDrawIndexedIndirect' : 'multiDrawIndirect';
      const multiPass = pass as GPURenderPassEncoder & {
        [name in typeof method]: (
          buffer: GPUBuffer,
          offset: number,
          count: number,
          countBuffer?: GPUBuffer,
          countOffset?: number
        ) => void;
      };
      multiPass[method](
        indirectBuffer,
        indirectOffset,
        maxDrawCount,
        drawCountBuffer,
        drawCountOffset
      );
    } else if (indirectBuffer) {
      if (indexBuffer) {
        pass.drawIndexedIndirect(indirectBuffer, indirectOffset);
      } else {
        pass.drawIndirect(indirectBuffer, indirectOffset);
      }
    } else if (indexBuffer) {
      pass.drawIndexed(1);
    } else {
      pass.draw(1);
    }
  }
}

/** Create one nonempty indirect command and its index buffer, when indexed. */
function createIndirectDrawOptions(
  t: AllFeaturesMaxLimitsGPUTest,
  encoderType: ProgrammableEncoderType,
  indexed: boolean,
  indirectOffset: number = 0
): DrawOptions {
  const args =
    encoderType === 'compute pass' ? [1, 1, 1] : indexed ? [1, 1, 0, 0, 0] : [1, 1, 0, 0];
  const contents = new Uint32Array(indirectOffset / 4 + args.length);
  contents.set(args, indirectOffset / 4);
  return {
    indirectBuffer: t.makeBufferWithContents(contents, GPUBufferUsage.INDIRECT),
    indirectOffset,
    indexBuffer: indexed
      ? t.makeBufferWithContents(new Uint32Array([0]), GPUBufferUsage.INDEX)
      : undefined,
  };
}

/**
 * Create a uniform buffer with output indices at 256-byte aligned offsets for dynamic binding.
 * A uniform buffer with dynamic offsets is used to provide the output index because:
 *  1. It works uniformly across all shader stages (compute, vertex, fragment).
 *  2. It doesn't consume the immediate data capability that these tests are actively exercising.
 */
function createOutputIndexBuffer(t: AllFeaturesMaxLimitsGPUTest, count: number): GPUBuffer {
  const buffer = t.createBufferTracked({
    size: 256 * count,
    usage: GPUBufferUsage.UNIFORM,
    mappedAtCreation: true,
  });
  const data = new Uint32Array(buffer.getMappedRange());
  for (let i = 0; i < count; i++) {
    data[(i * 256) / 4] = i;
  }
  buffer.unmap();
  return buffer;
}

/**
 * Encode a pass for the given encoder type.
 * For render paths, creates an rgba32uint render target and returns it so callers can read back.
 */
function encodeForPassType(
  t: AllFeaturesMaxLimitsGPUTest,
  encoderType: ProgrammableEncoderType,
  commandEncoder: GPUCommandEncoder,
  fn: (pass: GPURenderPassEncoder | GPUComputePassEncoder | GPURenderBundleEncoder) => void,
  renderTargetWidth: number = 4
): GPUTexture | undefined {
  if (encoderType === 'compute pass') {
    const pass = commandEncoder.beginComputePass();
    fn(pass);
    pass.end();
    return undefined;
  } else {
    const renderTargetTexture = t.createTextureTracked({
      size: [renderTargetWidth, 1, 1],
      format: kRenderTargetFormat,
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
        colorFormats: [kRenderTargetFormat],
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

    return renderTargetTexture;
  }
}

function setPipeline(
  encoderType: ProgrammableEncoderType,
  encoder: GPUComputePassEncoder | GPURenderPassEncoder | GPURenderBundleEncoder,
  pipeline: GPURenderPipeline | GPUComputePipeline
) {
  if (encoderType === 'compute pass') {
    (encoder as GPUComputePassEncoder).setPipeline(pipeline as GPUComputePipeline);
  } else {
    (encoder as GPURenderPassEncoder | GPURenderBundleEncoder).setPipeline(
      pipeline as GPURenderPipeline
    );
  }
}

/**
 * Run a pipeline and check the output values.
 *
 * For compute: writes to a storage buffer and checks it directly.
 * For render: reads back the rgba32uint render target and checks pixel values.
 *
 * Simple mode (encodeFn omitted): a single draw/dispatch. The caller provides setImmediatesFn
 * which is called after setPipeline + setBindGroup. expectedValues.length must be <= 4.
 *
 * Multi-draw mode (encodeFn provided): the caller drives all bind group / immediate / draw calls
 * via encodeFn(enc, bindGroup, indexUniformBuffer). numDraws and outputU32sPerDraw control the
 * output buffer size and render target width.
 */
function runAndCheck(
  t: AllFeaturesMaxLimitsGPUTest,
  encoderType: ProgrammableEncoderType,
  pipeline: GPURenderPipeline | GPUComputePipeline,
  setImmediatesFn: (
    encoder: GPUComputePassEncoder | GPURenderPassEncoder | GPURenderBundleEncoder
  ) => void,
  expectedValues: number[],
  {
    numDraws = 1,
    outputU32sPerDraw,
    encodeFn,
    renderTargetWidth = 4,
    drawOptions,
  }: {
    numDraws?: number;
    outputU32sPerDraw?: number;
    encodeFn?: (
      enc: GPUComputePassEncoder | GPURenderPassEncoder | GPURenderBundleEncoder,
      bindGroup: GPUBindGroup,
      indexUniformBuffer: GPUBuffer
    ) => void;
    renderTargetWidth?: number;
    drawOptions?: DrawOptions;
  } = {}
) {
  assert(expectedValues.length > 0, 'expectedValues must not be empty');

  // In multi-draw mode, outputU32sPerDraw must be specified.
  // In simple mode, it defaults to expectedValues.length (single draw).
  const u32sPerDraw = outputU32sPerDraw ?? expectedValues.length;

  const indexUniformBuffer = encodeFn
    ? createOutputIndexBuffer(t, numDraws)
    : t.makeBufferWithContents(new Uint32Array([0]), GPUBufferUsage.UNIFORM);

  if (encoderType === 'compute pass') {
    const outputBuffer = t.createBufferTracked({
      size: u32sPerDraw * 4 * numDraws,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const bindGroup = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: outputBuffer } },
        { binding: 1, resource: { buffer: indexUniformBuffer, size: 4 } },
      ],
    });

    const commandEncoder = t.device.createCommandEncoder();
    encodeForPassType(t, encoderType, commandEncoder, encoder => {
      setPipeline(encoderType, encoder, pipeline);
      if (encodeFn) {
        encodeFn(encoder, bindGroup, indexUniformBuffer);
      } else {
        encoder.setBindGroup(0, bindGroup, [0]);
        setImmediatesFn(encoder);
        dispatchOrDraw(encoderType, encoder, drawOptions);
      }
    });

    t.device.queue.submit([commandEncoder.finish()]);
    t.expectGPUBufferValuesEqual(outputBuffer, new Uint32Array(expectedValues));
  } else {
    assert(u32sPerDraw <= 4, 'runAndCheck supports at most 4 u32s per draw (one rgba32uint pixel)');

    const bindGroup = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: indexUniformBuffer, size: 4 } }],
    });

    const commandEncoder = t.device.createCommandEncoder();
    const pixelWidth = encodeFn ? renderTargetWidth : 1;
    const renderTarget = encodeForPassType(
      t,
      encoderType,
      commandEncoder,
      encoder => {
        setPipeline(encoderType, encoder, pipeline);
        if (encodeFn) {
          encodeFn(encoder, bindGroup, indexUniformBuffer);
        } else {
          encoder.setBindGroup(0, bindGroup, [0]);
          setImmediatesFn(encoder);
          dispatchOrDraw(encoderType, encoder, drawOptions);
        }
      },
      pixelWidth
    )!;

    const bytesPerRow = align(pixelWidth * kBytesPerPixel, kMinBytesPerRow);
    const readbackBuffer = t.createBufferTracked({
      size: bytesPerRow,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    commandEncoder.copyTextureToBuffer(
      { texture: renderTarget },
      { buffer: readbackBuffer, bytesPerRow },
      [pixelWidth, 1]
    );

    t.device.queue.submit([commandEncoder.finish()]);

    // Each pixel is 4 u32s (rgba32uint). Pad each draw's output to 4.
    const paddedExpected = new Uint32Array(pixelWidth * 4);
    for (let d = 0; d < numDraws; d++) {
      for (let i = 0; i < u32sPerDraw; i++) {
        paddedExpected[d * 4 + i] = expectedValues[d * u32sPerDraw + i];
      }
    }
    t.expectGPUBufferValuesEqual(readbackBuffer, paddedExpected);
  }
}

export const g = makeTestGroup(ImmediateDataOperationTest);

g.test('basic_execution')
  .desc('Verify immediate data is correctly passed to shaders.')
  .params(u =>
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
  )
  .fn(t => {
    const { encoderType, dataType, scalarType, vectorSize } = t.params;
    t.skipIf(scalarType === 'f16', 'Immediate data blocks do not yet support f16 types');

    let wgslDecl = '';
    let copyCode = '';
    let fragmentReturnExpr = '';
    let immediateSize = 0;
    let expected: number[] = [];
    let inputData: Uint32Array;

    if (dataType === 'struct') {
      immediateSize = 8;
      wgslDecl = `
        struct S { a: u32, b: u32 }
        var<immediate> data: S;
      `;
      copyCode = 'output[0] = data.a; output[1] = data.b;';
      fragmentReturnExpr = 'vec4u(data.a, data.b, 0, 0)';
      inputData = new Uint32Array([0xdeadbeef, 0xcafebabe]);
      expected = [0xdeadbeef, 0xcafebabe];
    } else {
      // Non-struct types (scalar or vector)
      const sType = scalarType as ScalarType;
      const vSize = vectorSize as number;

      immediateSize = vSize * 4;
      wgslDecl = `var<immediate> data: ${dataType};`;

      // bitcast<u32> is identity for u32, so we can use it unconditionally.
      for (let i = 0; i < vSize; i++) {
        const valExpr = vSize === 1 ? 'data' : `data[${i}]`;
        copyCode += `output[${i}] = bitcast<u32>(${valExpr});\n`;
      }

      // Build fragment return expression: pack values into vec4u, padding with 0.
      if (vSize === 1) {
        fragmentReturnExpr = 'vec4u(bitcast<u32>(data), 0, 0, 0)';
      } else if (vSize === 2) {
        fragmentReturnExpr = 'vec4u(bitcast<u32>(data[0]), bitcast<u32>(data[1]), 0, 0)';
      } else if (vSize === 3) {
        fragmentReturnExpr =
          'vec4u(bitcast<u32>(data[0]), bitcast<u32>(data[1]), bitcast<u32>(data[2]), 0)';
      } else {
        // vSize === 4
        fragmentReturnExpr =
          'vec4u(bitcast<u32>(data[0]), bitcast<u32>(data[1]), bitcast<u32>(data[2]), bitcast<u32>(data[3]))';
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

    const pipeline = createPipeline(
      t,
      encoderType,
      wgslDecl,
      copyCode,
      fragmentReturnExpr,
      immediateSize
    );

    runAndCheck(
      t,
      encoderType,
      pipeline,
      encoder => {
        encoder.setImmediates(0, inputData);
      },
      expected
    );
  });

g.test('indirect_execution')
  .desc(
    `
    Verify immediate values are preserved by indirect dispatches and indexed/non-indexed indirect
    draws in render passes and bundles. Render shaders consume immediates in either stage.
    Exercise a single indirect command, repeated commands without resetting immediates,
    direct-indirect-direct sequences, and partial updates between indirect commands.
    Check each command's output separately, with zero and nonzero indirect-buffer offsets.
  `
  )
  .params(
    kIndirectExecutionParams
      .beginSubcases()
      .combine('indirectOffset', [0, 16])
      .combine('sequence', ['single', 'repeated', 'mixed', 'partial_update'] as const)
  )
  .fn(t => {
    const { encoderType, stage, indexed, indirectOffset, sequence } = t.params;
    const numDraws = sequence === 'single' ? 1 : 3;
    const pipeline = createPipeline(
      t,
      encoderType,
      'var<immediate> data: vec4u;',
      `
        let base = outIndex * 4;
        output[base] = data.x;
        output[base + 1] = data.y;
        output[base + 2] = data.z;
        output[base + 3] = data.w;
      `,
      'data',
      16,
      numDraws,
      undefined,
      stage
    );
    const drawOptions = createIndirectDrawOptions(t, encoderType, indexed, indirectOffset);
    const initial = [25, 128, 240, 255];
    const subsequent = sequence === 'partial_update' ? [25, 42, 43, 255] : initial;
    const expected = sequence === 'single' ? initial : [...initial, ...subsequent, ...subsequent];

    runAndCheck(
      t,
      encoderType,
      pipeline,
      encoder => encoder.setImmediates(0, new Uint32Array(initial)),
      expected,
      {
        numDraws,
        outputU32sPerDraw: 4,
        renderTargetWidth: numDraws,
        drawOptions,
        encodeFn:
          sequence === 'single'
            ? undefined
            : (encoder, bindGroup) => {
                encoder.setImmediates(0, new Uint32Array(initial));
                for (let commandIndex = 0; commandIndex < numDraws; commandIndex++) {
                  encoder.setBindGroup(0, bindGroup, [commandIndex * 256]);
                  if (sequence === 'partial_update' && commandIndex === 1) {
                    encoder.setImmediates(4, new Uint32Array([42, 43]));
                  }
                  const direct = sequence === 'mixed' && commandIndex !== 1;
                  dispatchOrDraw(
                    encoderType,
                    encoder,
                    direct ? { indexBuffer: drawOptions.indexBuffer } : drawOptions
                  );
                }
              },
      }
    );
  });

g.test('multi_draw_indirect')
  .desc(
    `
    Verify experimental multiDrawIndirect and multiDrawIndexedIndirect preserve immediate values
    in vertex and fragment shaders, including a partial update before the multi-draw and a direct
    draw afterward without resetting immediates. Distinct pixels identify each indirect record.
    Exercise zero/nonzero indirect offsets and an optional count buffer with a nonzero offset;
    counts below, equal to, and above maxDrawCount must draw the expected number of records.
  `
  )
  .params(u =>
    u
      .combine('indexed', [false, true])
      .combine('stage', ['vertex', 'fragment'] as const)
      .beginSubcases()
      .combine('indirectOffset', [0, 16])
      .combine('drawCount', ['none', 0, 1, 2, 3] as const)
  )
  .fn(t => {
    t.skipIf(
      !hasFeature(
        t.device.features,
        'chromium-experimental-multi-draw-indirect' as GPUFeatureName
      ) && !hasFeature(t.device.features, 'multi-draw-indirect' as GPUFeatureName),
      'Multi-draw indirect not supported'
    );
    const { indexed, stage, indirectOffset, drawCount } = t.params;
    const renderTargetWidth = 5;
    const pipeline = createPipeline(
      t,
      'render pass',
      'var<immediate> data: vec4u;',
      '',
      'data',
      16,
      renderTargetWidth,
      undefined,
      stage
    );
    const records = indexed
      ? [1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 2, 0, 0]
      : [1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 2, 0];
    const contents = new Uint32Array(indirectOffset / 4 + records.length);
    contents.set(records, indirectOffset / 4);
    const drawOptions: DrawOptions = {
      indirectBuffer: t.makeBufferWithContents(contents, GPUBufferUsage.INDIRECT),
      indirectOffset,
      indexBuffer: indexed
        ? t.makeBufferWithContents(new Uint32Array([0, 1, 2]), GPUBufferUsage.INDEX)
        : undefined,
      maxDrawCount: 2,
      drawCountBuffer:
        drawCount === 'none'
          ? undefined
          : t.makeBufferWithContents(new Uint32Array([0, drawCount]), GPUBufferUsage.INDIRECT),
      drawCountOffset: drawCount === 'none' ? 0 : 4,
    };
    const updated = [25, 42, 43, 255];
    const empty = [0, 0, 0, 0];
    const first = drawCount === 0 ? empty : updated;
    const second = drawCount === 0 || drawCount === 1 ? empty : updated;
    runAndCheck(
      t,
      'render pass',
      pipeline,
      () => {},
      [25, 128, 240, 255, ...first, ...second, ...empty, ...updated],
      {
        numDraws: renderTargetWidth,
        outputU32sPerDraw: 4,
        renderTargetWidth,
        encodeFn: (encoder, bindGroup) => {
          const directOptions = { indexBuffer: drawOptions.indexBuffer };
          encoder.setBindGroup(0, bindGroup, [0]);
          encoder.setImmediates(0, new Uint32Array([25, 128, 240, 255]));
          dispatchOrDraw('render pass', encoder, directOptions);
          encoder.setBindGroup(0, bindGroup, [256]);
          encoder.setImmediates(4, new Uint32Array([42, 43]));
          dispatchOrDraw('render pass', encoder, drawOptions);
          encoder.setBindGroup(0, bindGroup, [4 * 256]);
          dispatchOrDraw('render pass', encoder, directOptions);
        },
      }
    );
  });

g.test('update_data')
  .desc('Verify setImmediates updates data correctly within a pass, including partial updates.')
  .params(u => u.combine('encoderType', kProgrammableEncoderTypes))
  .fn(t => {
    const { encoderType } = t.params;
    const immediateSize = 16;
    const wgslDecl = 'var<immediate> data: vec4<u32>;';
    const copyCode = `
      let base = outIndex * 4;
      output[base + 0] = data[0];
      output[base + 1] = data[1];
      output[base + 2] = data[2];
      output[base + 3] = data[3];
    `;
    const fragmentReturnExpr = 'vec4u(data[0], data[1], data[2], data[3])';

    const pipeline = createPipeline(
      t,
      encoderType,
      wgslDecl,
      copyCode,
      fragmentReturnExpr,
      immediateSize
    );

    runAndCheck(t, encoderType, pipeline, () => {}, [1, 2, 3, 4, 5, 6, 7, 8, 5, 9, 10, 8], {
      numDraws: 3,
      outputU32sPerDraw: 4,
      encodeFn: (enc, bindGroup) => {
        // Step 1: Full set [1, 2, 3, 4]
        enc.setBindGroup(0, bindGroup, [0]);
        enc.setImmediates(0, new Uint32Array([1, 2, 3, 4]));
        dispatchOrDraw(encoderType, enc);

        // Step 2: Full update [5, 6, 7, 8]
        enc.setBindGroup(0, bindGroup, [256]);
        enc.setImmediates(0, new Uint32Array([5, 6, 7, 8]));
        dispatchOrDraw(encoderType, enc);

        // Step 3: Partial update offset 4 bytes (index 1) with [9, 10] -> [5, 9, 10, 8]
        enc.setBindGroup(0, bindGroup, [512]);
        enc.setImmediates(4, new Uint32Array([9, 10]));
        dispatchOrDraw(encoderType, enc);
      },
    });
  });

g.test('pipeline_switch')
  .desc(
    `Verify immediate data is correctly set after switching pipelines.
    - sameImmediateSize=true: Both pipelines use the same immediateSize.
    - sameImmediateSize=false: Pipelines use different immediateSize values.
    In both cases, immediates must be set correctly between draws/dispatches.`
  )
  .params(u =>
    u
      .combine('encoderType', ['render pass', 'compute pass'] as const)
      .combine('sameImmediateSize', [true, false] as const)
  )
  .fn(t => {
    const { encoderType, sameImmediateSize } = t.params;

    // Pipeline A always uses vec4<u32> (16 bytes).
    const wgslDeclA = 'var<immediate> data: vec4<u32>;';
    const copyCodeA = `
      output[0] = data.x; output[1] = data.y; output[2] = data.z; output[3] = data.w;
    `;
    const fragmentReturnExprA = 'vec4u(data.x, data.y, data.z, data.w)';

    let wgslDeclB: string;
    let copyCodeB: string;
    let fragmentReturnExprB: string;
    let immediateSizeB: number;

    if (sameImmediateSize) {
      // Pipeline B has the same immediate layout as A (vec4<u32>, 16 bytes).
      wgslDeclB = wgslDeclA;
      copyCodeB = copyCodeA;
      fragmentReturnExprB = fragmentReturnExprA;
      immediateSizeB = 16;
    } else {
      // Pipeline B uses vec2<u32> (8 bytes) — different/incompatible layout.
      wgslDeclB = 'var<immediate> data: vec2<u32>;';
      copyCodeB = `
        output[0] = data.x; output[1] = data.y; output[2] = 0u; output[3] = 0u;
      `;
      fragmentReturnExprB = 'vec4u(data.x, data.y, 0, 0)';
      immediateSizeB = 8;
    }

    // Same source data for both cases; dataSize controls how many elements are written.
    const immDataB = new Uint32Array([5, 6, 7, 8]);
    const immDataSizeB = sameImmediateSize ? undefined : immediateSizeB / 4;
    const expectedB = sameImmediateSize ? [5, 6, 7, 8] : [5, 6, 0, 0];

    // Create a shared bind group layout for both pipelines so they are bind-group-compatible.
    // Compute path needs storage + uniform; render path needs only uniform.
    const bindGroupLayout = t.device.createBindGroupLayout({
      entries:
        encoderType === 'compute pass'
          ? [
              {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: 'storage' },
              },
              {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: 'uniform', hasDynamicOffset: true },
              },
            ]
          : [
              {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                buffer: { type: 'uniform', hasDynamicOffset: true },
              },
            ],
    });

    const layoutA = t.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
      immediateSize: 16,
    });
    const pipelineA = createPipeline(
      t,
      encoderType,
      wgslDeclA,
      copyCodeA,
      fragmentReturnExprA,
      16,
      4,
      layoutA
    );

    const layoutB = t.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
      immediateSize: immediateSizeB,
    });
    const pipelineB = createPipeline(
      t,
      encoderType,
      wgslDeclB,
      copyCodeB,
      fragmentReturnExprB,
      immediateSizeB,
      4,
      layoutB
    );

    const indexUniformBuffer = createOutputIndexBuffer(t, 1);

    let bindGroup: GPUBindGroup;
    if (encoderType === 'compute pass') {
      const outputBuffer = t.createBufferTracked({
        size: 16, // 4 u32s at outIndex 0
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });
      bindGroup = t.device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: outputBuffer } },
          { binding: 1, resource: { buffer: indexUniformBuffer, size: 4 } },
        ],
      });

      const commandEncoder = t.device.createCommandEncoder();
      encodeForPassType(t, encoderType, commandEncoder, enc => {
        // Only set bind group once between bind group compatible pipelines.
        setPipeline(encoderType, enc, pipelineA);
        enc.setBindGroup(0, bindGroup, [0]);
        enc.setImmediates(0, new Uint32Array([1, 2, 3, 4]));

        // Switch to Pipeline B without re-setting the bind group.
        setPipeline(encoderType, enc, pipelineB);
        enc.setImmediates(0, immDataB, undefined, immDataSizeB);
        dispatchOrDraw(encoderType, enc);
      });

      t.device.queue.submit([commandEncoder.finish()]);
      t.expectGPUBufferValuesEqual(outputBuffer, new Uint32Array(expectedB));
    } else {
      bindGroup = t.device.createBindGroup({
        layout: bindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: indexUniformBuffer, size: 4 } }],
      });

      const commandEncoder = t.device.createCommandEncoder();
      const renderTarget = encodeForPassType(t, encoderType, commandEncoder, enc => {
        setPipeline(encoderType, enc, pipelineA);
        enc.setBindGroup(0, bindGroup, [0]);
        enc.setImmediates(0, new Uint32Array([1, 2, 3, 4]));

        // Switch to Pipeline B without re-setting the bind group.
        setPipeline(encoderType, enc, pipelineB);
        enc.setImmediates(0, immDataB, undefined, immDataSizeB);
        dispatchOrDraw(encoderType, enc);
      })!;

      const bytesPerRow = align(kBytesPerPixel, kMinBytesPerRow);
      const readbackBuffer = t.createBufferTracked({
        size: bytesPerRow,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      });
      commandEncoder.copyTextureToBuffer(
        { texture: renderTarget },
        { buffer: readbackBuffer, bytesPerRow },
        [1, 1]
      );

      t.device.queue.submit([commandEncoder.finish()]);

      // Pad expected to 4 components.
      const paddedExpected = new Uint32Array(4);
      for (let i = 0; i < expectedB.length; i++) {
        paddedExpected[i] = expectedB[i];
      }
      t.expectGPUBufferValuesEqual(readbackBuffer, paddedExpected);
    }
  });

g.test('use_max_immediate_size')
  .desc('Verify setImmediates with maxImmediateSize.')
  .params(u => u.combine('encoderType', kProgrammableEncoderTypes))
  .fn(t => {
    const { encoderType } = t.params;

    const maxImmediateSize = t.device.limits.maxImmediateSize;
    if (maxImmediateSize === undefined) {
      t.skip('maxImmediateSize limit is undefined');
      return;
    }

    // Create a pipeline that reads the first and last u32 of the immediate data
    const count = maxImmediateSize / 4;
    const members: string[] = [];
    for (let i = 0; i < count; i++) {
      members.push(`m${i}: u32`);
    }
    const wgslDecl = `struct Large { ${members.join(', ')} } var<immediate> data: Large;`;
    const copyCode = `
      output[0] = data.m0;
      output[1] = data.m${count - 1};
    `;
    const fragmentReturnExpr = `vec4u(data.m0, data.m${count - 1}, 0, 0)`;

    const pipeline = createPipeline(
      t,
      encoderType,
      wgslDecl,
      copyCode,
      fragmentReturnExpr,
      maxImmediateSize
    );

    const data = new Uint32Array(count);
    data[0] = 0xdeadbeef;
    data[count - 1] = 0xcafebabe;

    runAndCheck(
      t,
      encoderType,
      pipeline,
      encoder => {
        encoder.setImmediates(0, data);
      },
      [0xdeadbeef, 0xcafebabe]
    );
  });

g.test('typed_array_arguments')
  .desc('Verify dataOffset and dataSize arguments work correctly for all TypedArray types.')
  .params(u =>
    u
      .combine('typedArray', kTypedArrayBufferViewKeys)
      .combine('encoderType', kProgrammableEncoderTypes)
      .beginSubcases()
      .expandWithParams(function* (p) {
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
  )
  .fn(t => {
    const { typedArray, encoderType, dataOffset, dataSize } = t.params;
    t.skipIf(typedArray === 'Float16Array', 'TODO(#4297): Float16Array not yet supported');
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
    // For the render path, use outIndex to select which vec4 to return.
    // We do 4 draws at outIndex 0..3, each returning a different vec4.
    const fragmentReturnExpr = `select(select(select(
      vec4u(data.m3),
      vec4u(data.m2),
      outIndex == 2u),
      vec4u(data.m1),
      outIndex == 1u),
      vec4u(data.m0),
      outIndex == 0u)`;

    const pipeline = createPipeline(
      t,
      encoderType,
      wgslDecl,
      copyCode,
      fragmentReturnExpr,
      kImmediateByteSize
    );

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

    // Build expected: baseline pattern with the written typed-array bytes overlaid at offset 0.
    const expected = new Uint32Array(clearData);
    memcpy(
      {
        src: arr.buffer,
        start: actualDataOffset * elementSize,
        length: actualDataSize * elementSize,
      },
      { dst: expected.buffer, start: 0 }
    );

    // For render path, we do 4 draws (one per vec4 member), each outputting 4 u32s to a pixel.
    // For compute path, a single dispatch writes all 16 u32s.
    const numDraws = encoderType === 'compute pass' ? 1 : 4;

    runAndCheck(t, encoderType, pipeline, () => {}, Array.from(expected), {
      numDraws,
      outputU32sPerDraw: encoderType === 'compute pass' ? kImmediateU32Count : 4,
      encodeFn: (enc, bindGroup) => {
        enc.setBindGroup(0, bindGroup, [0]);

        // Initialize immediates to the baseline clear pattern.
        enc.setImmediates(0, clearData);

        // Overwrite with typed array data using the parametrized offset/size.
        enc.setImmediates(0, arr, dataOffset, dataSize);

        if (encoderType === 'compute pass') {
          dispatchOrDraw(encoderType, enc);
        } else {
          // Draw 4 times, each at a different outIndex to read a different vec4.
          for (let i = 0; i < 4; i++) {
            enc.setBindGroup(0, bindGroup, [i * 256]);
            dispatchOrDraw(encoderType, enc);
          }
        }
      },
    });
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
    const copyCode =
      'output[0] = data.x; output[1] = data.y; output[2] = data.z; output[3] = data.w;';
    const fragmentReturnExpr = 'vec4u(data.x, data.y, data.z, data.w)';
    const pipeline = createPipeline(t, encoderType, wgslDecl, copyCode, fragmentReturnExpr, 16);

    runAndCheck(
      t,
      encoderType,
      pipeline,
      encoder => {
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

g.test('render_pass_and_bundle_mix')
  .desc(
    `
    Verify immediate values in vertex/fragment shaders when mixing bundles and render pass commands,
    using direct/indirect and indexed/non-indexed draws. Re-establish pass state after executeBundles.
  `
  )
  .params(kBundleExecutionParams)
  .fn(t => {
    const { drawType, stage } = t.params;
    const drawOptions = createIndirectDrawOptions(t, 'render bundle', drawType.includes('indexed'));
    if (!drawType.includes('indirect')) {
      drawOptions.indirectBuffer = undefined;
    }
    const wgslDecl = 'var<immediate> data: vec2<u32>;';
    const fragmentReturnExpr = 'vec4u(data.x, data.y, 0, 0)';
    const renderTargetWidth = 2;

    const pipeline = createPipeline(
      t,
      'render pass',
      wgslDecl,
      '', // copyCode unused for render-only test
      fragmentReturnExpr,
      8,
      renderTargetWidth,
      undefined,
      stage
    ) as GPURenderPipeline;

    const indexUniformBuffer = createOutputIndexBuffer(t, 2);

    const bindGroup = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: indexUniformBuffer, size: 4 } }],
    });

    // Bundle: Set [1, 10], Draw (Index 0)
    const bundleEncoder = t.device.createRenderBundleEncoder({
      colorFormats: [kRenderTargetFormat],
    });
    bundleEncoder.setPipeline(pipeline);
    bundleEncoder.setBindGroup(0, bindGroup, [0]);
    bundleEncoder.setImmediates(0, new Uint32Array([1, 10]));
    dispatchOrDraw('render bundle', bundleEncoder, drawOptions);
    const bundle = bundleEncoder.finish();

    const renderTargetTexture = t.createTextureTracked({
      size: [renderTargetWidth, 1, 1],
      format: kRenderTargetFormat,
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
    pass.setImmediates(0, new Uint32Array([2, 20]));
    dispatchOrDraw('render pass', pass, drawOptions);

    pass.end();

    // Read back 2 pixels.
    const bytesPerRow = align(renderTargetWidth * kBytesPerPixel, kMinBytesPerRow);
    const readbackBuffer = t.createBufferTracked({
      size: bytesPerRow,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    commandEncoder.copyTextureToBuffer(
      { texture: renderTargetTexture },
      { buffer: readbackBuffer, bytesPerRow },
      [renderTargetWidth, 1]
    );

    t.device.queue.submit([commandEncoder.finish()]);

    // Each pixel is vec4u; we only use the first 2 components.
    t.expectGPUBufferValuesEqual(
      readbackBuffer,
      new Uint32Array([
        1,
        10,
        0,
        0, // pixel 0 (bundle draw)
        2,
        20,
        0,
        0, // pixel 1 (pass draw)
      ])
    );
  });

g.test('render_bundle_isolation')
  .desc(
    `
    Verify immediate values in vertex/fragment shaders are isolated between bundles in the same pass,
    using direct/indirect and indexed/non-indexed draws with distinct immediate payloads.
  `
  )
  .params(kBundleExecutionParams)
  .fn(t => {
    const { drawType, stage } = t.params;
    const drawOptions = createIndirectDrawOptions(t, 'render bundle', drawType.includes('indexed'));
    if (!drawType.includes('indirect')) {
      drawOptions.indirectBuffer = undefined;
    }
    const wgslDecl = 'var<immediate> data: vec2<u32>;';
    const fragmentReturnExpr = 'vec4u(data.x, data.y, 0, 0)';
    const renderTargetWidth = 2;

    const pipeline = createPipeline(
      t,
      'render pass',
      wgslDecl,
      '', // copyCode unused for render-only test
      fragmentReturnExpr,
      8,
      renderTargetWidth,
      undefined,
      stage
    ) as GPURenderPipeline;

    const indexUniformBuffer = createOutputIndexBuffer(t, 2);

    const bindGroup = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: indexUniformBuffer, size: 4 } }],
    });

    // Bundle A: Set [1, 2], Draw (Index 0)
    const bundleEncoderA = t.device.createRenderBundleEncoder({
      colorFormats: [kRenderTargetFormat],
    });
    bundleEncoderA.setPipeline(pipeline);
    bundleEncoderA.setBindGroup(0, bindGroup, [0]);
    bundleEncoderA.setImmediates(0, new Uint32Array([1, 2]));
    dispatchOrDraw('render bundle', bundleEncoderA, drawOptions);
    const bundleA = bundleEncoderA.finish();

    // Bundle B: Set [3, 4], Draw (Index 1)
    const bundleEncoderB = t.device.createRenderBundleEncoder({
      colorFormats: [kRenderTargetFormat],
    });
    bundleEncoderB.setPipeline(pipeline);
    bundleEncoderB.setBindGroup(0, bindGroup, [256]);
    bundleEncoderB.setImmediates(0, new Uint32Array([3, 4]));
    dispatchOrDraw('render bundle', bundleEncoderB, drawOptions);
    const bundleB = bundleEncoderB.finish();

    const renderTargetTexture = t.createTextureTracked({
      size: [renderTargetWidth, 1, 1],
      format: kRenderTargetFormat,
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

    // Read back 2 pixels.
    const bytesPerRow = align(renderTargetWidth * kBytesPerPixel, kMinBytesPerRow);
    const readbackBuffer = t.createBufferTracked({
      size: bytesPerRow,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    commandEncoder.copyTextureToBuffer(
      { texture: renderTargetTexture },
      { buffer: readbackBuffer, bytesPerRow },
      [renderTargetWidth, 1]
    );

    t.device.queue.submit([commandEncoder.finish()]);

    // Each pixel is vec4u; we only use the first 2 components.
    t.expectGPUBufferValuesEqual(
      readbackBuffer,
      new Uint32Array([
        1,
        2,
        0,
        0, // pixel 0 (bundle A)
        3,
        4,
        0,
        0, // pixel 1 (bundle B)
      ])
    );
  });
