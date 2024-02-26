interface Resource {
  buffer?: GPUBufferBindingLayout;
  sampler?: GPUSamplerBindingLayout;
  texture?: GPUTextureBindingLayout;
  code: string;
  staticUse?: string;
}

export const kAPIResources: Resource[] = [
  // Buffers
  {
    buffer: { type: 'uniform' },
    code: `var<uniform> res : array<vec4u, 16>`,
    staticUse: `res[0]`,
  },
  {
    buffer: { type: 'storage' },
    code: `var<storage, read_write> res : array<vec4u>`,
    staticUse: `res[0]`,
  },
  {
    buffer: { type: 'read-only-storage' },
    code: `var<storage> res : array<vec4u>`,
    staticUse: `res[0]`,
  },

  // Samplers
  {
    sampler: { type: 'filtering' },
    code: `var res : sampler`,
  },
  {
    sampler: { type: 'non-filtering' },
    code: `var res : sampler`,
  },
  {
    sampler: { type: 'comparison' },
    code: `var res : sampler_comparison`,
  },

  // Sampled textures
  {
    texture: { sampleType: 'float', viewDimension: '1d', multisampled: false },
    code: `var res : texture_1d<f32>`,
  },
  {
    texture: { sampleType: 'float', viewDimension: '2d', multisampled: false },
    code: `var res : texture_2d<f32>`,
  },
  {
    texture: { sampleType: 'float', viewDimension: '2d-array', multisampled: false },
    code: `var res : texture_2d_array<f32>`,
  },
  {
    texture: { sampleType: 'float', viewDimension: '3d', multisampled: false },
    code: `var res : texture_3d<f32>`,
  },
  {
    texture: { sampleType: 'float', viewDimension: 'cube', multisampled: false },
    code: `var res : texture_cube<f32>`,
  },
  {
    texture: { sampleType: 'float', viewDimension: 'cube-array', multisampled: false },
    code: `var res : texture_cube_array<f32>`,
  },
  {
    texture: { sampleType: 'unfilterable-float', viewDimension: '1d', multisampled: false },
    code: `var res : texture_1d<f32>`,
  },
  {
    texture: { sampleType: 'unfilterable-float', viewDimension: '2d', multisampled: false },
    code: `var res : texture_2d<f32>`,
  },
  {
    texture: { sampleType: 'unfilterable-float', viewDimension: '2d-array', multisampled: false },
    code: `var res : texture_2d_array<f32>`,
  },
  {
    texture: { sampleType: 'unfilterable-float', viewDimension: '3d', multisampled: false },
    code: `var res : texture_3d<f32>`,
  },
  {
    texture: { sampleType: 'unfilterable-float', viewDimension: 'cube', multisampled: false },
    code: `var res : texture_cube<f32>`,
  },
  {
    texture: { sampleType: 'unfilterable-float', viewDimension: 'cube-array', multisampled: false },
    code: `var res : texture_cube_array<f32>`,
  },
  {
    texture: { sampleType: 'depth', viewDimension: '2d', multisampled: false },
    code: `var res : texture_depth_2d`,
  },
  {
    texture: { sampleType: 'depth', viewDimension: '2d', multisampled: true },
    code: `var res : texture_depth_multisampled_2d`,
  },
  {
    texture: { sampleType: 'depth', viewDimension: '2d-array', multisampled: false },
    code: `var res : texture_depth_2d_array`,
  },
  {
    texture: { sampleType: 'depth', viewDimension: 'cube', multisampled: false },
    code: `var res : texture_depth_cube`,
  },
  {
    texture: { sampleType: 'depth', viewDimension: 'cube-array', multisampled: false },
    code: `var res : texture_depth_cube_array`,
  },
  {
    texture: { sampleType: 'sint', viewDimension: '1d', multisampled: false },
    code: `var res : texture_1d<i32>`,
  },
  {
    texture: { sampleType: 'sint', viewDimension: '2d', multisampled: false },
    code: `var res : texture_2d<i32>`,
  },
  {
    texture: { sampleType: 'sint', viewDimension: '2d', multisampled: true },
    code: `var res : texture_multisampled_2d<i32>`,
  },
  {
    texture: { sampleType: 'sint', viewDimension: '2d-array', multisampled: false },
    code: `var res : texture_2d_array<i32>`,
  },
  {
    texture: { sampleType: 'sint', viewDimension: '3d', multisampled: false },
    code: `var res : texture_3d<i32>`,
  },
  {
    texture: { sampleType: 'sint', viewDimension: 'cube', multisampled: false },
    code: `var res : texture_cube<i32>`,
  },
  {
    texture: { sampleType: 'sint', viewDimension: 'cube-array', multisampled: false },
    code: `var res : texture_cube_array<i32>`,
  },
  {
    texture: { sampleType: 'uint', viewDimension: '1d', multisampled: false },
    code: `var res : texture_1d<u32>`,
  },
  {
    texture: { sampleType: 'uint', viewDimension: '2d', multisampled: false },
    code: `var res : texture_2d<u32>`,
  },
  {
    texture: { sampleType: 'uint', viewDimension: '2d', multisampled: true },
    code: `var res : texture_multisampled_2d<u32>`,
  },
  {
    texture: { sampleType: 'uint', viewDimension: '2d-array', multisampled: false },
    code: `var res : texture_2d_array<u32>`,
  },
  {
    texture: { sampleType: 'uint', viewDimension: '3d', multisampled: false },
    code: `var res : texture_3d<u32>`,
  },
  {
    texture: { sampleType: 'uint', viewDimension: 'cube', multisampled: false },
    code: `var res : texture_cube<u32>`,
  },
  {
    texture: { sampleType: 'uint', viewDimension: 'cube-array', multisampled: false },
    code: `var res : texture_cube_array<u32>`,
  },
];

export function getWGSLShaderForResource(stage: string, resource: Resource): string {
  let code = `@group(0) @binding(0) ${resource.code};\n`;

  code += `@${stage}`;
  if (stage === 'compute') {
    code += `@workgroup_size(1)`;
  }

  code += `
fn main() {
  _ = ${resource.staticUse ? resource.staticUse : 'res'};
}
`;

  return code;
}

export function getAPIBindGroupLayoutForResource(
  device: GPUDevice,
  stage: GPUShaderStageFlags,
  resource: Resource
): GPUBindGroupLayout {
  const entry: GPUBindGroupLayoutEntry = {
    binding: 0,
    visibility: stage,
  };
  if (resource.buffer) {
    entry.buffer = resource.buffer;
  }
  if (resource.sampler) {
    entry.sampler = resource.sampler;
  }
  if (resource.texture) {
    entry.texture = resource.texture;
  }

  return device.createBindGroupLayout({ entries: [entry] });
}

function doSampleTypesMatch(api: GPUTextureSampleType, wgsl: GPUTextureSampleType): boolean {
  if (api === 'float' || api === 'unfilterable-float') {
    return wgsl === 'float' || wgsl === 'unfilterable-float';
  }
  return api === wgsl;
}

export function doResourcesMatch(api: Resource, wgsl: Resource): boolean {
  if (api.buffer) {
    if (!wgsl.buffer) {
      return false;
    }
    return api.buffer.type === wgsl.buffer.type;
  }
  if (api.sampler) {
    if (!wgsl.sampler) {
      return false;
    }
    return (
      api.sampler.type === wgsl.sampler.type ||
      (api.sampler.type !== 'comparison' && wgsl.sampler.type !== 'comparison')
    );
  }
  if (api.texture) {
    if (!wgsl.texture) {
      return false;
    }
    const aType = api.texture.sampleType as GPUTextureSampleType;
    const wType = wgsl.texture.sampleType as GPUTextureSampleType;
    return (
      doSampleTypesMatch(aType, wType) &&
      api.texture.viewDimension === wgsl.texture.viewDimension &&
      api.texture.multisampled === wgsl.texture.multisampled
    );
  }

  return false;
}
