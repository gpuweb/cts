export const description = `
TODO:
- interface matching between pipeline layout and shader
    - x= bind group index values, binding index values, multiple bindings
    - x= {superset, subset}
`;

import { makeTestGroup } from '../../../common/framework/test_group.js';
import {
  kShaderStageCombinations,
  kShaderStages,
  ValidBindableResource,
} from '../../capability_info.js';
import { GPUConst } from '../../constants.js';

import { ValidationTest } from './validation_test.js';

type BindableResourceType = ValidBindableResource | 'readonlyStorageBuf';
const kBindableResources = [
  'uniformBuf',
  'storageBuf',
  'readonlyStorageBuf',
  'filtSamp',
  'nonFiltSamp',
  'compareSamp',
  'sampledTex',
  'sampledTexMS',
  'readonlyStorageTex',
  'writeonlyStorageTex',
  'readwriteStorageTex',
] as const;

class F extends ValidationTest {
  createPipelineLayout(
    bindingInPipelineLayout: BindableResourceType,
    visibility: number
  ): GPUPipelineLayout {
    let bindGroupLayoutEntry: GPUBindGroupLayoutEntry;
    switch (bindingInPipelineLayout) {
      case 'compareSamp': {
        bindGroupLayoutEntry = {
          binding: 0,
          visibility,
          sampler: {
            type: 'comparison',
          },
        };
        break;
      }
      case 'filtSamp': {
        bindGroupLayoutEntry = {
          binding: 0,
          visibility,
          sampler: {
            type: 'filtering',
          },
        };
        break;
      }
      case 'nonFiltSamp': {
        bindGroupLayoutEntry = {
          binding: 0,
          visibility,
          sampler: {
            type: 'non-filtering',
          },
        };
        break;
      }
      case 'sampledTex': {
        bindGroupLayoutEntry = {
          binding: 0,
          visibility,
          texture: {
            sampleType: 'unfilterable-float',
          },
        };
        break;
      }
      case 'sampledTexMS': {
        bindGroupLayoutEntry = {
          binding: 0,
          visibility,
          texture: {
            sampleType: 'unfilterable-float',
            multisampled: true,
          },
        };
        break;
      }
      case 'storageBuf': {
        bindGroupLayoutEntry = {
          binding: 0,
          visibility,
          buffer: {
            type: 'storage',
          },
        };
        break;
      }
      case 'readonlyStorageBuf': {
        bindGroupLayoutEntry = {
          binding: 0,
          visibility,
          buffer: {
            type: 'read-only-storage',
          },
        };
        break;
      }
      case 'uniformBuf': {
        bindGroupLayoutEntry = {
          binding: 0,
          visibility,
          buffer: {
            type: 'uniform',
          },
        };
        break;
      }
      case 'readonlyStorageTex': {
        bindGroupLayoutEntry = {
          binding: 0,
          visibility,
          storageTexture: {
            format: 'r32float',
            access: 'read-only',
          },
        };
        break;
      }
      case 'writeonlyStorageTex': {
        bindGroupLayoutEntry = {
          binding: 0,
          visibility,
          storageTexture: {
            format: 'r32float',
            access: 'write-only',
          },
        };
        break;
      }
      case 'readwriteStorageTex': {
        bindGroupLayoutEntry = {
          binding: 0,
          visibility,
          storageTexture: {
            format: 'r32float',
            access: 'read-write',
          },
        };
        break;
      }
    }
    return this.device.createPipelineLayout({
      bindGroupLayouts: [
        this.device.createBindGroupLayout({
          entries: [bindGroupLayoutEntry],
        }),
      ],
    });
  }

  GetBindableResourceShaderDeclaration(bindableResource: BindableResourceType): string {
    switch (bindableResource) {
      case 'compareSamp':
        return 'var tmp : sampler_comparison';
      case 'filtSamp':
      case 'nonFiltSamp':
        return 'var tmp : sampler';
      case 'sampledTex':
        return 'var tmp : texture_2d<f32>';
      case 'sampledTexMS':
        return 'var tmp : texture_multisampled_2d<f32>';
      case 'storageBuf':
        return 'var<storage, read_write> tmp : vec4u';
      case 'readonlyStorageBuf':
        return 'var<storage, read> tmp : vec4u';
      case 'uniformBuf':
        return 'var<uniform> tmp : vec4u;';
      case 'readonlyStorageTex':
        return 'var tmp : texture_storage_2d<r32float, read>';
      case 'writeonlyStorageTex':
        return 'var tmp : texture_storage_2d<r32float, write>';
      case 'readwriteStorageTex':
        return 'var tmp : texture_storage_2d<r32float, read_write>';
    }
  }
}

export const g = makeTestGroup(F);

g.test('pipeline_layout_shader_exact_match')
  .desc(
    `
  Test that the binding type in the pipeline layout must match the related declaration in shader.
  Note that read-write storage textures in the pipeline layout can match write-only storage textures
  in the shader.
  `
  )
  .params(u =>
    u
      .combine('bindingInPipelineLayout', kBindableResources)
      .combine('bindingInShader', kBindableResources)
      .beginSubcases()
      .combine('pipelineLayoutVisibility', kShaderStageCombinations)
      .combine('shaderStageWithBinding', kShaderStages)
      .combine('isBindingStaticallyUsed', [true, false] as const)
      .unless(
        p =>
          // We don't test using non-filtering sampler in shader because it has the same declaration
          // as filtering sampler.
          p.bindingInShader === 'nonFiltSamp' ||
          ((p.bindingInPipelineLayout === 'writeonlyStorageTex' ||
            p.bindingInPipelineLayout === 'readwriteStorageTex' ||
            p.bindingInPipelineLayout === 'storageBuf') &&
            (p.pipelineLayoutVisibility & GPUConst.ShaderStage.VERTEX) > 0) ||
          ((p.bindingInShader === 'writeonlyStorageTex' ||
            p.bindingInShader === 'readwriteStorageTex' ||
            p.bindingInPipelineLayout === 'storageBuf') &&
            p.shaderStageWithBinding === GPUConst.ShaderStage.VERTEX)
      )
  )
  .fn(t => {
    const {
      bindingInPipelineLayout,
      bindingInShader,
      pipelineLayoutVisibility,
      shaderStageWithBinding,
      isBindingStaticallyUsed,
    } = t.params;

    const layout = t.createPipelineLayout(bindingInPipelineLayout, pipelineLayoutVisibility);
    const bindResourceDeclaration = `@group(0) @binding(0) ${t.GetBindableResourceShaderDeclaration(
      bindingInShader
    )}`;
    const staticallyUseBinding = isBindingStaticallyUsed ? '_ = tmp; ' : '';
    const isAsync = false;
    const success =
      !isBindingStaticallyUsed ||
      ((pipelineLayoutVisibility & shaderStageWithBinding) > 0 &&
        (bindingInPipelineLayout === bindingInShader ||
          (bindingInPipelineLayout === 'nonFiltSamp' && bindingInShader === 'filtSamp') ||
          (bindingInPipelineLayout === 'readwriteStorageTex' &&
            bindingInShader === 'writeonlyStorageTex')));
    switch (shaderStageWithBinding) {
      case GPUConst.ShaderStage.COMPUTE: {
        const computeShader = `
        ${bindResourceDeclaration};
        @compute @workgroup_size(1)
        fn main() {
          ${staticallyUseBinding}
        }
        `;
        t.doCreateComputePipelineTest(isAsync, success, {
          layout,
          compute: {
            module: t.device.createShaderModule({
              code: computeShader,
            }),
          },
        });
        break;
      }
      case GPUConst.ShaderStage.VERTEX: {
        const vertexShader = `
        ${bindResourceDeclaration};
        @vertex
        fn main() -> @builtin(position) vec4f {
          ${staticallyUseBinding}
          return vec4f();
        }
        `;
        t.doCreateRenderPipelineTest(isAsync, success, {
          layout,
          vertex: {
            module: t.device.createShaderModule({
              code: vertexShader,
            }),
          },
        });
        break;
      }
      case GPUConst.ShaderStage.FRAGMENT: {
        const fragmentShader = `
        ${bindResourceDeclaration};
        @fragment
        fn main() -> @location(0) vec4f {
          ${staticallyUseBinding}
          return vec4f();
        }
        `;
        t.doCreateRenderPipelineTest(isAsync, success, {
          layout,
          vertex: {
            module: t.device.createShaderModule({
              code: `
                @vertex
                fn main() -> @builtin(position) vec4f {
                  return vec4f();
                }`,
            }),
          },
          fragment: {
            module: t.device.createShaderModule({
              code: fragmentShader,
            }),
            targets: [
              {
                format: 'rgba8unorm',
              },
            ],
          },
        });
        break;
      }
    }
  });
