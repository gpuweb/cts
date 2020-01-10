export const textureFormatInfo: {
  [k in GPUTextureFormat]: {
    renderable: boolean;
    color: boolean;
    // Add fields as needed
  };
} = /* prettier-ignore */ {
  // Try to keep these manually-formatted in a readable grid.
  // (Note: this list should always match the one in the spec.)

  // 8-bit formats
  'r8unorm':                { renderable:  true, color: true  },
  'r8snorm':                { renderable: false, color: true  },
  'r8uint':                 { renderable:  true, color: true  },
  'r8sint':                 { renderable:  true, color: true  },
  // 16-bit formats
  'r16uint':                { renderable:  true, color: true  },
  'r16sint':                { renderable:  true, color: true  },
  'r16float':               { renderable:  true, color: true  },
  'rg8unorm':               { renderable:  true, color: true  },
  'rg8snorm':               { renderable: false, color: true  },
  'rg8uint':                { renderable:  true, color: true  },
  'rg8sint':                { renderable:  true, color: true  },
  // 32-bit formats
  'r32uint':                { renderable:  true, color: true  },
  'r32sint':                { renderable:  true, color: true  },
  'r32float':               { renderable:  true, color: true  },
  'rg16uint':               { renderable:  true, color: true  },
  'rg16sint':               { renderable:  true, color: true  },
  'rg16float':              { renderable:  true, color: true  },
  'rgba8unorm':             { renderable:  true, color: true  },
  'rgba8unorm-srgb':        { renderable:  true, color: true  },
  'rgba8snorm':             { renderable: false, color: true  },
  'rgba8uint':              { renderable:  true, color: true  },
  'rgba8sint':              { renderable:  true, color: true  },
  'bgra8unorm':             { renderable:  true, color: true  },
  'bgra8unorm-srgb':        { renderable:  true, color: true  },
  // Packed 32-bit formats
  'rgb10a2unorm':           { renderable:  true, color: true  },
  'rg11b10float':           { renderable: false, color: true  },
  // 64-bit formats
  'rg32uint':               { renderable:  true, color: true  },
  'rg32sint':               { renderable:  true, color: true  },
  'rg32float':              { renderable:  true, color: true  },
  'rgba16uint':             { renderable:  true, color: true  },
  'rgba16sint':             { renderable:  true, color: true  },
  'rgba16float':            { renderable:  true, color: true  },
  // 128-bit formats
  'rgba32uint':             { renderable:  true, color: true  },
  'rgba32sint':             { renderable:  true, color: true  },
  'rgba32float':            { renderable:  true, color: true  },
  // Depth/stencil formats
  'depth32float':           { renderable:  true, color: false },
  'depth24plus':            { renderable:  true, color: false },
  'depth24plus-stencil8':   { renderable:  true, color: false },
};
export const textureFormats = Object.keys(textureFormatInfo) as GPUTextureFormat[];

export const bindingTypeInfo: {
  [k in GPUBindingType]: {
    type: 'buffer' | 'texture' | 'sampler';
    maxDynamicCount: number;
    // Add fields as needed
  };
} = /* prettier-ignore */ {
  'uniform-buffer':          { type: 'buffer',  maxDynamicCount: 8 },
  'storage-buffer':          { type: 'buffer',  maxDynamicCount: 4 },
  'readonly-storage-buffer': { type: 'buffer',  maxDynamicCount: 4 },
  'sampler':                 { type: 'sampler', maxDynamicCount: 0 },
  'sampled-texture':         { type: 'texture', maxDynamicCount: 0 },
  'storage-texture':         { type: 'texture', maxDynamicCount: 0 },
};
export const bindingTypes = Object.keys(bindingTypeInfo) as GPUBindingType[];

export const shaderStages: GPUShaderStageFlags[] = [1, 2, 4];
export const shaderStageCombinations: GPUShaderStageFlags[] = [0, 1, 2, 3, 4, 5, 6, 7];
