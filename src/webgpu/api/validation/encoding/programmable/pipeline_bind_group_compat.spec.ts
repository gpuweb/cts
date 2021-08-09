export const description = `
TODO:
- test compatibility between bind groups and pipelines
    - bind groups required by the pipeline layout are required.
    - bind groups unused by the pipeline layout can be set or not.
        (Even if e.g. bind groups 0 and 2 are used, but 1 is unused.)
    - bindGroups[i].layout is "group-equivalent" (value-equal) to pipelineLayout.bgls[i].
    - in the test fn, test once without the dispatch/draw (should always be valid) and once with
      the dispatch/draw, to make sure the validation happens in dispatch/draw.
    - x= {dispatch, all draws} (dispatch/draw should be size 0 to make sure validation still happens if no-op)
    - x= all relevant stages

TODO: subsume existing test, rewrite fixture as needed.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { assert, unreachable } from '../../../../../common/util/util.js';
import { ValidationTest } from '../../validation_test.js';

function generateBindingDeclare(group: number, binding: GPUBindGroupLayoutEntry) {
  // Buffers:
  //   - var<uniform> buf : Buf;
  //   - var<storage, read_write> buf: Buf;
  //   - var<storage, read> buf: Buf;

  // ExternalTexture:
  //   - var tex : texture_external;

  // Sampler:
  //   - var samp : sampler;
  //   - var samp : sampler_comparison;

  // StorageTexture: access must be write is specified
  //   - var storeTex: texture_storage_1d<texel_format,access>
  //   - var storeTex: texture_storage_2d<texel_format,access>
  //   - var storeTex: texture_storage_3d<texel_format,access>

  // Texture
  //   - var tex: texture_1d<type>
  //   - var tex: texture_2d<type>
  //   - var tex: texture_2d_array<type>
  //   - var tex: texture_3d<type>
  //   - var tex: texture_cube<type>
  //   - var tex: texture_cube_array<type>
  //   - var tex: texture_multisampled_2d<type>
  //   - var tex: texture_depth_2d;
  //   - var tex: texture_depth_2d_array;
  //   - var tex: texture_depth_multisampled_2d;
  //   - var tex: texture_depth_cube_array;
  //   - var tex: texture_depth_cube;

  let declare: string;
  if (binding.buffer !== undefined) {
    let decoration: string;
    if (binding.buffer.type === undefined) {
      decoration = 'uniform';
    } else {
      switch (binding.buffer.type) {
        case 'uniform': {
          decoration = 'uniform';
          break;
        }
        case 'storage': {
          decoration = 'storage, read_write';
          break;
        }
        case 'read-only-storage': {
          decoration = 'storage, read';
          break;
        }
        default:
          unreachable();
      }
    }
    declare = `var<${decoration}> buf: Buf`;
  } else if (binding.externalTexture !== undefined) {
    declare = `var tex : texture_external;`;
  } else if (binding.sampler !== undefined) {
    let suffix: string;
    switch (binding.sampler.type) {
      case 'filtering':
      case 'non-filtering': {
        suffix = 'sampler';
        break;
      }
      case 'comparison': {
        suffix = 'sampler_comparison';
        break;
      }
      default:
        unreachable();
    }
    declare = `var samp : ${suffix}`;
  } else if (binding.storageTexture !== undefined) {
    let suffix: string;
    let textureType: string;
    let texelFormat: string;

    if (binding.storageTexture.viewDimension === undefined) {
      textureType = 'texture_storage_2d';
    } else {
      switch (binding.storageTexture.viewDimension) {
        case '1d': {
          textureType = 'texture_storage_1d';
          break;
        }
        case '2d': {
          textureType = 'texture_storage_2d';
          break;
        }
        case '2d-array':
        case '3d': {
          textureType = 'texture_storage_3d';
          break;
        }
        default:
          // Cannot be 'cube' or 'cube-array'
          unreachable();
      }
    }

    switch (binding.storageTexture.format) {
      // float
      case 'rgba8unorm':
      case 'rgba8snorm':
      case 'rgba16float':
      case 'r32float':
      case 'rg32float':
      case 'rgba32float': {
        texelFormat = 'f32';
        break;
      }

      // uint
      case 'rgba8uint':
      case 'rgba16uint':
      case 'r32uint':
      case 'rg32uint':
      case 'rgba32uint': {
        texelFormat = 'u32';
        break;
      }

      // sint
      case 'rgba8sint':
      case 'rgba16sint':
      case 'r32sint':
      case 'rg32sint':
      case 'rgba32sint': {
        texelFormat = 'i32';
        break;
      }
      default:
        unreachable();
    }

    suffix = `${textureType}<${texelFormat}`;

    if (binding.storageTexture.access === 'write-only') {
      suffix += ', write>';
    } else {
      suffix += '>';
    }

    declare = `var storeTex: ${suffix}`;
  } else if (binding.texture !== undefined) {
    let textureType: string;
    let texelFormat: string = '';

    const isMultisampled =
      binding.texture.multisampled !== undefined && binding.texture.multisampled;
    assert(
      isMultisampled &&
        (binding.texture.viewDimension === undefined || binding.texture.viewDimension === '2d')
    );
    let isDepth: boolean = false;

    if (binding.texture.sampleType === undefined) {
      texelFormat = 'f32';
    } else {
      switch (binding.texture.sampleType) {
        case 'float':
        case 'unfilterable-float': {
          assert(!isMultisampled);
          texelFormat = '<f32>';
          break;
        }
        case 'sint': {
          texelFormat = '<i32>';
          break;
        }
        case 'uint': {
          texelFormat = '<u32>';
          break;
        }
        case 'depth': {
          isDepth = true;
          break;
        }
        default:
          unreachable();
      }
    }

    if (binding.texture.viewDimension === undefined) {
      if (isDepth && isMultisampled) {
        textureType = 'texture_depth_multisampled_2d';
      } else if (isMultisampled) {
        textureType = 'texture_multisampled_2d';
      } else if (isDepth) {
        textureType = 'texture_depth_2d';
      } else {
        textureType = 'texture_2d';
      }
    } else {
      switch (binding.texture.viewDimension) {
        case '2d': {
          textureType = isDepth ? 'texture_depth_2d' : 'texture_2d';
          break;
        }
        // TODO: it seems that cts defines the viewDimenstion type to
        // '2d' only. Not sure whether we shoud change it now.
        default:
          unreachable();
      }
    }

    const suffix = textureType + texelFormat;
    declare = `var tex : ${suffix}`;
  } else {
    unreachable();
  }

  const result = `[[group(${group}), binding(${binding.binding})]] ${declare};`;
  return result;
}

function generateShaderCode(
  device: GPUDevice,
  bindGroups: Array<Array<GPUBindGroupLayoutEntry>>
): { layout: GPUPipelineLayout; vertex: string; fragment: string; compute: string } {
  const header = `
    [[block]] struct Buf {
      data : vec4<f32> ;
    };
  `;

  const vertexBody = `
  [[stage(vertex)]] fn main([[location(0)]] pos : vec4<f32>) -> [[builtin(position)]] vec4<f32> {
    return pos;
  }
  `;

  const fragmentBody = `
  [[stage(fragment)]] fn main() -> [[location(0)]] vec4<f32> {
    return vec4<f32>(0.0, 1.0, 0.0, 1.0);
  }
  `;

  const computeBody = `
  [[stage(compute), workgroup_size(1, 1, 1)]]
  fn main([[builtin(global_invocation_id)]] GlobalInvocationID : vec3<u32>) {
  }
  `;

  let vertexSource: string = header;
  let fragmentSource: string = header;
  let computeSource: string = header;
  const bindGroupLayouts = [];

  for (let i = 0; i < bindGroups.length; ++i) {
    // Support empty bindGroupLayout
    const entries = [];
    for (let j = 0; j < bindGroups[i].length; ++j) {
      const binding = bindGroups[i][j];
      assert(binding !== undefined);
      entries.push(bindGroups[i][j]);
      const declare = generateBindingDeclare(i, binding);
      switch (binding.visibility) {
        case GPUShaderStage.VERTEX: {
          vertexSource += declare;
          break;
        }
        case GPUShaderStage.FRAGMENT: {
          fragmentSource += declare;
          break;
        }
        case GPUShaderStage.COMPUTE: {
          computeSource += declare;
          break;
        }
        default:
          unreachable();
      }
    }
    bindGroupLayouts.push(device.createBindGroupLayout({ entries }));
  }

  vertexSource += vertexBody;
  fragmentSource += fragmentBody;
  computeSource += computeBody;
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts });

  return {
    layout: pipelineLayout,
    vertex: vertexSource,
    fragment: fragmentSource,
    compute: computeSource,
  };
}

class F extends ValidationTest {
  getUniformBuffer(): GPUBuffer {
    return this.device.createBuffer({
      size: 8 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM,
    });
  }

  createRenderPipelineWithLayout(
    device: GPUDevice,
    bindGroups: Array<Array<GPUBindGroupLayoutEntry>>
  ): GPURenderPipeline {
    const { layout, vertex, fragment } = generateShaderCode(device, bindGroups);

    const pipeline = this.device.createRenderPipeline({
      layout,
      vertex: {
        module: this.device.createShaderModule({
          code: vertex,
        }),
        entryPoint: 'main',
        buffers: [
          {
            arrayStride: 0,
            attributes: [
              {
                // position
                shaderLocation: 0,
                offset: 0,
                format: 'float32x4',
              },
            ],
          },
        ],
      },
      fragment: {
        module: this.device.createShaderModule({
          code: fragment,
        }),
        entryPoint: 'main',
        targets: [{ format: 'rgba8unorm' }],
      },
      primitive: { topology: 'triangle-list' },
    });
    return pipeline;
  }

  createComputePipeline(
    device: GPUDevice,
    bindGroups: Array<Array<GPUBindGroupLayoutEntry>>
  ): GPUComputePipeline {
    const result = generateShaderCode(device, bindGroups);

    const pipeline = this.device.createComputePipeline({
      layout: result.layout,
      compute: {
        module: this.device.createShaderModule({
          code: result.compute,
        }),
        entryPoint: 'main',
      },
    });
    return pipeline;
  }

  createRenderPipeline(device: GPUDevice): GPURenderPipeline {
    return this.createRenderPipelineWithLayout(device, [
      // Group 0
      [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
      ],

      // Group 1
      [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {},
        },
      ],
    ]);
  }

  beginRenderPass(commandEncoder: GPUCommandEncoder): GPURenderPassEncoder {
    const attachmentTexture = this.device.createTexture({
      format: 'rgba8unorm',
      size: { width: 16, height: 16, depthOrArrayLayers: 1 },
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    return commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: attachmentTexture.createView(),
          loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
          storeOp: 'store',
        },
      ],
    });
  }
}

export const g = makeTestGroup(F);

g.test('it_is_invalid_to_draw_in_a_render_pass_with_missing_bind_groups')
  .paramsSubcasesOnly([
    { setBindGroup1: true, setBindGroup2: true, _success: true },
    { setBindGroup1: true, setBindGroup2: false, _success: false },
    { setBindGroup1: false, setBindGroup2: true, _success: false },
    { setBindGroup1: false, setBindGroup2: false, _success: false },
  ])
  .fn(async t => {
    const { setBindGroup1, setBindGroup2, _success } = t.params;

    const pipeline = t.createRenderPipeline(t.device);

    const uniformBuffer = t.getUniformBuffer();

    const bindGroup0 = t.device.createBindGroup({
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
          },
        },
      ],
      layout: t.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: {}, // default type: uniform
          },
        ],
      }),
    });

    const bindGroup1 = t.device.createBindGroup({
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
          },
        },
      ],
      layout: t.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: {}, // default type uniform
          },
        ],
      }),
    });

    const vertices = new Float32Array([
      -1.0,
      -1.0,
      0.0,
      1.0,
      1.0,
      -1.0,
      0.0,
      1.0,
      -1.0,
      1.0,
      0.0,
      1.0,
    ]);
    const verticesBuffer = t.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(verticesBuffer.getMappedRange()).set(vertices);
    verticesBuffer.unmap();

    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    renderPass.setPipeline(pipeline);
    if (setBindGroup1) {
      renderPass.setBindGroup(0, bindGroup0);
    }
    if (setBindGroup2) {
      renderPass.setBindGroup(1, bindGroup1);
    }
    renderPass.setVertexBuffer(0, verticesBuffer);
    renderPass.draw(3);
    renderPass.endPass();
    t.expectValidationError(() => {
      commandEncoder.finish();
    }, !_success);
  });
