import { assert } from '../../../../../common/util/util.js';
import { GPUTest } from '../../../../gpu_test.js';

const kSize = 4;

interface BindGroupIndices {
  a: number;
  b: number;
  out: number;
}

export class ProgrammableStateTest extends GPUTest {
  private commonBindGroupLayout: GPUBindGroupLayout | undefined;

  protected async init(): Promise<void> {
    await super.init();

    
  }

  get bindGroupLayout(): GPUBindGroupLayout {
    if (!this.commonBindGroupLayout) {
      this.commonBindGroupLayout = this.device.createBindGroupLayout({
        entries: [{
          binding: 0,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
          buffer: { type: 'storage' }
        }]
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

  createBindGroup(
    buffer: GPUBuffer
  ): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer } }],
    });
  }

  // Create a compute pipeline that performs an operation on data from two bind groups,
  // then writes the result to a third bind group.
  createBindingStateComputePipeline(groups : BindGroupIndices): GPUComputePipeline {
    var wgsl = `[[block]] struct Data {
        value : i32;
      };

      [[group(${groups.a}), binding(0)]] var<storage> a : Data;
      [[group(${groups.b}), binding(0)]] var<storage> b : Data;
      [[group(${groups.out}), binding(0)]] var<storage, read_write> out : Data;

      [[stage(compute), workgroup_size(1)]] fn main() {
        out.value = a.value - b.value;
        return;
      }
    `;

    return this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [
          this.bindGroupLayout,
          this.bindGroupLayout,
          this.bindGroupLayout
        ]
      }),
      compute: {
        module: this.device.createShaderModule({
          code: wgsl,
        }),
        entryPoint: 'main',
      },
    });
  }

  verifyData(buffer: GPUBuffer, expectedValue: number) {
    const bufferData = new Int32Array(1);
    bufferData[0] = expectedValue;
    this.expectGPUBufferValuesEqual(buffer, bufferData);
  }
}