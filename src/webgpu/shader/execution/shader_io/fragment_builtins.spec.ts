export const description = `Test fragment shader builtin variables and inter-stage variables

* test builtin(position)
* test interpolation

The current tests draw a single triangle with clip space coordinates [1, 1], [-3, 1], [1, -3].
This means they render to all pixels in the textures. To fully test centroid interpolation
probably requires drawing various triangles that only cover certain samples. That is TBD.

TODO:
* test sample interpolation
* test centroid interpolation
* test front_facing
* test sample_index
* test frag_depth
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { TypedArrayBufferView, range, unreachable } from '../../../../common/util/util.js';
import { InterpolationSampling, InterpolationType } from '../../../constants.js';
import { GPUTest } from '../../../gpu_test.js';
import { checkElementsPassPredicate } from '../../../util/check_contents.js';

export const g = makeTestGroup(GPUTest);

const s_deviceToPipelineMap = new WeakMap<
  GPUDevice,
  {
    texture_2d?: GPUComputePipeline;
    texture_multisampled_2d?: GPUComputePipeline;
  }
>();

/**
 * Returns an object of pipelines associated
 * by weakmap to a device so we can cache pipelines.
 */
function getPipelinesForDevice(device: GPUDevice) {
  let pipelines = s_deviceToPipelineMap.get(device);
  if (!pipelines) {
    pipelines = {};
    s_deviceToPipelineMap.set(device, pipelines);
  }
  return pipelines;
}

/**
 * Gets a compute pipeline that will copy the given texture if passed
 * a dispatch size of texture.width, texture.height
 * @param device a device
 * @param texture texture the pipeline is needed for.
 * @returns A GPUComputePipeline
 */
function getCopyMultisamplePipelineForDevice(device: GPUDevice, texture: GPUTexture) {
  const pipelineType = texture.sampleCount > 1 ? 'texture_multisampled_2d' : 'texture_2d';
  const pipelines = getPipelinesForDevice(device);
  let pipeline = pipelines[pipelineType];
  if (!pipeline) {
    const isMultisampled = pipelineType === 'texture_multisampled_2d';
    const numSamples = isMultisampled ? 'textureNumSamples(texture)' : '1u';
    const sampleIndex = isMultisampled ? 'sampleIndex' : '0';
    const module = device.createShaderModule({
      code: `
        @group(0) @binding(0) var texture: ${pipelineType}<f32>;
        @group(0) @binding(1) var<storage, read_write> buffer: array<f32>;

        @compute @workgroup_size(1) fn cs(@builtin(global_invocation_id) id: vec3u) {
          let numSamples = ${numSamples};
          let dimensions = textureDimensions(texture);
          let sampleIndex = id.x % numSamples;
          let tx = id.x / numSamples;
          let offset = (id.y * dimensions.x + tx) * numSamples + sampleIndex;
          let v = vec4u(textureLoad(texture, vec2u(tx, id.y), ${sampleIndex}) * 255.0);

          buffer[offset] = bitcast<f32>(dot(v, vec4u(0x1000000, 0x10000, 0x100, 0x1)));
        }
      `,
    });

    pipeline = device.createComputePipeline({
      label: 'copy multisampled texture pipeline',
      layout: 'auto',
      compute: {
        module,
        entryPoint: 'cs',
      },
    });

    pipelines[pipelineType] = pipeline;
  }
  return pipeline;
}

/**
 * Copies a texture (even if multisampled) to a buffer
 * @param t a gpu test
 * @param texture texture to copy
 * @returns buffer with copy of texture, mip level 0, array layer 0.
 */
function copyTextureToBufferIncludingMultisampledTextures(t: GPUTest, texture: GPUTexture) {
  const copyBuffer = t.device.createBuffer({
    size: texture.width * texture.height * texture.sampleCount * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  t.trackForCleanup(copyBuffer);

  const buffer = t.device.createBuffer({
    size: copyBuffer.size,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });
  t.trackForCleanup(buffer);

  const pipeline = getCopyMultisamplePipelineForDevice(t.device, texture);
  const encoder = t.device.createCommandEncoder();

  const bindGroup = t.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: texture.createView() },
      { binding: 1, resource: { buffer: copyBuffer } },
    ],
  });

  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(texture.width * texture.sampleCount, texture.height);
  pass.end();

  encoder.copyBufferToBuffer(copyBuffer, 0, buffer, 0, buffer.size);

  t.device.queue.submit([encoder.finish()]);

  return buffer;
}

/* column constants */
const kZ = 2;
const kW = 3;

/**
 * Gets a column of values from an array of arrays.
 */
function getColumn(values: readonly number[][], colNum: number) {
  return values.map(v => v[colNum]);
}

/**
 * Subtracts 2 vectors
 */
function subtractVectors(v1: readonly number[], v2: readonly number[]) {
  return v1.map((v, i) => v - v2[i]);
}

/**
 * Computes the dot product of 2 vectors
 */
function dotProduct(v1: readonly number[], v2: readonly number[]) {
  return v1.reduce((a, v, i) => a + v * v2[i], 0);
}

/**
 * Computes the linear interpolation of 3 values from 3 vertices of a triangle
 * based on barycentric coordinates
 */
function linearInterpolation(baryCoords: readonly number[], interCoords: readonly number[]) {
  return dotProduct(baryCoords, interCoords);
}

/**
 * Computes the perspective interpolation of 3 values from 3 vertices of a
 * triangle based on barycentric coordinates and their corresponding clip space
 * W coordinates.
 */
function perspectiveInterpolation(
  barycentricCoords: readonly number[],
  clipSpaceTriangleCoords: readonly number[][],
  interCoords: readonly number[]
) {
  const [a, b, c] = barycentricCoords;
  const [fa, fb, fc] = interCoords;
  const wa = clipSpaceTriangleCoords[0][kW];
  const wb = clipSpaceTriangleCoords[1][kW];
  const wc = clipSpaceTriangleCoords[2][kW];

  return ((a * fa) / wa + (b * fb) / wb + (c * fc) / wc) / (a / wa + b / wb + c / wc);
}

/**
 * Converts clip space coords to NDC coords
 */
function clipSpaceToNDC(point: readonly number[]) {
  return point.map(v => v / point[kW]);
}

/**
 * Converts NDC coords to window coords.
 */
function ndcToWindow(ndcPoint: readonly number[], viewport: readonly number[]) {
  const [xd, yd, zd] = ndcPoint;
  const px = viewport[2];
  const py = viewport[3];
  const ox = viewport[0] + px / 2;
  const oy = viewport[1] + py / 2;
  const zNear = viewport[4];
  const zFar = viewport[5];
  // prettier-ignore
  return [
    px / 2 * xd + ox,
    -py / 2 * yd + oy,
    zd * (zFar - zNear) + zNear,
  ];
}

/**
 * Computes barycentric coordinates of triangle for point p.
 * @param trianglePoints points for triangle
 * @param p point in triangle (or relative to it)
 * @returns barycentric coords of p
 */
function calcBarycentricCoordinates(trianglePoints: number[][], p: number[]) {
  const [a, b, c] = trianglePoints;

  const v0 = subtractVectors(b, a);
  const v1 = subtractVectors(c, a);
  const v2 = subtractVectors(p, a);

  const dot00 = dotProduct(v0, v0);
  const dot01 = dotProduct(v0, v1);
  const dot11 = dotProduct(v1, v1);
  const dot20 = dotProduct(v2, v0);
  const dot21 = dotProduct(v2, v1);

  const denom = 1 / (dot00 * dot11 - dot01 * dot01);
  const v = (dot11 * dot20 - dot01 * dot21) * denom;
  const w = (dot00 * dot21 - dot01 * dot20) * denom;
  const u = 1 - v - w;

  return [u, v, w];
}

type FragData = {
  fragmentPoint: readonly number[];
  fragmentBarycentricCoords: readonly number[];
  sampleBarycentricCoords: readonly number[];
  clipSpacePoints: readonly number[][];
  ndcPoints: readonly number[][];
  windowPoints: readonly number[][];
};

/**
 * For each sample in texture, computes the values that would be provided
 * to the shader as `@builtin(position)` if the texture was a render target
 * and every point in the texture was inside the triangle.
 * @param texture The texture
 * @param clipSpacePoints triangle points in clip space
 * @returns the expected values for each sample
 */
function generateFragmentInputs({
  width,
  height,
  nearFar,
  sampleCount,
  clipSpacePoints,
  interpolateFn,
}: {
  width: number;
  height: number;
  nearFar: readonly number[];
  sampleCount: number;
  clipSpacePoints: readonly number[][];
  interpolateFn: (fragData: FragData) => number[];
}) {
  const expected = new Float32Array(width * height * sampleCount * 4);

  const viewport = [0, 0, width, height, ...nearFar];

  const ndcPoints = clipSpacePoints.map(clipSpaceToNDC);
  const windowPoints = ndcPoints.map(p => ndcToWindow(p, viewport));
  const windowPoints2D = windowPoints.map(p => p.slice(0, 2));

  const multisampleTable = kMultisamplingTables.get(sampleCount)!;
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      for (let s = 0; s < sampleCount; ++s) {
        const fragmentPoint = [x + 0.5, y + 0.5];
        const multisampleOffset = multisampleTable[s];
        const sampleFragmentPoint = [x + multisampleOffset[0], y + multisampleOffset[1]];
        const fragmentBarycentricCoords = calcBarycentricCoordinates(windowPoints2D, fragmentPoint);
        const sampleBarycentricCoords = calcBarycentricCoordinates(
          windowPoints2D,
          sampleFragmentPoint
        );

        const output = interpolateFn({
          fragmentPoint,
          fragmentBarycentricCoords,
          sampleBarycentricCoords,
          clipSpacePoints,
          ndcPoints,
          windowPoints,
        });

        const offset = ((y * width + x) * sampleCount + s) * 4;
        expected.set(output, offset);
      }
    }
  }
  return expected;
}

/**
 * Computes 'builtin(position)`
 */
function computeFragmentPosition({
  fragmentPoint,
  fragmentBarycentricCoords,
  clipSpacePoints,
  windowPoints,
}: FragData) {
  return [
    fragmentPoint[0],
    fragmentPoint[1],
    linearInterpolation(fragmentBarycentricCoords, getColumn(windowPoints, kZ)),
    1 /
      perspectiveInterpolation(
        fragmentBarycentricCoords,
        clipSpacePoints,
        getColumn(clipSpacePoints, kW)
      ),
  ];
}

const kMultisamplingTables = new Map<number, readonly number[][]>([
  [1, [[8 / 16, 8 / 16]]],
  [
    2,
    [
      [4 / 16, 4 / 16],
      [12 / 16, 12 / 16],
    ],
  ],
  [
    4,
    [
      [6 / 16, 2 / 16],
      [14 / 16, 6 / 16],
      [2 / 16, 10 / 16],
      [10 / 16, 14 / 16],
    ],
  ],
  [
    8,
    [
      [9 / 16, 5 / 16],
      [7 / 16, 11 / 16],
      [13 / 16, 9 / 16],
      [5 / 16, 3 / 16],
      [3 / 16, 13 / 16],
      [1 / 16, 7 / 16],
      [11 / 16, 15 / 16],
      [15 / 16, 1 / 16],
    ],
  ],
  [
    16,
    [
      [9 / 16, 9 / 16],
      [7 / 16, 5 / 16],
      [5 / 16, 10 / 16],
      [12 / 16, 7 / 16],

      [3 / 16, 6 / 16],
      [10 / 16, 13 / 16],
      [13 / 16, 11 / 16],
      [11 / 16, 3 / 16],

      [6 / 16, 14 / 16],
      [8 / 16, 1 / 16],
      [4 / 16, 2 / 16],
      [2 / 16, 12 / 16],

      [0 / 16, 8 / 16],
      [15 / 16, 4 / 16],
      [14 / 16, 15 / 16],
      [1 / 16, 0 / 16],
    ],
  ],
]);

/**
 * Creates a function that will compute the interpolation of an inter-stage variable.
 */
function createInterStageInterpolationFn(
  interStagePoints: number[][],
  type: InterpolationType,
  sampling: InterpolationSampling | undefined
) {
  return function ({
    fragmentBarycentricCoords,
    sampleBarycentricCoords,
    clipSpacePoints,
  }: FragData) {
    const barycentricCoords =
      sampling === 'center' ? fragmentBarycentricCoords : sampleBarycentricCoords;
    switch (type) {
      case 'perspective':
        return interStagePoints[0].map((_, colNum: number) =>
          perspectiveInterpolation(
            barycentricCoords,
            clipSpacePoints,
            getColumn(interStagePoints, colNum)
          )
        );
        break;
      case 'linear':
        return interStagePoints[0].map((_, colNum: number) =>
          linearInterpolation(barycentricCoords, getColumn(interStagePoints, colNum))
        );
        break;
      case 'flat':
        return interStagePoints[0];
        break;
      default:
        unreachable();
    }
  };
}

/**
 * Renders float32 fragment shader inputs values to 4 rgba8unorm textures that
 * can be multisampled textures. It stores each of the channels, r, g, b, a of
 * the shader input to a separate texture, doing the math required to store the
 * float32 value into an rgba8unorm texel.
 *
 * Note: We could try to store the output to an vec4f storage buffer.
 * Unfortunately, using a storage buffer has the issue that we need to compute
 * an index with the very thing we're trying to test. Similarly for a storage
 * texture. Also, using a storage buffer seems to affect certain backends like
 * M1 Mac so it seems better to stick to rgba8unorm here and test using a
 * storage buffer in a fragment shader separately.
 *
 * We can't use rgba32float because it's optional. We can't use rgba16float
 * because it's optional in compat. We can't we use rgba32uint as that can't be
 * multisampled.
 */
async function renderFragmentShaderInputsTo4TexturesAndReadbackValues(
  t: GPUTest,
  {
    interpolationType,
    interpolationSampling,
    sampleCount,
    width,
    height,
    nearFar,
    clipSpacePoints,
    interStagePoints,
    outputCode,
  }: {
    interpolationType: InterpolationType;
    interpolationSampling?: InterpolationSampling;
    width: number;
    height: number;
    sampleCount: number;
    nearFar: readonly number[];
    clipSpacePoints: readonly number[][];
    interStagePoints: readonly number[][];
    outputCode: string;
  }
) {
  const interpolate = `${interpolationType}${
    interpolationSampling ? `, ${interpolationSampling}` : ''
  }`;
  const module = t.device.createShaderModule({
    code: `
      struct Uniforms {
        resolution: vec2f,
      };

      @group(0) @binding(0) var<uniform> uni: Uniforms;

      struct Vertex {
        @builtin(position) position: vec4f,
        @location(0) @interpolate(${interpolate}) interpolatedValue: vec4f,
      };

      @vertex fn vs(@builtin(vertex_index) vNdx: u32) -> Vertex {
        let pos = array(
          ${clipSpacePoints.map(p => `vec4f(${p.join(', ')})`).join(', ')}
        );
        let interStage = array(
          ${interStagePoints.map(p => `vec4f(${p.join(', ')})`).join(', ')}
        );
        var v: Vertex;
        v.position = pos[vNdx];
        v.interpolatedValue = interStage[vNdx];
        _ = uni;
        return v;
      }

      struct FragOut {
        @location(0) out0: vec4f,
        @location(1) out1: vec4f,
        @location(2) out2: vec4f,
        @location(3) out3: vec4f,
      };

      fn u32ToRGBAUnorm(u: u32) -> vec4f {
        return vec4f(
          f32((u >> 24) & 0xFF) / 255.0,
          f32((u >> 16) & 0xFF) / 255.0,
          f32((u >>  8) & 0xFF) / 255.0,
          f32((u >>  0) & 0xFF) / 255.0,
        );
      }

      @fragment fn fs(vin: Vertex) -> FragOut {
        var f: FragOut;
        let v = ${outputCode};
        let u = bitcast<vec4u>(v);
        f.out0 = u32ToRGBAUnorm(u[0]);
        f.out1 = u32ToRGBAUnorm(u[1]);
        f.out2 = u32ToRGBAUnorm(u[2]);
        f.out3 = u32ToRGBAUnorm(u[3]);
        _ = vin.interpolatedValue;
        return f;
      }
    `,
  });

  const textures = range(4, () => {
    const texture = t.device.createTexture({
      size: [width, height],
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_SRC,
      format: 'rgba8unorm',
      sampleCount,
    });
    t.trackForCleanup(texture);
    return texture;
  });

  const pipeline = t.device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs',
    },
    fragment: {
      module,
      entryPoint: 'fs',
      targets: textures.map(() => ({ format: 'rgba8unorm' })),
    },
    multisample: {
      count: sampleCount,
    },
  });

  const texture0 = textures[0];
  const uniformBuffer = t.device.createBuffer({
    size: 8,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  t.trackForCleanup(uniformBuffer);
  t.device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([texture0.width, texture0.height]));

  const viewport = [0, 0, width, height, ...nearFar] as const;

  const bindGroup = t.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  const encoder = t.device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: textures.map(texture => ({
      view: texture.createView(),
      loadOp: 'clear',
      storeOp: 'store',
    })),
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.setViewport(viewport[0], viewport[1], viewport[2], viewport[3], viewport[4], viewport[5]);
  pass.draw(clipSpacePoints.length);
  pass.end();
  t.queue.submit([encoder.finish()]);

  const buffers = await Promise.all(
    textures.map(async texture => {
      const buffer = copyTextureToBufferIncludingMultisampledTextures(t, texture);
      await buffer.mapAsync(GPUMapMode.READ);
      return new Float32Array(buffer.getMappedRange());
    })
  );
  const numElements = buffers[0].length;
  const data = new Float32Array(numElements * 4);
  for (let i = 0; i < numElements; ++i) {
    const offset = i * 4;
    data[offset + 0] = buffers[0][i];
    data[offset + 1] = buffers[1][i];
    data[offset + 2] = buffers[2][i];
    data[offset + 3] = buffers[3][i];
  }
  return data;
}

/**
 * Check whether two TypeArrays are approximately equal
 * Returns `undefined` if the check passes, or an `Error` if not.
 */
function checkElementsApproximatelyEqual(
  actual: TypedArrayBufferView,
  expected: TypedArrayBufferView,
  maxDiff = 0.000001
) {
  return checkElementsPassPredicate(
    actual,
    (index, value) => Math.abs(value - expected[index]) <= maxDiff,
    {
      predicatePrinter: [
        {
          leftHeader: 'expected ==',
          getValueForCell: i => expected[i],
        },
      ],
    }
  );
}

g.test('inputs,position')
  .desc(
    `
    Test fragment shader builtin(position) values.
  `
  )
  .params(u =>
    u //
      .combine('nearFar', [[0, 1] as const, [0.25, 0.75] as const] as const)
      .combine('sampleCount', [1, 4] as const)
      .combine('interpolation', [
        { type: 'perspective', sampling: 'center' },
        // MAINTENANCE_TODO: enable these tests.
        // { type: 'perspective', sampling: 'centroid' },
        // { type: 'perspective', sampling: 'sample' },
        { type: 'linear', sampling: 'center' },
        // MAINTENANCE_TODO: enable these tests.
        // { type: 'linear', sampling: 'centroid' },
        // { type: 'linear', sampling: 'sample' },
        { type: 'flat' },
      ] as const)
  )
  .beforeAllSubcases(t => {
    const {
      interpolation: { type, sampling },
    } = t.params;
    t.skipIfInterpolationTypeOrSamplingNotSupported({ type, sampling });
  })
  .fn(async t => {
    const {
      nearFar,
      sampleCount,
      interpolation: { type, sampling },
    } = t.params;
    // prettier-ignore
    const clipSpacePoints = [       // ndc values
      [0.333, 0.333, 0.333, 0.333],  //  1,  1, 1
      [ 1.0,  -3.0,   0.25, 1.0  ],  //  1, -3, 0.25
      [-1.5,   0.5,   0.25, 0.5  ],  // -3,  1, 0.5
    ];

    const interStagePoints = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
    ];

    const width = 4;
    const height = 4;
    const actual = await renderFragmentShaderInputsTo4TexturesAndReadbackValues(t, {
      interpolationType: type,
      interpolationSampling: sampling,
      sampleCount,
      width,
      height,
      nearFar,
      clipSpacePoints,
      interStagePoints,
      outputCode: 'vin.position',
    });

    const expected = generateFragmentInputs({
      width,
      height,
      nearFar,
      sampleCount,
      clipSpacePoints,
      interpolateFn: computeFragmentPosition,
    });

    t.expectOK(checkElementsApproximatelyEqual(actual, expected));
  });

g.test('inputs,interStage')
  .desc(
    `
    Test fragment shader inter-stage variable values.
  `
  )
  .params(u =>
    u //
      .combine('nearFar', [[0, 1] as const, [0.25, 0.75] as const] as const)
      .combine('sampleCount', [1, 4] as const)
      .combine('interpolation', [
        { type: 'perspective', sampling: 'center' },
        // MAINTENANCE_TODO: enable these tests.
        // { type: 'perspective', sampling: 'centroid' },
        // { type: 'perspective', sampling: 'sample' },
        { type: 'linear', sampling: 'center' },
        // MAINTENANCE_TODO: enable these tests.
        // { type: 'linear', sampling: 'centroid' },
        // { type: 'linear', sampling: 'sample' },
        { type: 'flat' },
      ] as const)
  )
  .beforeAllSubcases(t => {
    const {
      interpolation: { type, sampling },
    } = t.params;
    t.skipIfInterpolationTypeOrSamplingNotSupported({ type, sampling });
  })
  .fn(async t => {
    const {
      nearFar,
      sampleCount,
      interpolation: { type, sampling },
    } = t.params;
    // prettier-ignore
    const clipSpacePoints = [       // ndc values
      [0.333, 0.333, 0.333, 0.333],  //  1,  1, 1
      [ 1.0,  -3.0,   0.25, 1.0  ],  //  1, -3, 0.25
      [-1.5,   0.5,   0.25, 0.5  ],  // -3,  1, 0.5
    ];

    const interStagePoints = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
    ];

    const width = 4;
    const height = 4;
    const actual = await renderFragmentShaderInputsTo4TexturesAndReadbackValues(t, {
      interpolationType: type,
      interpolationSampling: sampling,
      sampleCount,
      width,
      height,
      nearFar,
      clipSpacePoints,
      interStagePoints,
      outputCode: 'vin.interpolatedValue',
    });

    const expected = generateFragmentInputs({
      width,
      height,
      nearFar,
      sampleCount,
      clipSpacePoints,
      interpolateFn: createInterStageInterpolationFn(interStagePoints, type, sampling),
    });

    t.expectOK(checkElementsApproximatelyEqual(actual, expected, 0.00001));
  });
