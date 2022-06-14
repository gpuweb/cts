import { kTextureFormatInfo } from '../../../capability_info.js';
import { getFragmentShaderCodeWithOutput, getPlainTypeInfo } from '../../../util/shader.js';
import { ValidationTest } from '../validation_test.js';

export const kDefaultVertexShaderCode = `
@vertex fn main() -> @builtin(position) vec4<f32> {
  return vec4<f32>(0.0, 0.0, 0.0, 1.0);
}
`;

export const kDefaultFragmentShaderCode = `
@fragment fn main() -> @location(0) vec4<f32>  {
  return vec4<f32>(1.0, 1.0, 1.0, 1.0);
}`;

const values = [0, 1, 0, 1];
export class CreateRenderPipelineValidationTest extends ValidationTest {
  getDescriptor(
    options: {
      primitive?: GPUPrimitiveState;
      targets?: GPUColorTargetState[];
      multisample?: GPUMultisampleState;
      depthStencil?: GPUDepthStencilState;
      fragmentShaderCode?: string;
      noFragment?: boolean;
    } = {}
  ): GPURenderPipelineDescriptor {
    const defaultTargets: GPUColorTargetState[] = [{ format: 'rgba8unorm' }];
    const {
      primitive = {},
      targets = defaultTargets,
      multisample = {},
      depthStencil,
      fragmentShaderCode = getFragmentShaderCodeWithOutput([
        {
          values,
          plainType: getPlainTypeInfo(
            kTextureFormatInfo[targets[0] ? targets[0].format : 'rgba8unorm'].sampleType
          ),
          componentCount: 4,
        },
      ]),
      noFragment = false,
    } = options;

    return {
      vertex: {
        module: this.device.createShaderModule({
          code: kDefaultVertexShaderCode,
        }),
        entryPoint: 'main',
      },
      fragment: noFragment
        ? undefined
        : {
            module: this.device.createShaderModule({
              code: fragmentShaderCode,
            }),
            entryPoint: 'main',
            targets,
          },
      layout: this.getPipelineLayout(),
      primitive,
      multisample,
      depthStencil,
    };
  }

  getPipelineLayout(): GPUPipelineLayout {
    return this.device.createPipelineLayout({ bindGroupLayouts: [] });
  }

  doCreateRenderPipelineTest(
    isAsync: boolean,
    _success: boolean,
    descriptor: GPURenderPipelineDescriptor
  ) {
    if (isAsync) {
      if (_success) {
        this.shouldResolve(this.device.createRenderPipelineAsync(descriptor));
      } else {
        this.shouldReject('OperationError', this.device.createRenderPipelineAsync(descriptor));
      }
    } else {
      this.expectValidationError(() => {
        this.device.createRenderPipeline(descriptor);
      }, !_success);
    }
  }
}
