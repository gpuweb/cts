import { GPUTest } from '../../../../../gpu_test.js';
import { anyOf } from '../../../../../util/compare.js';
import { Type, Value } from '../../../../../util/conversion.js';
import { FPInterval } from '../../../../../util/floating_point.js';
import { align } from '../../../../../util/math.js';
import { Case } from '../../case.js';
import { toComparator } from '../../expectation.js';

/**
 * Run a test for a fwidth builtin function.
 * @param t the GPUTest
 * @param cases list of test cases to run
 * @param builtin the builtin function to test
 * @param non_uniform_discard if true, one of each pair of invocations will discard
 * @param vectorize if defined, the vector width to use (2, 3, or 4)
 */
export function runFWidthTestCases(
  t: GPUTest,
  cases: Case[],
  builtin: string,
  non_uniform_discard: boolean,
  vectorize?: number
) {
  ////////////////////////////////////////////////////////////////
  // The four input values for a given case are distributed to across the invocations in a quad.
  // We will populate a uniform buffer with these input values laid out sequentially:
  // [ case0_input0, case0_input1, case0_input2, case0_input3, ...]
  //
  // The render pipeline will be launched several times over a viewport size of (2, 2). Each draw
  // call will execute a single quad (four fragment invocation), which will exercise one test case.
  // Each of these draw calls will use a different instance index, which is forwarded to the
  // fragment shader. The results are the output from the fragment shader.
  //
  // Consider two draw calls that test 2 cases (c0, c1).
  //
  // The mapping from fragment position to case input is:
  // Quad 0: | c0_i0 | c0_i1 |     Quad 1: | c1_i0 | c1_i1 |
  //         | c0_i2 | c0_i3 |             | c1_i2 | c1_i3 |
  //
  ////////////////////////////////////////////////////////////////

  // If the 'vectorize' config option was provided, pack the cases into vectors.
  let vectorWidth = 1;
  if (vectorize !== undefined) {
    vectorWidth = vectorize;
  }

  // Determine the WGSL type to use in the shader, and the stride in bytes between values.
  const valueStride = 16;
  let conversionFromInput = 'input.x';
  let conversionToOutput = `vec4f(v, 0, 0, 0)`;
  if (vectorize) {
    switch (vectorize) {
      case 2:
        conversionFromInput = 'input.xy';
        conversionToOutput = 'vec4f(v, 0, 0)';
        break;
      case 3:
        conversionFromInput = 'input.xyz';
        conversionToOutput = 'vec4f(v, 0)';
        break;
      case 4:
        conversionFromInput = 'input';
        conversionToOutput = 'v';
        break;
    }
  }

  // Define a vertex shader that draws a triangle over the full viewport, and a fragment shader that
  // calls the fwidth builtin with a value loaded from that fragment's index into the storage
  // buffer (determined using the quad index and fragment position, as described above).
  const code = `
struct CaseInfo {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat, either) quad_idx: u32,
}

@vertex
fn vert(@builtin(vertex_index) vertex_idx: u32,
        @builtin(instance_index) instance_idx: u32) -> CaseInfo {
  const kVertices = array(
    vec2f(-2, -2),
    vec2f( 2, -2),
    vec2f( 0,  2),
  );
  return CaseInfo(vec4(kVertices[vertex_idx], 0, 1), instance_idx);
}

@group(0) @binding(0) var<uniform> inputs : array<vec4f, ${cases.length}>;

@fragment
fn frag(info : CaseInfo) -> @location(0) vec4u {
  let inv_idx = u32(info.position.x) + u32(info.position.y)*2;
  let index = info.quad_idx*4 + inv_idx;
  let input = inputs[index];
  ${non_uniform_discard ? 'if inv_idx == 0 { discard; }' : ''}
  let v = ${builtin}(${conversionFromInput});
  return bitcast<vec4u>(${conversionToOutput});
}
`;

  // Create the render pipeline.
  const module = t.device.createShaderModule({ code });
  const pipeline = t.device.createRenderPipeline({
    layout: 'auto',
    vertex: { module },
    fragment: { module, targets: [{ format: 'rgba32uint' }] },
  });

  // Create storage buffers to hold the inputs and outputs.
  const bufferSize = cases.length * 4 * valueStride;
  const inputBuffer = t.createBufferTracked({
    size: bufferSize,
    usage: GPUBufferUsage.UNIFORM,
    mappedAtCreation: true,
  });

  // Populate the input uniform buffer with case input values.
  const valuesData = new Uint8Array(inputBuffer.getMappedRange());
  for (let i = 0; i < cases.length / vectorWidth; i++) {
    for (let v = 0; v < vectorWidth; v++) {
      const index = i * vectorWidth + v;
      if (index >= cases.length) {
        break;
      }
      const inputs = cases[index].input as ReadonlyArray<Value>;
      for (let x = 0; x < 4; x++) {
        inputs[x].copyTo(valuesData, (i * 4 + x) * valueStride + v * 4);
      }
    }
  }
  inputBuffer.unmap();

  // Create a bind group for the storage buffers.
  const group = t.device.createBindGroup({
    entries: [{ binding: 0, resource: { buffer: inputBuffer } }],
    layout: pipeline.getBindGroupLayout(0),
  });

  // Create a texture to use as a color attachment.
  // We only need this for launching the desired number of fragment invocations.
  const colorAttachment = t.createTextureTracked({
    size: { width: 2, height: 2 },
    format: 'rgba32uint',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });
  const bytesPerRow = align(valueStride * colorAttachment.width, 256);

  // Submit the render pass to the device.
  const results = [];
  const encoder = t.device.createCommandEncoder();
  for (let quad = 0; quad / vectorWidth; quad++) {
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: colorAttachment.createView(),
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, group);
    pass.draw(3, 1, undefined, quad);
    pass.end();
    const outputBuffer = t.createBufferTracked({
      size: bytesPerRow * colorAttachment.height,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    results.push(outputBuffer);
    encoder.copyTextureToBuffer(
      { texture: colorAttachment },
      { buffer: outputBuffer, bytesPerRow },
      [colorAttachment.width, colorAttachment.height]
    );
  }
  t.queue.submit([encoder.finish()]);

  // Check the outputs match the expected results.
  results.forEach((outputBuffer, quadNdx) => {
    t.expectGPUBufferValuesPassCheck(
      outputBuffer,
      (outputData: Uint8Array) => {
        for (let i = 0; i < 4; ++i) {
          const tx = i % 2;
          const ty = (i / 2) | 0;
          const x = tx + ty * 2;
          for (let v = 0; v < vectorWidth; v++) {
            if (non_uniform_discard && x === 0) {
              continue;
            }

            const caseNdx = quadNdx * 4 + x;
            if (caseNdx >= cases.length) {
              break;
            }

            const c = cases[quadNdx * 4 + x];
            const index = ty * bytesPerRow + tx * valueStride + v * 4;
            const result = Type.f32.read(outputData, index);

            let expected = c.expected;
            if (builtin.endsWith('Fine')) {
              expected = toComparator((expected as FPInterval[])[v]);
            } else {
              expected = anyOf(...(expected as FPInterval[]));
            }

            const cmp = expected.compare(result);
            if (!cmp.matched) {
              return new Error(`
      inputs: (${(c.input as Value[]).join(', ')})
    expected: ${cmp.expected}

    returned: ${result}`);
            }
          }
        }
        return undefined;
      },
      {
        type: Uint8Array,
        typedLength: outputBuffer.size,
      }
    );
  });
}

/**
 * Run a test for a fwidth builtin function.
 * @param t the GPUTest
 * @param cases list of test cases to run
 * @param builtin the builtin function to test
 * @param non_uniform_discard if true, one of each pair of invocations will discard
 * @param vectorize if defined, the vector width to use (2, 3, or 4)
 */
export function runFWidthTest(
  t: GPUTest,
  cases: Case[],
  builtin: string,
  non_uniform_discard: boolean,
  vectorize?: number
) {
  const numCasesPerUniformBuffer = t.device.limits.maxUniformBufferBindingSize / 64;
  for (let i = 0; i < cases.length; i += numCasesPerUniformBuffer) {
    runFWidthTestCases(
      t,
      cases.slice(i, i + numCasesPerUniformBuffer),
      builtin,
      non_uniform_discard,
      vectorize
    );
  }
}
