import { unreachable } from '../../../common/framework/util/util.js';
import { BindableResource } from '../../capability_info.js';
import { GPUTest } from '../../gpu_test.js';

type Encoder = GPUCommandEncoder | GPUProgrammablePassEncoder | GPURenderBundleEncoder;
export const kEncoderTypes = ['non-pass', 'compute pass', 'render pass', 'render bundle'] as const;
type EncoderType = typeof kEncoderTypes[number];

interface FinishableEncoder {
  finishEncoder(): GPUCommandBuffer;
}

export class ValidationTest extends GPUTest {
  getStorageBuffer(): GPUBuffer {
    return this.device.createBuffer({ size: 1024, usage: GPUBufferUsage.STORAGE });
  }

  getUniformBuffer(): GPUBuffer {
    return this.device.createBuffer({ size: 1024, usage: GPUBufferUsage.UNIFORM });
  }

  getErrorBuffer(): GPUBuffer {
    this.device.pushErrorScope('validation');
    const errorBuffer = this.device.createBuffer({
      size: 1024,
      usage: 0xffff, // Invalid GPUBufferUsage
    });
    this.device.popErrorScope();
    return errorBuffer;
  }

  getSampler(): GPUSampler {
    return this.device.createSampler();
  }

  getComparisonSampler(): GPUSampler {
    return this.device.createSampler({ compare: 'never' });
  }

  getErrorSampler(): GPUSampler {
    this.device.pushErrorScope('validation');
    const sampler = this.device.createSampler({ lodMinClamp: -1 });
    this.device.popErrorScope();
    return sampler;
  }

  getSampledTexture(): GPUTexture {
    return this.device.createTexture({
      size: { width: 16, height: 16, depth: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.SAMPLED,
    });
  }

  getStorageTexture(): GPUTexture {
    return this.device.createTexture({
      size: { width: 16, height: 16, depth: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE,
    });
  }

  getErrorTexture(): GPUTexture {
    this.device.pushErrorScope('validation');
    const texture = this.device.createTexture({
      size: { width: 0, height: 0, depth: 0 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.SAMPLED,
    });
    this.device.popErrorScope();
    return texture;
  }

  getErrorTextureView(): GPUTextureView {
    this.device.pushErrorScope('validation');
    const view = this.getErrorTexture().createView();
    this.device.popErrorScope();
    return view;
  }

  getBindingResource(bindingType: BindableResource): GPUBindingResource {
    switch (bindingType) {
      case 'errorBuf':
        return { buffer: this.getErrorBuffer() };
      case 'errorSamp':
        return this.getErrorSampler();
      case 'errorTex':
        return this.getErrorTextureView();
      case 'uniformBuf':
        return { buffer: this.getUniformBuffer() };
      case 'storageBuf':
        return { buffer: this.getStorageBuffer() };
      case 'plainSamp':
        return this.getSampler();
      case 'compareSamp':
        return this.getComparisonSampler();
      case 'sampledTex':
        return this.getSampledTexture().createView();
      case 'storageTex':
        return this.getStorageTexture().createView();
      default:
        unreachable('unknown binding resource type');
    }
  }

  createNoOpRenderPipeline(): GPURenderPipeline {
    const wgslVertex = `
      fn main() -> void {
        return;
      }

      entry_point vertex = main;
    `;
    const wgslFragment = `
      fn main() -> void {
        return;
      }

      entry_point fragment = main;
    `;

    return this.device.createRenderPipeline({
      vertexStage: {
        module: this.device.createShaderModule({
          code: wgslVertex,
        }),
        entryPoint: 'main',
      },
      fragmentStage: {
        module: this.device.createShaderModule({
          code: wgslFragment,
        }),
        entryPoint: 'main',
      },
      primitiveTopology: 'triangle-list',
      colorStates: [{ format: 'rgba8unorm' }],
    });
  }

  createNoOpComputePipeline(): GPUComputePipeline {
    const wgslCompute = `
      fn main() -> void {
        return;
      }

      entry_point compute = main;
    `;

    return this.device.createComputePipeline({
      computeStage: {
        module: this.device.createShaderModule({
          code: wgslCompute,
        }),
        entryPoint: 'main',
      },
    });
  }

  createEncoder(encoderType: 'non-pass'): GPUCommandEncoder & FinishableEncoder;
  createEncoder(encoderType: 'render pass'): GPURenderPassEncoder & FinishableEncoder;
  createEncoder(encoderType: 'compute pass'): GPUComputePassEncoder & FinishableEncoder;
  createEncoder(encoderType: 'render bundle'): GPURenderBundleEncoder & FinishableEncoder;
  createEncoder(
    encoderType: 'render pass' | 'render bundle'
  ): (GPURenderPassEncoder | GPURenderBundleEncoder) & FinishableEncoder;
  createEncoder(
    encoderType: 'compute pass' | 'render pass' | 'render bundle'
  ): GPUProgrammablePassEncoder & FinishableEncoder;
  createEncoder(encoderType: EncoderType): Encoder & FinishableEncoder;
  createEncoder(encoderType: EncoderType): Encoder & FinishableEncoder {
    const colorFormat = 'rgba8unorm';
    switch (encoderType) {
      case 'non-pass': {
        const encoder = (this.device.createCommandEncoder() as unknown) as GPUCommandEncoder &
          FinishableEncoder;
        encoder.finishEncoder = () => {
          return encoder.finish();
        };
        return encoder;
      }
      case 'render bundle': {
        const device = this.device;
        const encoder = (device.createRenderBundleEncoder({
          colorFormats: [colorFormat],
        }) as unknown) as GPURenderBundleEncoder & FinishableEncoder;
        const pass = this.createEncoder('render pass');
        encoder.finishEncoder = () => {
          const bundle = encoder.finish();
          pass.executeBundles([bundle]);
          return pass.finishEncoder();
        };
        return encoder;
      }
      case 'compute pass': {
        const commandEncoder = this.device.createCommandEncoder();
        const encoder = (commandEncoder.beginComputePass({}) as unknown) as GPUComputePassEncoder &
          FinishableEncoder;
        encoder.finishEncoder = () => {
          encoder.endPass();
          return commandEncoder.finish();
        };
        return encoder;
      }
      case 'render pass': {
        const commandEncoder = this.device.createCommandEncoder();
        const attachment = this.device
          .createTexture({
            format: colorFormat,
            size: { width: 16, height: 16, depth: 1 },
            usage: GPUTextureUsage.OUTPUT_ATTACHMENT,
          })
          .createView();
        const encoder = (commandEncoder.beginRenderPass({
          colorAttachments: [
            {
              attachment,
              loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
            },
          ],
        }) as unknown) as GPURenderPassEncoder & FinishableEncoder;
        encoder.finishEncoder = () => {
          encoder.endPass();
          return commandEncoder.finish();
        };
        return encoder;
      }
    }
  }

  expectValidationError(fn: Function, shouldError: boolean = true): void {
    // If no error is expected, we let the scope surrounding the test catch it.
    if (shouldError === false) {
      fn();
      return;
    }

    this.device.pushErrorScope('validation');
    fn();
    const promise = this.device.popErrorScope();

    this.eventualAsyncExpectation(async niceStack => {
      const gpuValidationError = await promise;
      if (!gpuValidationError) {
        niceStack.message = 'Validation error was expected.';
        this.rec.validationFailed(niceStack);
      } else if (gpuValidationError instanceof GPUValidationError) {
        niceStack.message = `Captured validation error - ${gpuValidationError.message}`;
        this.rec.debug(niceStack);
      }
    });
  }
}
