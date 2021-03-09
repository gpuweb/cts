export const description = `
vertexState validation tests.

TODO: implement the combinations tests below.

Test each declaration must have a format compatible with the attribute:
 - For each vertex format
  - For each type of shader declaration
   - Check error IFF shader declaration not compatible with the attribute's format.

One-off test that many attributes can overlap.

All tests below are for a vertex buffer index 0, 1, limit-1.

Test check that the end attribute must be contained in the stride:
 - For stride = 0 (special case), 4, 128, limit
   - For each vertex format
    - For offset stride, stride - componentsize(format), stride - sizeof(format), stride - sizeof(format) + componentsize(format), 0, 2^32 - componentsize(format), 2^32, 2**60
      - Check error IFF offset + sizeof(format) > stride (or 2048 for 0)

Test that an attribute must be aligned to the component size:
 - For each vertex format
  - For stride = 2*sizeof(format), 128, limit
    - For offset = componentsize(format), componentsize(format) / 2, stride - sizeof(format) - componentsize(format), stride - sizeof(format)
     - Check error IFF offset not aligned to componentsize(format);
`;

import { params, pbool, poptions } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import {
  kMaxVertexAttributes,
  kMaxVertexBufferArrayStride,
  kMaxVertexBuffers,
} from '../../capability_info.js';

import { ValidationTest } from './validation_test.js';

const SIZEOF_FLOAT = Float32Array.BYTES_PER_ELEMENT;

const VERTEX_SHADER_CODE_WITH_NO_INPUT = `
  [[builtin(position)]] var<out> Position : vec4<f32>;
  [[stage(vertex)]] fn main() -> void {
    Position = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
`;

function clone<T extends GPUVertexStateDescriptor>(descriptor: T): T {
  return JSON.parse(JSON.stringify(descriptor));
}

class F extends ValidationTest {
  getDescriptor(
    vertexState: GPUVertexStateDescriptor,
    vertexShaderCode: string
  ): GPURenderPipelineDescriptor {
    const descriptor: GPURenderPipelineDescriptor = {
      vertexStage: {
        module: this.device.createShaderModule({ code: vertexShaderCode }),
        entryPoint: 'main',
      },
      fragmentStage: {
        module: this.device.createShaderModule({
          code: `
            [[location(0)]] var<out> fragColor : vec4<f32>;
            [[stage(fragment)]] fn main() -> void {
              fragColor = vec4<f32>(0.0, 1.0, 0.0, 1.0);
              return;
            }`,
        }),
        entryPoint: 'main',
      },
      primitiveTopology: 'triangle-list',
      colorStates: [{ format: 'rgba8unorm' }],
      vertexState,
    };
    return descriptor;
  }

  testVertexState(
    success: boolean,
    vertexState: GPUVertexStateDescriptor,
    vertexShader: string = VERTEX_SHADER_CODE_WITH_NO_INPUT
  ) {
    const vsModule = this.device.createShaderModule({ code: vertexShader });
    const fsModule = this.device.createShaderModule({
      code: `
        [[location(0)]] var<out> fragColor : vec4<f32>;
        [[stage(fragment)]] fn main() -> void {
          fragColor = vec4<f32>(0.0, 1.0, 0.0, 1.0);
        }`,
    });

    this.expectValidationError(() => {
      this.device.createRenderPipeline({
        vertexState,
        vertexStage: {
          module: vsModule,
          entryPoint: 'main',
        },
        fragmentStage: {
          module: fsModule,
          entryPoint: 'main',
        },
        primitiveTopology: 'triangle-list',
        colorStates: [{ format: 'rgba8unorm' }],
      });
    }, !success);
  }

  generateTestVertexShader(inputs: { type: string; location: number }[]): string {
    let interfaces = '';
    let body = '';

    let count = 0;
    for (const input of inputs) {
      interfaces += `[[location(${input.location})]] var<in> input${count} : ${input.type};\n`;
      body += `var i${count} : ${input.type} = input${count};\n`;
      count++;
    }

    return `
      [[builtin(position)]] var<out> Position : vec4<f32>;
      ${interfaces}
      [[stage(vertex)]] fn main() -> void {
        Position = vec4<f32>(0.0, 0.0, 0.0, 0.0);
        ${body}
      }
    `;
  }
}

export const g = makeTestGroup(F);

g.test('max_vertex_buffer_limit')
  .desc(
    `Test that only up to <maxVertexBuffers> vertex buffers are allowed.
   - Tests with 0, 1, limits, limits + 1 vertex buffers.
   - Tests with the last buffer having an attribute or not.
  This also happens to test that vertex buffers with no attributes are allowed and that a vertex state with no buffers is allowed.`
  )
  .subcases(() =>
    params()
      .combine(poptions('count', [0, 1, kMaxVertexBuffers, kMaxVertexBuffers + 1]))
      .combine(pbool('lastEmpty'))
  )
  .fn(t => {
    const { count, lastEmpty } = t.params;

    const vertexBuffers: GPUVertexBufferLayoutDescriptor[] = [];
    for (let i = 0; i < count; i++) {
      if (lastEmpty || i !== count - 1) {
        vertexBuffers.push({ attributes: [], arrayStride: 0 });
      } else {
        vertexBuffers.push({
          attributes: [{ format: 'float32', offset: 0, shaderLocation: 0 }],
          arrayStride: 0,
        });
      }
    }

    const success = count <= kMaxVertexBuffers;
    t.testVertexState(success, { vertexBuffers });
  });

g.test('max_vertex_attribute_limit')
  .desc(
    `Test that only up to <maxVertexAttributes> vertex attributes are allowed.
   - Tests with 0, 1, limit, limits + 1 vertex attribute.
   - Tests with 0, 1, 4 attributes per buffer (with remaining attributes in the last buffer).`
  )
  .subcases(() =>
    params()
      .combine(poptions('attribCount', [0, 1, kMaxVertexAttributes, kMaxVertexAttributes + 1]))
      .combine(poptions('attribsPerBuffer', [0, 1, 4]))
  )
  .fn(t => {
    const { attribCount, attribsPerBuffer } = t.params;

    const vertexBuffers: GPUVertexBufferLayoutDescriptor[] = [];

    let attribsAdded = 0;
    while (attribsAdded !== attribCount) {
      // Choose how many attributes to add for this buffer. The last buffer gets all remaining attributes.
      let targetCount = Math.min(attribCount, attribsAdded + attribsPerBuffer);
      if (vertexBuffers.length === kMaxVertexBuffers - 1) {
        targetCount = attribCount;
      }

      const attributes: GPUVertexAttributeDescriptor[] = [];
      while (attribsAdded !== targetCount) {
        attributes.push({ format: 'float32', offset: 0, shaderLocation: attribsAdded });
        attribsAdded++;
      }

      vertexBuffers.push({ arrayStride: 0, attributes });
    }

    const success = attribCount <= kMaxVertexAttributes;
    t.testVertexState(success, { vertexBuffers });
  });

g.test('max_vertex_buffer_array_stride_limit')
  .desc(
    `Test that the vertex buffer arrayStride must be at most <maxVertexBufferArrayStride>.
   - Test for various vertex buffer indices
   - Test for array strides 0, 4, 256, limit - 4, limit, limit + 4`
  )
  .subcases(() =>
    params()
      .combine(poptions('vertexBufferIndex', [0, 1, kMaxVertexBuffers - 1]))
      .combine(
        poptions('arrayStride', [
          0,
          4,
          256,
          kMaxVertexBufferArrayStride - 4,
          kMaxVertexBufferArrayStride,
          kMaxVertexBufferArrayStride + 4,
        ])
      )
  )
  .fn(t => {
    const { vertexBufferIndex, arrayStride } = t.params;

    const vertexBuffers: GPUVertexBufferLayoutDescriptor[] = [];
    vertexBuffers[vertexBufferIndex] = { arrayStride, attributes: [] };

    const success = arrayStride <= kMaxVertexBufferArrayStride;
    t.testVertexState(success, { vertexBuffers });
  });

g.test('vertex_buffer_array_stride_limit_alignment')
  .desc(
    `Test that the vertex buffer arrayStride must be a multiple of 4 (including 0).
   - Test for various vertex buffer indices
   - Test for array strides 0, 1, 2, 4, limit - 4, limit - 2, limit`
  )
  .subcases(() =>
    params()
      .combine(poptions('vertexBufferIndex', [0, 1, kMaxVertexBuffers - 1]))
      .combine(
        poptions('arrayStride', [
          0,
          1,
          2,
          4,
          kMaxVertexBufferArrayStride - 4,
          kMaxVertexBufferArrayStride - 2,
          kMaxVertexBufferArrayStride,
        ])
      )
  )
  .fn(t => {
    const { vertexBufferIndex, arrayStride } = t.params;

    const vertexBuffers: GPUVertexBufferLayoutDescriptor[] = [];
    vertexBuffers[vertexBufferIndex] = { arrayStride, attributes: [] };

    const success = arrayStride % 4 === 0;
    t.testVertexState(success, { vertexBuffers });
  });

g.test('vertex_attribute_shaderLocation_limit')
  .desc(
    `Test shaderLocation must be less than maxVertexAttributes.
   - Test for various vertex buffer indices
   - Test for various amounts of attributes in that vertex buffer
   - Test for shaderLocation 0, 1, limit - 1, limit`
  )
  .subcases(() =>
    params()
      .combine(poptions('vertexBufferIndex', [0, 1, kMaxVertexBuffers - 1]))
      .combine(poptions('extraAttributes', [0, 1, kMaxVertexAttributes - 1]))
      .combine(pbool('testAttributeAtStart'))
      .combine(
        poptions('testShaderLocation', [0, 1, kMaxVertexAttributes - 1, kMaxVertexAttributes])
      )
  )
  .fn(t => {
    const {
      vertexBufferIndex,
      extraAttributes,
      testShaderLocation,
      testAttributeAtStart,
    } = t.params;

    const attributes: GPUVertexAttributeDescriptor[] = [];

    let currentLocation = 0;
    for (let i = 0; i < extraAttributes; i++) {
      if (currentLocation === testShaderLocation) {
        currentLocation++;
      }

      attributes.push({ format: 'float32', shaderLocation: currentLocation, offset: 0 });
      currentLocation++;
    }

    const testAttribute: GPUVertexAttributeDescriptor = {
      format: 'float32',
      shaderLocation: testShaderLocation,
      offset: 0,
    };
    if (testAttributeAtStart) {
      attributes.unshift(testAttribute);
    } else {
      attributes.push(testAttribute);
    }

    const vertexBuffers: GPUVertexBufferLayoutDescriptor[] = [];
    vertexBuffers[vertexBufferIndex] = { arrayStride: 256, attributes };

    const success = testShaderLocation < kMaxVertexAttributes;
    t.testVertexState(success, { vertexBuffers });
  });

g.test('vertex_attribute_shaderLocation_unique')
  .desc(
    `Test that shaderLocation must be unique in the vertex state.
   - Test for various pairs of buffers that contain the potentially conflicting attributes
   - Test for the potentially conflicting attributes in various places in the buffers (with dummy attributes)
   - Test for various shaderLocations that conflict or not`
  )
  .subcases(() =>
    params()
      .combine(poptions('vertexBufferIndexA', [0, 1, kMaxVertexBuffers - 1]))
      .combine(poptions('vertexBufferIndexB', [0, 1, kMaxVertexBuffers - 1]))
      .combine(pbool('testAttributeAtStartA'))
      .combine(pbool('testAttributeAtStartB'))
      .combine(poptions('shaderLocationA', [0, 1, 7, kMaxVertexAttributes - 1]))
      .combine(poptions('shaderLocationB', [0, 1, 7, kMaxVertexAttributes - 1]))
      .combine(poptions('extraAttributes', [0, 4]))
  )
  .fn(t => {
    const {
      vertexBufferIndexA,
      vertexBufferIndexB,
      testAttributeAtStartA,
      testAttributeAtStartB,
      shaderLocationA,
      shaderLocationB,
      extraAttributes,
    } = t.params;

    // Depending on the params, the vertexBuffer for A and B can be the same or different. To support
    // both cases without code changes we treat `vertexBufferAttributes` as a map from indices to
    // vertex buffer descriptors, with A and B potentially reusing the same JS object if they have the
    // same index.
    const vertexBufferAttributes: GPUVertexAttributeDescriptor[][] = [];
    vertexBufferAttributes[vertexBufferIndexA] = [];
    vertexBufferAttributes[vertexBufferIndexB] = [];

    // Add the dummy attributes for attribute A
    const attributesA = vertexBufferAttributes[vertexBufferIndexA];
    let currentLocation = 0;
    for (let i = 0; i < extraAttributes; i++) {
      if (currentLocation === shaderLocationA || currentLocation === shaderLocationB) {
        currentLocation++;
        continue;
      }

      attributesA.push({ format: 'float32', shaderLocation: currentLocation, offset: 0 });
      currentLocation++;
    }

    // Add attribute A
    if (testAttributeAtStartA) {
      attributesA.unshift({ format: 'float32', offset: 0, shaderLocation: shaderLocationA });
    } else {
      attributesA.push({ format: 'float32', offset: 0, shaderLocation: shaderLocationA });
    }

    // Add attribute B. Not that attributesB can be the same object as attributesA.
    const attributesB = vertexBufferAttributes[vertexBufferIndexB];
    if (testAttributeAtStartB) {
      attributesB.unshift({ format: 'float32', offset: 0, shaderLocation: shaderLocationB });
    } else {
      attributesB.push({ format: 'float32', offset: 0, shaderLocation: shaderLocationB });
    }

    // Use the attributes to make the list of vertex buffers. Note that we might be setting the same vertex
    // buffer twice, but that only happens when it is the only vertex buffer.
    const vertexBuffers: GPUVertexBufferLayoutDescriptor[] = [];
    vertexBuffers[vertexBufferIndexA] = { arrayStride: 256, attributes: attributesA };
    vertexBuffers[vertexBufferIndexB] = { arrayStride: 256, attributes: attributesB };

    // Note that an empty vertex shader will be used so errors only happens because of the conflict
    // in the vertex state.
    const success = shaderLocationA !== shaderLocationB;
    t.testVertexState(success, { vertexBuffers });
  });

g.test('vertex_shader_input_location_limit')
  .desc(
    `Test that vertex shader's input's location decoration must be less than maxVertexAttributes.
   - Test for shaderLocation 0, 1, limit - 1, limit`
  )
  .subcases(() =>
    params().combine(
      poptions('testLocation', [0, 1, kMaxVertexAttributes - 1, kMaxVertexAttributes, -1, 2 ** 32])
    )
  )
  .fn(t => {
    const { testLocation } = t.params;

    const shader = t.generateTestVertexShader([
      {
        type: 'vec4<f32>',
        location: testLocation,
      },
    ]);

    const vertexBuffers: GPUVertexBufferLayoutDescriptor[] = [
      {
        arrayStride: 512,
        attributes: [
          {
            format: 'float32',
            offset: 0,
            shaderLocation: testLocation,
          },
        ],
      },
    ];

    const success = testLocation < kMaxVertexAttributes;
    t.testVertexState(success, { vertexBuffers }, shader);
  });

g.test('vertex_shader_input_location_in_vertex_state')
  .desc(
    `Test that a vertex shader defined in the shader must have a corresponding attribute in the vertex state.
       - Test for various input locations.
       - Test for the attribute in various places in the list of vertex buffer and various places inside the vertex buffer descriptor`
  )
  .subcases(() =>
    params()
      .combine(poptions('vertexBufferIndex', [0, 1, kMaxVertexBuffers - 1]))
      .combine(poptions('extraAttributes', [0, 1, kMaxVertexAttributes - 1]))
      .combine(pbool('testAttributeAtStart'))
      .combine(poptions('testShaderLocation', [0, 1, 4, 7, kMaxVertexAttributes - 1]))
  )
  .fn(t => {
    const {
      vertexBufferIndex,
      extraAttributes,
      testAttributeAtStart,
      testShaderLocation,
    } = t.params;
    // We have a shader using `testShaderLocation`.
    const shader = t.generateTestVertexShader([
      {
        type: 'vec4<f32>',
        location: testShaderLocation,
      },
    ]);

    // Fill attributes with a bunch of attributes for other locations.
    const attributes: GPUVertexAttributeDescriptor[] = [];

    let currentLocation = 0;
    for (let i = 0; i < extraAttributes; i++) {
      if (currentLocation === testShaderLocation) {
        currentLocation++;
      }

      attributes.push({ format: 'float32', shaderLocation: currentLocation, offset: 0 });
      currentLocation++;
    }

    // Using that vertex state is invalid because the vertex state doesn't contain the test location
    const vertexBuffers: GPUVertexBufferLayoutDescriptor[] = [];
    vertexBuffers[vertexBufferIndex] = { arrayStride: 256, attributes };
    t.testVertexState(false, { vertexBuffers }, shader);

    // Add an attribute for the test location and try again.
    const testAttribute: GPUVertexAttributeDescriptor = {
      format: 'float32',
      shaderLocation: testShaderLocation,
      offset: 0,
    };
    if (testAttributeAtStart) {
      attributes.unshift(testAttribute);
    } else {
      attributes.push(testAttribute);
    }

    t.testVertexState(true, { vertexBuffers }, shader);
  });

g.test('offset_should_be_within_vertex_buffer_arrayStride_if_arrayStride_is_not_zero').fn(
  async t => {
    const vertexState = {
      vertexBuffers: [
        {
          arrayStride: 2 * SIZEOF_FLOAT,
          attributes: [
            {
              format: 'float32' as GPUVertexFormat,
              offset: 0,
              shaderLocation: 0,
            },
            {
              format: 'float32' as GPUVertexFormat,
              offset: SIZEOF_FLOAT,
              shaderLocation: 1,
            },
          ],
        },
      ],
    };
    {
      // Control case, setting correct arrayStride and offset
      const descriptor = t.getDescriptor(vertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);
      t.device.createRenderPipeline(descriptor);
    }
    {
      // Test vertex attribute offset exceed vertex buffer arrayStride range
      const badVertexState = clone(vertexState);
      badVertexState.vertexBuffers[0].attributes[1].format = 'float32x2';
      const descriptor = t.getDescriptor(badVertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);

      t.expectValidationError(() => {
        t.device.createRenderPipeline(descriptor);
      });
    }
    {
      // Test vertex attribute offset exceed vertex buffer arrayStride range
      const badVertexState = clone(vertexState);
      badVertexState.vertexBuffers[0].arrayStride = SIZEOF_FLOAT;
      const descriptor = t.getDescriptor(badVertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);

      t.expectValidationError(() => {
        t.device.createRenderPipeline(descriptor);
      });
    }
    {
      // It's OK if arrayStride is zero
      const goodVertexState = clone(vertexState);
      goodVertexState.vertexBuffers[0].arrayStride = 0;
      const descriptor = t.getDescriptor(goodVertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);
      t.device.createRenderPipeline(descriptor);
    }
  }
);

// TODO: This should be made into an operation test.
g.test('check_two_attributes_overlapping').fn(async t => {
  const vertexState = {
    vertexBuffers: [
      {
        arrayStride: 2 * SIZEOF_FLOAT,
        attributes: [
          {
            format: 'float32' as GPUVertexFormat,
            offset: 0,
            shaderLocation: 0,
          },
          {
            format: 'float32' as GPUVertexFormat,
            offset: SIZEOF_FLOAT,
            shaderLocation: 1,
          },
        ],
      },
    ],
  };
  {
    // Control case, setting correct arrayStride and offset
    const descriptor = t.getDescriptor(vertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);
    t.device.createRenderPipeline(descriptor);
  }
  {
    // Test two attributes overlapping
    const overlappingVertexState = clone(vertexState);
    overlappingVertexState.vertexBuffers[0].attributes[0].format = 'sint32x2';
    const descriptor = t.getDescriptor(overlappingVertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);
    t.device.createRenderPipeline(descriptor);
  }
});

g.test('check_attribute_offset_out_of_bounds').fn(async t => {
  const vertexState = {
    vertexBuffers: [
      {
        arrayStride: 0,
        attributes: [
          {
            format: 'float32x2' as const,
            offset: kMaxVertexBufferArrayStride - 2 * SIZEOF_FLOAT,
            shaderLocation: 0,
          },
        ],
      },
    ],
  };
  {
    // Control case, setting max attribute offset to MAX_VERTEX_BUFFER_END - 8
    const descriptor = t.getDescriptor(vertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);
    t.device.createRenderPipeline(descriptor);
  }
  {
    // Control case, setting attribute offset to 8
    vertexState.vertexBuffers[0].attributes[0].offset = 8;
    const descriptor = t.getDescriptor(vertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);
    t.device.createRenderPipeline(descriptor);
  }
  {
    // Test attribute offset out of bounds
    vertexState.vertexBuffers[0].attributes[0].offset = kMaxVertexBufferArrayStride - 4;
    const descriptor = t.getDescriptor(vertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);

    t.expectValidationError(() => {
      t.device.createRenderPipeline(descriptor);
    });
  }
});

g.test('check_multiple_of_4_bytes_constraint_on_offset').fn(async t => {
  const vertexState = {
    vertexBuffers: [
      {
        arrayStride: 0,
        attributes: [
          { format: 'float32' as GPUVertexFormat, offset: SIZEOF_FLOAT, shaderLocation: 0 },
        ],
      },
    ],
  };
  {
    // Control case, setting offset 4 bytes
    const descriptor = t.getDescriptor(vertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);
    t.device.createRenderPipeline(descriptor);
  }
  {
    // Test offset of 2 bytes with uint8x2 format
    vertexState.vertexBuffers[0].attributes[0].offset = 2;
    vertexState.vertexBuffers[0].attributes[0].format = 'uint8x2';
    const descriptor = t.getDescriptor(vertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);
    t.expectValidationError(() => {
      t.device.createRenderPipeline(descriptor);
    });
  }
  {
    // Test offset of 2 bytes with float32 format
    vertexState.vertexBuffers[0].attributes[0].offset = 2;
    vertexState.vertexBuffers[0].attributes[0].format = 'float32';
    const descriptor = t.getDescriptor(vertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);

    t.expectValidationError(() => {
      t.device.createRenderPipeline(descriptor);
    });
  }
});

g.test('check_attribute_offset_overflow').fn(async t => {
  const vertexState: GPUVertexStateDescriptor = {
    vertexBuffers: [
      {
        arrayStride: 0,
        attributes: [{ format: 'float32', offset: Number.MAX_SAFE_INTEGER, shaderLocation: 0 }],
      },
    ],
  };
  const descriptor = t.getDescriptor(vertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);

  t.expectValidationError(() => {
    t.device.createRenderPipeline(descriptor);
  });
});
