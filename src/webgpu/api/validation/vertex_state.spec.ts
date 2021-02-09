export const description = `
vertexState validation tests.

TODO: implement the combinations tests below.

TODO Test location= declarations in the shader.

Test each declaration in the shader must have an attribute with that shaderLocation:
 - For each shaderLocation TBD:
  - For buffersIndex = 0 1, limit-1
   - For attribute index = 0, 1, 4
    - Create a vertexState with/without the attribute with that shader location at buffer[bufferIndex].attribs[attribIndex]
     - Check error IFF vertexState doesn't have the shaderLocation

Test each declaration must have a format compatible with the attribute:
 - For each vertex format
  - For each type of shader declaration
   - Check error IFF shader declaration not compatible with the attribute's format.

One-off test that many attributes can overlap.

All tests below are for a vertex buffer index 0, 1, limit-1.

Test the shaderLocation must be unique:
 - For attribute 0, 1, limit - 1.
  - For target attribute value 0, 1, limit -1, limit.

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

import { ValidationTest } from './validation_test.js';

const MAX_VERTEX_ATTRIBUTES: number = 16;
const MAX_VERTEX_BUFFER_END: number = 2048;
const MAX_VERTEX_BUFFER_ARRAY_STRIDE: number = 2048;
const MAX_VERTEX_BUFFERS: number = 8;

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
    this.expectValidationError(() => {
      this.device.createRenderPipeline({
        vertexState,
        vertexStage: {
          module: this.device.createShaderModule({ code: vertexShader }),
          entryPoint: 'main',
        },
        fragmentStage: {
          module: this.device.createShaderModule({
            code: `
            [[location(0)]] var<out> fragColor : vec4<f32>;
            [[stage(fragment)]] fn main() -> void {
              fragColor = vec4<f32>(0.0, 1.0, 0.0, 1.0);
            }`,
          }),
          entryPoint: 'main',
        },
        primitiveTopology: 'triangle-list',
        colorStates: [{ format: 'rgba8unorm' }],
      });
    }, !success);
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
      .combine(poptions('count', [0, 1, MAX_VERTEX_BUFFERS, MAX_VERTEX_BUFFERS + 1]))
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
          attributes: [{ format: 'float', offset: 0, shaderLocation: 0 }],
          arrayStride: 0,
        });
      }
    }

    const success = count <= MAX_VERTEX_BUFFERS;
    t.testVertexState(success, { vertexBuffers });
  });

g.test('max_vertex_attribute_limit')
  .desc(
    `Test that only up to <maxVertexAttributes> vertex attributes are allowed.
   - Tests with 0, 1, limit, limits + 1 vertex attributes.
   - Tests with 0, 1, 4 attributes per buffer (with remaining attributes in the last buffer).`
  )
  .subcases(() =>
    params()
      .combine(poptions('attribCount', [0, 1, MAX_VERTEX_ATTRIBUTES, MAX_VERTEX_ATTRIBUTES + 1]))
      .combine(poptions('attribsPerBuffer', [0, 1, 4]))
  )
  .fn(t => {
    const { attribCount, attribsPerBuffer } = t.params;

    const vertexBuffers: GPUVertexBufferLayoutDescriptor[] = [];

    let attribsAdded = 0;
    while (attribsAdded !== attribCount) {
      // Choose how many attributes to add for this buffer. The last buffer gets all remaining attributes.
      let targetCount = Math.min(attribCount, attribsAdded + attribsPerBuffer);
      if (vertexBuffers.length === MAX_VERTEX_BUFFERS - 1) {
        targetCount = attribCount;
      }

      const attributes: GPUVertexAttributeDescriptor[] = [];
      while (attribsAdded !== targetCount) {
        attributes.push({ format: 'float', offset: 0, shaderLocation: attribsAdded });
        attribsAdded++;
      }

      vertexBuffers.push({ arrayStride: 0, attributes });
    }

    const success = attribCount <= MAX_VERTEX_ATTRIBUTES;
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
      .combine(poptions('vertexBufferIndex', [0, 1, MAX_VERTEX_BUFFERS - 1]))
      .combine(
        poptions('arrayStride', [
          0,
          4,
          256,
          MAX_VERTEX_BUFFER_ARRAY_STRIDE - 4,
          MAX_VERTEX_BUFFER_ARRAY_STRIDE,
          MAX_VERTEX_BUFFER_ARRAY_STRIDE + 4,
        ])
      )
  )
  .fn(t => {
    const { vertexBufferIndex, arrayStride } = t.params;

    const vertexBuffers: GPUVertexBufferLayoutDescriptor[] = [];
    vertexBuffers[vertexBufferIndex] = { arrayStride, attributes: [] };

    const success = arrayStride <= MAX_VERTEX_BUFFER_ARRAY_STRIDE;
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
      .combine(poptions('vertexBufferIndex', [0, 1, MAX_VERTEX_BUFFERS - 1]))
      .combine(
        poptions('arrayStride', [
          0,
          1,
          2,
          4,
          MAX_VERTEX_BUFFER_ARRAY_STRIDE - 4,
          MAX_VERTEX_BUFFER_ARRAY_STRIDE - 2,
          MAX_VERTEX_BUFFER_ARRAY_STRIDE,
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
      .combine(poptions('vertexBufferIndex', [0, 1, MAX_VERTEX_BUFFERS - 1]))
      .combine(poptions('extraAttributes', [0, 1, MAX_VERTEX_ATTRIBUTES - 1]))
      .combine(pbool('testAttributeAtStart'))
      .combine(
        poptions('testShaderLocation', [0, 1, MAX_VERTEX_ATTRIBUTES - 1, MAX_VERTEX_ATTRIBUTES])
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

      attributes.push({ format: 'float', shaderLocation: currentLocation, offset: 0 });
      currentLocation++;
    }

    const testAttribute: GPUVertexAttributeDescriptor = {
      format: 'float',
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

    const success = testShaderLocation < MAX_VERTEX_ATTRIBUTES;
    t.testVertexState(success, { vertexBuffers });
  });

g.test('pipeline_vertex_buffers_are_backed_by_attributes_in_vertex_input').fn(async t => {
  const vertexState: GPUVertexStateDescriptor = {
    vertexBuffers: [
      {
        arrayStride: 2 * SIZEOF_FLOAT,
        attributes: [
          {
            format: 'float',
            offset: 0,
            shaderLocation: 0,
          },
          {
            format: 'float',
            offset: 0,
            shaderLocation: 1,
          },
        ],
      },
    ],
  };
  {
    // Control case: pipeline with one input per attribute
    const code = `
      [[location(0)]] var<in> a : vec4<f32>;
      [[location(1)]] var<in> b : vec4<f32>;

      [[builtin(position)]] var<out> Position : vec4<f32>;
      [[stage(vertex)]] fn main() -> void {
        Position = vec4<f32>(0.0, 0.0, 0.0, 0.0);
        return;
      }
  `;
    const descriptor = t.getDescriptor(vertexState, code);
    t.device.createRenderPipeline(descriptor);
  }
  {
    // Check it is valid for the pipeline to use a subset of the VertexState
    const code = `
      [[location(0)]] var<in> a : vec4<f32>;

      [[builtin(position)]] var<out> Position : vec4<f32>;
      [[stage(vertex)]] fn main() -> void {
        Position = vec4<f32>(0.0, 0.0, 0.0, 0.0);
        return;
      }
    `;
    const descriptor = t.getDescriptor(vertexState, code);
    t.device.createRenderPipeline(descriptor);
  }
  {
    // Check for an error when the pipeline uses an attribute not in the vertex input
    const code = `
      [[location(2)]] var<in> a : vec4<f32>;

      [[builtin(position)]] var<out> Position : vec4<f32>;
      [[stage(vertex)]] fn main() -> void {
        Position = vec4<f32>(0.0, 0.0, 0.0, 0.0);
        return;
      }
    `;
    const descriptor = t.getDescriptor(vertexState, code);

    t.expectValidationError(() => {
      t.device.createRenderPipeline(descriptor);
    });
  }
});

g.test('offset_should_be_within_vertex_buffer_arrayStride_if_arrayStride_is_not_zero').fn(
  async t => {
    const vertexState = {
      vertexBuffers: [
        {
          arrayStride: 2 * SIZEOF_FLOAT,
          attributes: [
            {
              format: 'float' as GPUVertexFormat,
              offset: 0,
              shaderLocation: 0,
            },
            {
              format: 'float' as GPUVertexFormat,
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
      badVertexState.vertexBuffers[0].attributes[1].format = 'float2';
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
            format: 'float' as GPUVertexFormat,
            offset: 0,
            shaderLocation: 0,
          },
          {
            format: 'float' as GPUVertexFormat,
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
    overlappingVertexState.vertexBuffers[0].attributes[0].format = 'int2';
    const descriptor = t.getDescriptor(overlappingVertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);
    t.device.createRenderPipeline(descriptor);
  }
});

g.test('identical_duplicate_attributes_are_invalid').fn(async t => {
  const vertexState = {
    vertexBuffers: [
      {
        arrayStride: 0,
        attributes: [{ format: 'float' as const, offset: 0, shaderLocation: 0 }],
      },
    ],
  };
  {
    // Control case, setting attribute 0
    const descriptor = t.getDescriptor(vertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);
    t.device.createRenderPipeline(descriptor);
  }
  {
    // Oh no, attribute 0 is set twice
    vertexState.vertexBuffers[0].attributes.push({
      format: 'float' as const,
      offset: 0,
      shaderLocation: 0,
    });
    const descriptor = t.getDescriptor(vertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);

    t.expectValidationError(() => {
      t.device.createRenderPipeline(descriptor);
    });
  }
});

g.test('we_cannot_set_same_shader_location').fn(async t => {
  {
    const vertexState = {
      vertexBuffers: [
        {
          arrayStride: 0,
          attributes: [
            { format: 'float' as const, offset: 0, shaderLocation: 0 },
            { format: 'float' as const, offset: SIZEOF_FLOAT, shaderLocation: 1 },
          ],
        },
      ],
    };
    {
      // Control case, setting different shader locations in two attributes
      const descriptor = t.getDescriptor(vertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);
      t.device.createRenderPipeline(descriptor);
    }
    {
      // Test same shader location in two attributes in the same buffer
      vertexState.vertexBuffers[0].attributes[1].shaderLocation = 0;
      const descriptor = t.getDescriptor(vertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);

      t.expectValidationError(() => {
        t.device.createRenderPipeline(descriptor);
      });
    }
  }
  {
    const vertexState: GPUVertexStateDescriptor = {
      vertexBuffers: [
        {
          arrayStride: 0,
          attributes: [
            {
              format: 'float',
              offset: 0,
              shaderLocation: 0,
            },
          ],
        },
        {
          arrayStride: 0,
          attributes: [
            {
              format: 'float',
              offset: 0,
              shaderLocation: 0,
            },
          ],
        },
      ],
    };
    // Test same shader location in two attributes in different buffers
    const descriptor = t.getDescriptor(vertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);

    t.expectValidationError(() => {
      t.device.createRenderPipeline(descriptor);
    });
  }
});

g.test('check_out_of_bounds_condition_on_attribute_shader_location').fn(async t => {
  const vertexState = {
    vertexBuffers: [
      {
        arrayStride: 0,
        attributes: [
          { format: 'float' as const, offset: 0, shaderLocation: MAX_VERTEX_ATTRIBUTES - 1 },
        ],
      },
    ],
  };
  {
    // Control case, setting last attribute shader location
    const descriptor = t.getDescriptor(vertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);
    t.device.createRenderPipeline(descriptor);
  }
  {
    // Test attribute location OOB
    vertexState.vertexBuffers[0].attributes[0].shaderLocation = MAX_VERTEX_ATTRIBUTES;
    const descriptor = t.getDescriptor(vertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);

    t.expectValidationError(() => {
      t.device.createRenderPipeline(descriptor);
    });
  }
});

g.test('check_attribute_offset_out_of_bounds').fn(async t => {
  const vertexState = {
    vertexBuffers: [
      {
        arrayStride: 0,
        attributes: [
          {
            format: 'float2' as const,
            offset: MAX_VERTEX_BUFFER_END - 2 * SIZEOF_FLOAT,
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
    vertexState.vertexBuffers[0].attributes[0].offset = MAX_VERTEX_BUFFER_END - 4;
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
          { format: 'float' as GPUVertexFormat, offset: SIZEOF_FLOAT, shaderLocation: 0 },
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
    // Test offset of 2 bytes with uchar2 format
    vertexState.vertexBuffers[0].attributes[0].offset = 2;
    vertexState.vertexBuffers[0].attributes[0].format = 'uchar2';
    const descriptor = t.getDescriptor(vertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);
    t.expectValidationError(() => {
      t.device.createRenderPipeline(descriptor);
    });
  }
  {
    // Test offset of 2 bytes with float format
    vertexState.vertexBuffers[0].attributes[0].offset = 2;
    vertexState.vertexBuffers[0].attributes[0].format = 'float';
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
        attributes: [{ format: 'float', offset: Number.MAX_SAFE_INTEGER, shaderLocation: 0 }],
      },
    ],
  };
  const descriptor = t.getDescriptor(vertexState, VERTEX_SHADER_CODE_WITH_NO_INPUT);

  t.expectValidationError(() => {
    t.device.createRenderPipeline(descriptor);
  });
});
