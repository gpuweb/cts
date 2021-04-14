export const description = `

TODO: check overlap with api,operation,rendering,draw:vertex_attributes,basic before implementing

- Tests that render N points, using a generated pipeline with:
  (1) a vertex shader that has necessary vertex inputs and a static array of
  expected data (as indexed by vertexID + instanceID * verticesPerInstance),
  which checks they're equal and sends the bool to the fragment shader;
  (2) a fragment shader which writes the result out to a storage buffer
  (or renders a red/green fragment if we can't do fragmentStoresAndAtomics,
  maybe with some depth or stencil test magic to do the '&&' of all fragments).
    - Fill some GPUBuffers with testable data, e.g.
      [[1.0, 2.0, ...], [-1.0, -2.0, ...]], for use as vertex buffers.
    - With no/trivial indexing
        - Either non-indexed, or indexed with a passthrough index buffer ([0, 1, 2, ...])
            - Of either format
            - If non-indexed, index format has no effect
        - Vertex data is read from the buffer correctly
            - Several vertex buffers with several attributes each
                - Two setVertexBuffers pointing at the same GPUBuffer (if possible)
                    - Overlapping, non-overlapping
                - Overlapping attributes (iff that's supposed to work)
                - Overlapping vertex buffer elements
                  (an attribute offset + its size > arrayStride)
                  (iff that's supposed to work)
                - Discontiguous vertex buffer slots, e.g.
                  [1, some large number (API doesn't practically allow huge numbers here)]
                - Discontiguous shader locations, e.g.
                  [2, some large number (max if possible)]
             - Bind everything possible up to limits
                 - Also with maxed out attributes?
             - x= all vertex formats
        - Maybe a test of one buffer with two attributes, with every possible
          pair of vertex formats
    - With indexing. For each index format:
        - Indices are read from the buffer correctly
            - setIndexBuffer offset
        - For each vertex format:
            - Basic test with several vertex buffers and several attributes

TODO: Test more corner case values for Float16 / Float32 (INF, NaN, +-0, ...) and reduce the
float tolerance.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { assert } from '../../../../common/util/util.js';
import {
  kMaxVertexAttributes,
  kMaxVertexBufferArrayStride,
  kMaxVertexBuffers,
  kVertexFormatInfo,
  kVertexFormats,
  VertexFormat,
} from '../../../capability_info.js';
import { GPUTest } from '../../../gpu_test.js';
import { float32ToFloat16Bits } from '../../../util/conversion.js';
import { align, clamp } from '../../../util/math.js';

// These types mirror the structure of GPUVertexBufferLayout but allow defining the extra
// dictionary members at the GPUVertexBufferLayout and GPUVertexAttribute level. The are used
// like so:
//
//   VertexState<{arrayStride: number}, {format: VertexFormat}>
//   VertexBuffer<{arrayStride: number}, {format: VertexFormat}>
//   VertexAttrib<{format: VertexFormat}>
type VertexAttrib<A> = A & { shaderLocation: number };
type VertexBuffer<V, A> = V & {
  slot: number;
  attributes: VertexAttrib<A>[];
};
type VertexState<V, A> = VertexBuffer<V, A>[];

function mapBufferAttribs<V, A1, A2>(
  buffer: VertexBuffer<V, A1>,
  f: (v: V, a: VertexAttrib<A1>) => A2
): VertexBuffer<V, A2> {
  const { attributes, ...bufferRest } = buffer;

  const newAttributes: VertexAttrib<A2>[] = [];
  attributes.forEach(a =>
    newAttributes.push({
      shaderLocation: a.shaderLocation,
      ...f(buffer, a),
    })
  );

  return { attributes: newAttributes, ...(bufferRest as V & { slot: number }) };
}

function mapStateAttribs<V, A1, A2>(
  buffers: VertexState<V, A1>,
  f: (v: V, a: VertexAttrib<A1>) => A2
): VertexState<V, A2> {
  return buffers.map(b => mapBufferAttribs(b, f));
}

type TestData = {
  shaderBaseType: string;
  floatTolerance?: number;
  // The number of vertex components in the vertexData (expectedData might contain more because
  // it is padded to 4 components).
  testComponentCount: number;
  // The data that will be in the uniform buffer and used to check the vertex inputs.
  expectedData: ArrayBuffer;
  // The data that will be in the vertex buffer.
  vertexData: ArrayBuffer;
};

class VertexStateTest extends GPUTest {
  // Generate for VS + FS (entrypoints vsMain / fsMain) that for each attribute will check that its
  // value corresponds to what's expected (as provided by a uniform buffer per attribute) and then
  // renders each vertex at position (vertexIndex, instanceindex) with either 1 (success) or
  // a negative number corresponding to the check number (in case you need to debug a failure).
  makeTestWGSL(
    buffers: VertexState<
      { stepMode: GPUInputStepMode },
      {
        format: VertexFormat;
        shaderBaseType: string;
        shaderComponentCount?: number;
        floatTolerance?: number;
      }
    >,
    maxVertexIndex: number,
    maxInstanceIndex: number
  ): string {
    let vsInputs = '';
    let vsChecks = '';
    let vsBindings = '';

    buffers.forEach(b => {
      b.attributes.forEach(a => {
        const format = kVertexFormatInfo[a.format];
        const shaderComponentCount = a.shaderComponentCount ?? format.componentCount;
        const i = a.shaderLocation;

        // shaderType is either a scalar type like f32 or a vecN<scalarType>
        let shaderType = a.shaderBaseType;
        if (shaderComponentCount !== 1) {
          shaderType = `vec${shaderComponentCount}<${shaderType}>`;
        }

        let maxIndex = `${maxVertexIndex}`;
        let indexBuiltin = `input.vertexIndex`;
        if (b.stepMode === 'instance') {
          maxIndex = `${maxInstanceIndex}`;
          indexBuiltin = `input.instanceIndex`;
        }

        vsInputs += `  [[location(${i})]] attrib${i} : ${shaderType};\n`;
        vsBindings += `[[block]] struct S${i} { data : array<vec4<${a.shaderBaseType}>, ${maxIndex}>; };\n`;
        vsBindings += `[[group(0), binding(${i})]] var<uniform> providedData${i} : S${i};\n`;

        // Generate the all the checks for the attributes.
        for (let component = 0; component < shaderComponentCount; component++) {
          // Components are filled with (0, 0, 0, 1) if they aren't provided data from the pipeline.
          if (component >= format.componentCount) {
            const expected = component === 3 ? '1' : '0';
            vsChecks += `  check(input.attrib${i}[${component}] == ${a.shaderBaseType}(${expected}));\n`;
            continue;
          }

          // Check each component individually, with special handling of tolerance for floats.
          const attribComponent =
            shaderComponentCount === 1 ? `input.attrib${i}` : `input.attrib${i}[${component}]`;
          const providedData = `providedData${i}.data[${indexBuiltin}][${component}]`;
          if (format.type === 'uint' || format.type === 'sint') {
            vsChecks += `  check(${attribComponent} == ${providedData});\n`;
          } else {
            vsChecks += `  check(floatsSimilar(${attribComponent}, ${providedData}, f32(${
              a.floatTolerance ?? 0
            })));\n`;
          }
        }
      });
    });

    return `
struct Inputs {
${vsInputs}
  [[builtin(vertex_index)]] vertexIndex: u32;
  [[builtin(instance_index)]] instanceIndex: u32;
};

${vsBindings}

var<private> vsResult : i32 = 1;
var<private> checkIndex : i32 = 0;
fn check(success : bool) {
  if (!success) {
    vsResult = -checkIndex;
  }
  checkIndex = checkIndex + 1;
}

fn floatsSimilar(a : f32, b : f32, tolerance : f32) -> bool {
  if (isNan(a) && isNan(b)) {
    return true;
  }

  if (isInf(a) && isInf(b) && sign(a) == sign(b)) {
    return true;
  }

  if (isInf(a) || isInf(b)) {
    return false;
  }

  // TODO do we check for + and - 0?
  return abs(a - b) < tolerance;
}

fn doTest(input : Inputs) {
${vsChecks}
}

struct VSOutputs {
  [[location(0)]] result : i32;
  [[builtin(position)]] position : vec4<f32>;
};

[[stage(vertex)]] fn vsMain(input : Inputs) -> VSOutputs {
  doTest(input);

  // Place that point at pixel (vertexIndex, instanceIndex) in a framebuffer of size
  // (maxVertexIndex, maxInstanceIndex).
  var output : VSOutputs;
  output.position = vec4<f32>(
    ((f32(input.vertexIndex) + 0.5) / ${maxVertexIndex}.0 * 2.0) - 1.0,
    ((f32(input.instanceIndex) + 0.5) / ${maxInstanceIndex}.0 * 2.0) - 1.0,
    0.0, 1.0
  );
  output.result = vsResult;
  return output;
}

[[stage(fragment)]] fn fsMain([[location(0)]] result : i32) -> [[location(0)]] i32 {
  return result;
}
    `;
  }

  makeTestPipeline(
    buffers: VertexState<
      { stepMode: GPUInputStepMode; arrayStride: number },
      {
        offset: number;
        format: VertexFormat;
        shaderBaseType: string;
        shaderComponentCount?: number;
        floatTolerance?: number;
      }
    >,
    maxVertexIndex: number,
    maxInstanceIndex: number
  ): GPURenderPipeline {
    const module = this.device.createShaderModule({
      code: this.makeTestWGSL(buffers, maxVertexIndex, maxInstanceIndex),
    });

    const bufferLayouts: GPUVertexBufferLayout[] = [];
    buffers.forEach(b => (bufferLayouts[b.slot] = b));

    return this.device.createRenderPipeline({
      vertex: {
        module,
        entryPoint: 'vsMain',
        buffers: bufferLayouts,
      },
      primitive: {
        topology: 'point-list',
      },
      fragment: {
        module,
        entryPoint: 'fsMain',
        targets: [
          {
            format: 'r32sint',
          },
        ],
      },
    });
  }

  // Runs the render pass drawing points in a maxVertex*maxInstance rectangle, then check each of
  // produced a value of 1 which means that the tests in the shader passed.
  submitRenderPass(
    pipeline: GPURenderPipeline,
    buffers: VertexState<{ buffer: GPUBuffer; vbOffset?: number }, {}>,
    expectedData: GPUBindGroup,
    maxVertexIndex: number,
    maxInstanceIndex: number
  ) {
    const testTexture = this.device.createTexture({
      format: 'r32sint',
      size: [maxVertexIndex, maxInstanceIndex],
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: testTexture.createView(),
          loadValue: [0, 0, 0, 0],
          storeOp: 'store',
        },
      ],
    });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, expectedData);
    buffers.forEach(buffer => {
      pass.setVertexBuffer(buffer.slot, buffer.buffer, buffer.vbOffset ?? 0);
    });
    pass.draw(maxVertexIndex, maxInstanceIndex);
    pass.endPass();

    this.device.queue.submit([encoder.finish()]);

    this.expectSingleColor(testTexture, 'r32sint', {
      size: [maxVertexIndex, maxInstanceIndex, 1],
      exp: { R: 1 },
    });
  }

  // Generate TestData for the format with interesting test values.
  // TODO cache the result on the fixture?
  generateTestData(format: GPUVertexFormat): TestData {
    const formatInfo = kVertexFormatInfo[format];
    switch (formatInfo.type) {
      case 'float': {
        const data = [0.0, 1.0, -1.0, 1000, 42.42, -18.7, 25.17];
        const expectedData = new Float32Array(data).buffer;

        let vertexData = expectedData;
        if (formatInfo.bytesPerComponent === 2) {
          vertexData = new Uint16Array(data.map(float32ToFloat16Bits)).buffer;
        }

        return {
          shaderBaseType: 'f32',
          testComponentCount: data.length,
          expectedData,
          vertexData,
          floatTolerance: 0.05,
        };
      }

      case 'sint': {
        /* prettier-ignore */
        const data = [
          0, 1, 2, 3, 4, 5,
          -1, -2, -3, -4, -5,
          Math.pow(2, formatInfo.bytesPerComponent * 8 - 2),
          Math.pow(2, formatInfo.bytesPerComponent * 8 - 1) - 1, // max value
          -Math.pow(2, formatInfo.bytesPerComponent * 8 - 2),
          -Math.pow(2, formatInfo.bytesPerComponent * 8 - 1), // min value
        ];
        const expectedData = new Int32Array(data).buffer;
        let vertexData = expectedData;
        if (formatInfo.bytesPerComponent === 2) {
          vertexData = new Int16Array(data).buffer;
        } else if (formatInfo.bytesPerComponent === 1) {
          vertexData = new Int8Array(data).buffer;
        }
        return {
          shaderBaseType: 'i32',
          testComponentCount: data.length,
          expectedData,
          vertexData,
        };
      }

      case 'uint': {
        /* prettier-ignore */
        const data = [
          0, 1, 2, 3, 4, 5,
          Math.pow(2, formatInfo.bytesPerComponent * 8 - 1),
          Math.pow(2, formatInfo.bytesPerComponent * 8) - 1, // max value
        ];
        const expectedData = new Uint32Array(data).buffer;
        let vertexData = expectedData;
        if (formatInfo.bytesPerComponent === 2) {
          vertexData = new Uint16Array(data).buffer;
        } else if (formatInfo.bytesPerComponent === 1) {
          vertexData = new Uint8Array(data).buffer;
        }
        return {
          shaderBaseType: 'u32',
          testComponentCount: data.length,
          expectedData,
          vertexData,
        };
      }

      case 'snorm': {
        /* prettier-ignore */
        const data = [
          0, 1, 2, 3, 4, 5,
          -1, -2, -3, -4, -5,
          Math.pow(2, formatInfo.bytesPerComponent * 8 - 2),
          Math.pow(2, formatInfo.bytesPerComponent * 8 - 1) - 1, // max value
          -Math.pow(2, formatInfo.bytesPerComponent * 8 - 2),
          -Math.pow(2, formatInfo.bytesPerComponent * 8 - 1), // min value
        ];

        assert(formatInfo.bytesPerComponent <= 16);
        let vertexData: ArrayBuffer | undefined = undefined;
        if (formatInfo.bytesPerComponent === 2) {
          vertexData = new Int16Array(data).buffer;
        } else if (formatInfo.bytesPerComponent === 1) {
          vertexData = new Int8Array(data).buffer;
        }

        const divider = Math.pow(2, formatInfo.bytesPerComponent * 8 - 1) - 1;
        const expectedData = new Float32Array(data.map(v => Math.max(-1, v / divider))).buffer;

        return {
          shaderBaseType: 'f32',
          testComponentCount: data.length,
          expectedData,
          vertexData: vertexData!,
          floatTolerance: 0.1 / divider,
        };
      }

      case 'unorm': {
        /* prettier-ignore */
        const data = [
          0, 1, 2, 3, 4, 5,
          Math.pow(2, formatInfo.bytesPerComponent * 8 - 1),
          Math.pow(2, formatInfo.bytesPerComponent * 8) - 1, // max value
        ];

        assert(formatInfo.bytesPerComponent <= 16);
        let vertexData: ArrayBuffer | undefined = undefined;
        if (formatInfo.bytesPerComponent === 2) {
          vertexData = new Uint16Array(data).buffer;
        } else if (formatInfo.bytesPerComponent === 1) {
          vertexData = new Uint8Array(data).buffer;
        }

        const divider = Math.pow(2, formatInfo.bytesPerComponent * 8) - 1;
        const expectedData = new Float32Array(data.map(v => v / divider)).buffer;

        return {
          shaderBaseType: 'f32',
          testComponentCount: data.length,
          expectedData,
          vertexData: vertexData!,
          floatTolerance: 0.1 / divider,
        };
      }
    }
  }

  // The TestData generate for a format might not contain enough data for all the vertices we are
  // going to draw, so we expand them by adding additional copies of the vertexData as needed.
  // expectedData is a bit different because it also needs to be unpacked to have `componentCount`
  // components every 4 components (because the shader uses vec4 for the expected data).
  expandTestData(data: TestData, maxIndex: number, componentCount: number): TestData {
    const vertexComponentSize = data.vertexData.byteLength / data.testComponentCount;
    const expectedComponentSize = data.expectedData.byteLength / data.testComponentCount;

    const expandedVertexData = new Uint8Array(maxIndex * componentCount * vertexComponentSize);
    const expandedExpectedData = new Uint8Array(4 * maxIndex * expectedComponentSize);

    for (let index = 0; index < maxIndex; index++) {
      for (let component = 0; component < componentCount; component++) {
        // If only we had some builtin JS memcpy function between ArrayBuffers...
        const targetVertexOffset = (index * componentCount + component) * vertexComponentSize;
        const sourceVertexOffset = targetVertexOffset % data.vertexData.byteLength;
        expandedVertexData.set(
          new Uint8Array(data.vertexData, sourceVertexOffset, vertexComponentSize),
          targetVertexOffset
        );

        const targetExpectedOffset = (index * 4 + component) * expectedComponentSize;
        const sourceExpectedOffset =
          ((index * componentCount + component) * expectedComponentSize) %
          data.expectedData.byteLength;
        expandedExpectedData.set(
          new Uint8Array(data.expectedData, sourceExpectedOffset, expectedComponentSize),
          targetExpectedOffset
        );
      }
    }

    return {
      shaderBaseType: data.shaderBaseType,
      testComponentCount: maxIndex * componentCount,
      floatTolerance: data.floatTolerance,
      expectedData: expandedExpectedData.buffer,
      vertexData: expandedVertexData.buffer,
    };
  }

  // Copies `size` bytes from `source` to `target` starting at `offset` each `targetStride`.
  // (the data in `source` is assumed packed)
  mergeVertexData(
    target: ArrayBuffer,
    source: ArrayBuffer,
    d: { targetStride: number; offset: number; size: number }
  ) {
    const t = new Uint8Array(target);
    const { targetStride, offset, size } = d;
    for (
      let sourceOffset = 0, targetOffset = offset;
      sourceOffset < source.byteLength;
      sourceOffset += size, targetOffset += targetStride
    ) {
      const a = new Uint8Array(source, sourceOffset, size);
      t.set(a, targetOffset);
    }
  }

  runTest(
    buffers: VertexState<
      {
        stepMode: GPUInputStepMode;
        arrayStride: number;
        vbOffset?: number;
      },
      {
        offset: number;
        format: VertexFormat;
        shaderComponentCount?: number;
      }
    >,
    // Default to using 20 vertices and 20 instances so that we cover each of the test data at least
    // once (at the time of writing the largest testData has 16 values).
    maxVertexIndex: number = 20,
    maxInstanceIndex: number = 20
  ) {
    // Gather the test data and some additional test state for attribs.
    const pipelineAndTestState = mapStateAttribs(buffers, (buffer, attrib) => {
      const maxIndex = buffer.stepMode === 'instance' ? maxInstanceIndex : maxVertexIndex;
      const formatInfo = kVertexFormatInfo[attrib.format];

      let testData = this.generateTestData(attrib.format);
      // TODO this will not work for arrayStride 0
      testData = this.expandTestData(testData, maxIndex, formatInfo.componentCount);

      return {
        ...testData,
        ...attrib,
      };
    });

    // Create the pipeline from the test data.
    const pipeline = this.makeTestPipeline(pipelineAndTestState, maxVertexIndex, maxInstanceIndex);

    // Create the bindgroups from that test data
    const bgEntries: GPUBindGroupEntry[] = [];

    pipelineAndTestState.forEach(buffer => {
      buffer.attributes.forEach(attrib => {
        const expectedDataBuffer = this.makeBufferWithContents(
          new Uint8Array(attrib.expectedData),
          GPUBufferUsage.UNIFORM
        );
        bgEntries.push({
          binding: attrib.shaderLocation,
          resource: { buffer: expectedDataBuffer },
        });
      });
    });

    const expectedDataBG = this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: bgEntries,
    });

    // Create the vertex buffers
    const vertexBuffers: VertexState<{ buffer: GPUBuffer; vbOffset?: number }, {}> = [];

    pipelineAndTestState.forEach(buffer => {
      const maxIndex = buffer.stepMode === 'instance' ? maxInstanceIndex : maxVertexIndex;

      // Fill the vertex data with garbage so that we don't get `0` (which could be a test value)
      // if the vertex shader loads the vertex data incorrectly.
      const vertexData = new ArrayBuffer(buffer.arrayStride * maxIndex + (buffer.vbOffset ?? 0));
      new Uint8Array(vertexData).fill(0xc4);

      buffer.attributes.forEach(attrib => {
        const formatInfo = kVertexFormatInfo[attrib.format];
        this.mergeVertexData(vertexData, attrib.vertexData, {
          targetStride: buffer.arrayStride,
          offset: (buffer.vbOffset ?? 0) + attrib.offset,
          size: formatInfo.componentCount * formatInfo.bytesPerComponent,
        });
      });

      vertexBuffers.push({
        slot: buffer.slot,
        buffer: this.makeBufferWithContents(new Uint8Array(vertexData), GPUBufferUsage.VERTEX),
        vbOffset: buffer.vbOffset,
        attributes: [],
      });
    });

    // Run the test shader.
    this.submitRenderPass(
      pipeline,
      vertexBuffers,
      expectedDataBG,
      maxVertexIndex,
      maxInstanceIndex
    );
  }
}

export const g = makeTestGroup(VertexStateTest);

g.test('vertexFormat_to_shaderFormat_conversion')
  .desc(
    `Test that the raw data passed in vertex buffers is correctly converted to the input type in the shader. Test for:
  - all formats
  - 1 to 4 components in the shader's input type (unused components are filled with 0 and except the 4th with 1)
  - various locations
  - various slots`
  )
  .params(u =>
    u //
      .combine('format', kVertexFormats)
      .combine('shaderComponentCount', [1, 2, 3, 4])
      .combine('slot', [0, 1, kMaxVertexBuffers - 1])
      .combine('shaderLocation', [0, 1, kMaxVertexAttributes - 1])
  )
  .fn(t => {
    const { format, shaderComponentCount, slot, shaderLocation } = t.params;
    t.runTest([
      {
        slot,
        arrayStride: 16,
        stepMode: 'vertex',
        attributes: [
          {
            shaderLocation,
            format,
            offset: 0,
            shaderComponentCount,
          },
        ],
      },
    ]);
  });

g.test('setVertexBufferOffset_and_attributeOffset')
  .desc(
    `Test that the vertex buffer offset and attribute offset in the vertex state are applied correctly. Test for:
  - all formats
  - various setVertexBuffer offsets
  - various attribute offsets in a fixed arrayStride`
  )
  .params(u =>
    u //
      .combine('format', kVertexFormats)
      .combine('vbOffset', [0, 4, 400, 1004])
      .combine('arrayStride', [128])
      .expand('offset', p => {
        const formatInfo = kVertexFormatInfo[p.format];
        const componentSize = formatInfo.bytesPerComponent;
        const formatSize = componentSize * formatInfo.componentCount;
        return [
          0,
          componentSize,
          p.arrayStride / 2,
          p.arrayStride - formatSize - componentSize,
          p.arrayStride - formatSize,
        ];
      })
  )
  .fn(t => {
    const { format, vbOffset, arrayStride, offset } = t.params;
    t.runTest([
      {
        slot: 0,
        arrayStride,
        stepMode: 'vertex',
        vbOffset,
        attributes: [
          {
            shaderLocation: 0,
            format,
            offset,
          },
        ],
      },
    ]);
  });

g.test('nonZeroArrayStride_and_attributeOffset')
  .desc(
    `Test that the array stride and attribute offset in the vertex state are applied correctly. Test for:
  - all formats
  - various array strides
  - various attribute offsets in a fixed arrayStride`
  )
  .params(u =>
    u //
      .combine('format', kVertexFormats)
      .expand('arrayStride', p => {
        const formatInfo = kVertexFormatInfo[p.format];
        const componentSize = formatInfo.bytesPerComponent;
        const formatSize = componentSize * formatInfo.componentCount;

        return [align(formatSize, 4), align(formatSize, 4) + 4, kMaxVertexBufferArrayStride];
      })
      .expand('offset', p => {
        const formatInfo = kVertexFormatInfo[p.format];
        const componentSize = formatInfo.bytesPerComponent;
        const formatSize = componentSize * formatInfo.componentCount;
        return new Set(
          [
            0,
            componentSize,
            p.arrayStride / 2,
            p.arrayStride - formatSize - componentSize,
            p.arrayStride - formatSize,
          ].map(offset => clamp(offset, 0, p.arrayStride - formatSize))
        );
      })
  )
  .fn(t => {
    const { format, arrayStride, offset } = t.params;
    t.runTest([
      {
        slot: 0,
        arrayStride,
        stepMode: 'vertex',
        attributes: [
          {
            shaderLocation: 0,
            format,
            offset,
          },
        ],
      },
    ]);
  });

g.test('buffersWithVaryingStepMode')
  .desc(
    `Test buffers with varying step modes in the same vertex state.
  - Various combination of step modes`
  )
  .params(u =>
    u //
      .combine('stepModes', [
        ['instance'],
        ['vertex', 'vertex', 'instance'],
        ['instance', 'vertex', 'instance'],
        ['vertex', 'instance', 'vertex', 'vertex'],
      ] as const)
  )
  .fn(t => {
    const { stepModes } = t.params;
    const state = stepModes.map((stepMode, i) => {
      return {
        slot: i,
        arrayStride: 4,
        stepMode,
        attributes: [
          {
            shaderLocation: i,
            format: 'float32' as const,
            offset: 0,
          },
        ],
      };
    });
    t.runTest(state);
  });
