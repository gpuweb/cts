import { assert } from '../../../../../common/util/util.js';
import { GPUTest } from '../../../../gpu_test.js';

const kSize = 4;

interface BindGroupIndices {
  a: number;
  b: number;
  out: number;
}

export enum PassType {
  Compute = 'compute',
  Render = 'render',
  RenderBundle = 'renderBundle',
}

export class ProgrammableStateTest extends GPUTest {
  private commonBindGroupLayout: GPUBindGroupLayout | undefined;
  private encoder: GPUCommandEncoder | null = null;

  get bindGroupLayout(): GPUBindGroupLayout {
    if (!this.commonBindGroupLayout) {
      this.commonBindGroupLayout = this.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
            buffer: { type: 'storage' },
          },
        ],
      });
    }
    return this.commonBindGroupLayout;
  }

  createBufferWithValue(initValue: number): GPUBuffer {
    const buffer = this.device.createBuffer({
      mappedAtCreation: true,
      size: kSize,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE,
    });
    new Uint32Array(buffer.getMappedRange()).fill(initValue);
    buffer.unmap();
    return buffer;
  }

  createBindGroup(buffer: GPUBuffer): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer } }],
    });
  }

  // Create a compute pipeline that performs an operation on data from two bind groups,
  // then writes the result to a third bind group.
  createBindingStatePipeline(
    passType: PassType,
    groups: BindGroupIndices,
    algorthim: String = 'a.value - b.value'
  ): GPUComputePipeline | GPURenderPipeline {
    switch (passType) {
      case PassType.Compute:
        return this.createBindingStateComputePipeline(groups, algorthim);
      case PassType.Render:
      case PassType.RenderBundle:
        return this.createBindingStateRenderPipeline(groups, algorthim);
    }
  }

  createBindingStateComputePipeline(
    groups: BindGroupIndices,
    algorthim: String = 'a.value - b.value'
  ): GPUComputePipeline {
    const wgsl = `[[block]] struct Data {
        value : i32;
      };

      [[group(${groups.a}), binding(0)]] var<storage> a : Data;
      [[group(${groups.b}), binding(0)]] var<storage> b : Data;
      [[group(${groups.out}), binding(0)]] var<storage, read_write> out : Data;

      [[stage(compute), workgroup_size(1)]] fn main() {
        out.value = ${algorthim};
        return;
      }
    `;

    return this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout, this.bindGroupLayout, this.bindGroupLayout],
      }),
      compute: {
        module: this.device.createShaderModule({
          code: wgsl,
        }),
        entryPoint: 'main',
      },
    });
  }

  createBindingStateRenderPipeline(
    groups: BindGroupIndices,
    algorthim: String = 'a.value - b.value'
  ): GPURenderPipeline {
    const wgslShaders = {
      vertex: `
        [[stage(vertex)]] fn vert_main() -> [[builtin(position)]] vec4<f32> {
          return vec4<f32>(0.5, 0.5, 0.0, 1.0);
        }
      `,

      fragment: `
        [[block]] struct Data {
          value : i32;
        };

        [[group(${groups.a}), binding(0)]] var<storage> a : Data;
        [[group(${groups.b}), binding(0)]] var<storage> b : Data;
        [[group(${groups.out}), binding(0)]] var<storage, read_write> out : Data;

        [[stage(fragment)]] fn frag_main() -> [[location(0)]] vec4<f32> {
          out.value = ${algorthim};
          return vec4<f32>(1.0, 0.0, 0.0, 1.0);
        }
      `,
    };

    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout, this.bindGroupLayout, this.bindGroupLayout],
      }),
      vertex: {
        module: this.device.createShaderModule({
          code: wgslShaders.vertex,
        }),
        entryPoint: 'vert_main',
      },
      fragment: {
        module: this.device.createShaderModule({
          code: wgslShaders.fragment,
        }),
        entryPoint: 'frag_main',
        targets: [{ format: 'rgba8unorm' }],
      },
      primitive: { topology: 'point-list' },
    });
  }

  beginSimplePass(passType: PassType): GPUProgrammablePassEncoder {
    assert(this.encoder === null);
    this.encoder = this.device.createCommandEncoder();
    switch (passType) {
      case PassType.Compute:
        return this.encoder.beginComputePass();
      case PassType.Render:
        return this.beginSimpleRenderPass(this.encoder);
      case PassType.RenderBundle:
        return this.device.createRenderBundleEncoder({ colorFormats: ['rgba8unorm'] });
    }
  }

  beginSimpleRenderPass(encoder: GPUCommandEncoder): GPURenderPassEncoder {
    const view = this.device
      .createTexture({
        size: { width: 1, height: 1, depthOrArrayLayers: 1 },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      })
      .createView();
    return encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          loadValue: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
          storeOp: 'store',
        },
      ],
    });
  }

  setPipeline(pass: GPUProgrammablePassEncoder, pipeline: GPUComputePipeline | GPURenderPipeline) {
    if (pass instanceof GPUComputePassEncoder) {
      pass.setPipeline(pipeline as GPUComputePipeline);
    } else if (pass instanceof GPURenderPassEncoder || pass instanceof GPURenderBundleEncoder) {
      pass.setPipeline(pipeline as GPURenderPipeline);
    }
  }

  dispatchOrDraw(pass: GPUProgrammablePassEncoder) {
    if (pass instanceof GPUComputePassEncoder) {
      pass.dispatch(1);
    } else if (pass instanceof GPURenderPassEncoder) {
      pass.draw(1);
    } else if (pass instanceof GPURenderBundleEncoder) {
      pass.draw(1);
    }
  }

  endAndSubmitSimplePass(pass: GPUProgrammablePassEncoder) {
    assert(this.encoder !== null);

    if (pass instanceof GPUComputePassEncoder) {
      pass.endPass();
    } else if (pass instanceof GPURenderPassEncoder) {
      pass.endPass();
    } else if (pass instanceof GPURenderBundleEncoder) {
      const renderBundle = pass.finish();
      const renderPass = this.beginSimpleRenderPass(this.encoder);
      renderPass.executeBundles([renderBundle]);
      renderPass.endPass();
    }

    this.device.queue.submit([this.encoder.finish()]);
    this.encoder = null;
  }

  verifyData(buffer: GPUBuffer, expectedValue: number) {
    const bufferData = new Int32Array(1);
    bufferData[0] = expectedValue;
    this.expectGPUBufferValuesEqual(buffer, bufferData);
  }
}
