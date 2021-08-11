import { assert, unreachable } from '../../../common/util/util.js';

import { generateBufferBindingDeclare } from './buffer_binding_declare_helper.js';
import { generateExternalTextureBindingDeclare } from './external_binding_declare_helper.js';
import { generateSamplerBindingDeclare } from './sampler_binding_declare_helper.js';

export function generateWgslBindingDeclare(group: number, binding: GPUBindGroupLayoutEntry) {
  let declare: string;
  if (binding.buffer !== undefined) {
    declare = generateBufferBindingDeclare(binding.buffer);
  } else if (binding.externalTexture !== undefined) {
    declare = generateExternalTextureBindingDeclare();
  } else if (binding.sampler !== undefined) {
    declare = generateSamplerBindingDeclare(binding.sampler);
  } else {
    // TODO: add support for storage texture and texture.
    unreachable();
  }

  const result = `[[group(${group}), binding(${binding.binding})]] ${declare};`;
  return result;
}

export function generateWgslBindingDeclaresAndBindGroupLayouts(
  device: GPUDevice,
  bindGroups: Array<Array<GPUBindGroupLayoutEntry>>
): {
  bindGroupLayouts: Array<GPUBindGroupLayout>;
  vertex: string;
  fragment: string;
  compute: string;
} {
  const bindGroupLayouts = [];
  let vertex: string = '';
  let fragment: string = '';
  let compute: string = '';
  for (let i = 0; i < bindGroups.length; ++i) {
    // Support empty bindGroupLayout
    const entries = [];
    for (let j = 0; j < bindGroups[i].length; ++j) {
      const binding = bindGroups[i][j];
      assert(binding !== undefined);
      entries.push(bindGroups[i][j]);
      const declare = generateWgslBindingDeclare(i, binding);
      if (binding.visibility & GPUShaderStage.VERTEX) {
        vertex += declare;
      }

      if (binding.visibility & GPUShaderStage.FRAGMENT) {
        fragment += declare;
      }

      if (binding.visibility & GPUShaderStage.COMPUTE) {
        compute += declare;
      }
    }
    bindGroupLayouts.push(device.createBindGroupLayout({ entries }));
  }

  return { bindGroupLayouts, vertex, fragment, compute };
}
