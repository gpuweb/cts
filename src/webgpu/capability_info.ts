import * as C from '../common/constants.js';

// Textures

export const kTextureFormatInfo: {
  [k in GPUTextureFormat]: {
    renderable: boolean;
    color: boolean;
    depth: boolean;
    stencil: boolean;
    storage: boolean;
    copyable: boolean;
    bytesPerBlock?: number;
    blockWidth?: number;
    blockHeight?: number;
    // Add fields as needed
  };
} = /* prettier-ignore */ {
  // Try to keep these manually-formatted in a readable grid.
  // (Note: this list should always match the one in the spec.)

  // 8-bit formats
  'r8unorm':                { renderable:  true, color:  true, depth: false, stencil: false, storage: false, copyable:  true, bytesPerBlock:  1, blockWidth: 1, blockHeight: 1 },
  'r8snorm':                { renderable: false, color:  true, depth: false, stencil: false, storage: false, copyable:  true, bytesPerBlock:  1, blockWidth: 1, blockHeight: 1 },
  'r8uint':                 { renderable:  true, color:  true, depth: false, stencil: false, storage: false, copyable:  true, bytesPerBlock:  1, blockWidth: 1, blockHeight: 1 },
  'r8sint':                 { renderable:  true, color:  true, depth: false, stencil: false, storage: false, copyable:  true, bytesPerBlock:  1, blockWidth: 1, blockHeight: 1 },
  // 16-bit formats
  'r16uint':                { renderable:  true, color:  true, depth: false, stencil: false, storage: false, copyable:  true, bytesPerBlock:  2, blockWidth: 1, blockHeight: 1 },
  'r16sint':                { renderable:  true, color:  true, depth: false, stencil: false, storage: false, copyable:  true, bytesPerBlock:  2, blockWidth: 1, blockHeight: 1 },
  'r16float':               { renderable:  true, color:  true, depth: false, stencil: false, storage: false, copyable:  true, bytesPerBlock:  2, blockWidth: 1, blockHeight: 1 },
  'rg8unorm':               { renderable:  true, color:  true, depth: false, stencil: false, storage: false, copyable:  true, bytesPerBlock:  2, blockWidth: 1, blockHeight: 1 },
  'rg8snorm':               { renderable: false, color:  true, depth: false, stencil: false, storage: false, copyable:  true, bytesPerBlock:  2, blockWidth: 1, blockHeight: 1 },
  'rg8uint':                { renderable:  true, color:  true, depth: false, stencil: false, storage: false, copyable:  true, bytesPerBlock:  2, blockWidth: 1, blockHeight: 1 },
  'rg8sint':                { renderable:  true, color:  true, depth: false, stencil: false, storage: false, copyable:  true, bytesPerBlock:  2, blockWidth: 1, blockHeight: 1 },
  // 32-bit formats
  'r32uint':                { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, copyable:  true, bytesPerBlock:  4, blockWidth: 1, blockHeight: 1 },
  'r32sint':                { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, copyable:  true, bytesPerBlock:  4, blockWidth: 1, blockHeight: 1 },
  'r32float':               { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, copyable:  true, bytesPerBlock:  4, blockWidth: 1, blockHeight: 1 },
  'rg16uint':               { renderable:  true, color:  true, depth: false, stencil: false, storage: false, copyable:  true, bytesPerBlock:  4, blockWidth: 1, blockHeight: 1 },
  'rg16sint':               { renderable:  true, color:  true, depth: false, stencil: false, storage: false, copyable:  true, bytesPerBlock:  4, blockWidth: 1, blockHeight: 1 },
  'rg16float':              { renderable:  true, color:  true, depth: false, stencil: false, storage: false, copyable:  true, bytesPerBlock:  4, blockWidth: 1, blockHeight: 1 },
  'rgba8unorm':             { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, copyable:  true, bytesPerBlock:  4, blockWidth: 1, blockHeight: 1 },
  'rgba8unorm-srgb':        { renderable:  true, color:  true, depth: false, stencil: false, storage: false, copyable:  true, bytesPerBlock:  4, blockWidth: 1, blockHeight: 1 },
  'rgba8snorm':             { renderable: false, color:  true, depth: false, stencil: false, storage:  true, copyable:  true, bytesPerBlock:  4, blockWidth: 1, blockHeight: 1 },
  'rgba8uint':              { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, copyable:  true, bytesPerBlock:  4, blockWidth: 1, blockHeight: 1 },
  'rgba8sint':              { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, copyable:  true, bytesPerBlock:  4, blockWidth: 1, blockHeight: 1 },
  'bgra8unorm':             { renderable:  true, color:  true, depth: false, stencil: false, storage: false, copyable:  true, bytesPerBlock:  4, blockWidth: 1, blockHeight: 1 },
  'bgra8unorm-srgb':        { renderable:  true, color:  true, depth: false, stencil: false, storage: false, copyable:  true, bytesPerBlock:  4, blockWidth: 1, blockHeight: 1 },
  // Packed 32-bit formats
  'rgb10a2unorm':           { renderable:  true, color:  true, depth: false, stencil: false, storage: false, copyable:  true, bytesPerBlock:  4, blockWidth: 1, blockHeight: 1 },
  'rg11b10float':           { renderable: false, color:  true, depth: false, stencil: false, storage: false, copyable:  true, bytesPerBlock:  4, blockWidth: 1, blockHeight: 1 },
  // 64-bit formats
  'rg32uint':               { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, copyable:  true, bytesPerBlock:  8, blockWidth: 1, blockHeight: 1 },
  'rg32sint':               { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, copyable:  true, bytesPerBlock:  8, blockWidth: 1, blockHeight: 1 },
  'rg32float':              { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, copyable:  true, bytesPerBlock:  8, blockWidth: 1, blockHeight: 1 },
  'rgba16uint':             { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, copyable:  true, bytesPerBlock:  8, blockWidth: 1, blockHeight: 1 },
  'rgba16sint':             { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, copyable:  true, bytesPerBlock:  8, blockWidth: 1, blockHeight: 1 },
  'rgba16float':            { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, copyable:  true, bytesPerBlock:  8, blockWidth: 1, blockHeight: 1 },
  // 128-bit formats
  'rgba32uint':             { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, copyable:  true, bytesPerBlock: 16, blockWidth: 1, blockHeight: 1 },
  'rgba32sint':             { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, copyable:  true, bytesPerBlock: 16, blockWidth: 1, blockHeight: 1 },
  'rgba32float':            { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, copyable:  true, bytesPerBlock: 16, blockWidth: 1, blockHeight: 1 },
  // Depth/stencil formats
  'depth32float':           { renderable:  true, color: false, depth:  true, stencil: false, storage: false, copyable:  true, bytesPerBlock:  4, blockWidth: 1, blockHeight: 1 },
  'depth24plus':            { renderable:  true, color: false, depth:  true, stencil: false, storage: false, copyable: false,                                                  },
  'depth24plus-stencil8':   { renderable:  true, color: false, depth:  true, stencil:  true, storage: false, copyable: false,                                                  },
};
export const kTextureFormats = Object.keys(kTextureFormatInfo) as GPUTextureFormat[];

export const kTextureDimensionInfo: {
  [k in GPUTextureDimension]: {
    // Add fields as needed
  };
} = /* prettier-ignore */ {
  '1d': {},
  '2d': {},
  '3d': {},
};
export const kTextureDimensions = Object.keys(kTextureDimensionInfo) as GPUTextureDimension[];

export const kTextureAspectInfo: {
  [k in GPUTextureAspect]: {
    // Add fields as needed
  };
} = /* prettier-ignore */ {
  'all': {},
  'depth-only': {},
  'stencil-only': {},
};
export const kTextureAspects = Object.keys(kTextureAspectInfo) as GPUTextureAspect[];

// Bindings

export const kMaxBindingsPerBindGroup = 16;

export type PerStageBindingLimitType =
  | 'uniform-buffer'
  | 'storage-buffer'
  | 'sampler'
  | 'sampled-texture'
  | 'storage-texture';
export const kPerStageBindingLimits: {
  [k in PerStageBindingLimitType]: number;
} = /* prettier-ignore */ {
  'uniform-buffer':  12,
  'storage-buffer':  4,
  'sampler':         16,
  'sampled-texture': 16,
  'storage-texture': 4,
};

const kStagesAll = C.ShaderStage.Vertex | C.ShaderStage.Fragment | C.ShaderStage.Compute;
const kStagesCompute = C.ShaderStage.Compute;
export const kBindingTypeInfo: {
  [k in GPUBindingType]: {
    type: 'buffer' | 'texture' | 'sampler';
    validStages: GPUShaderStageFlags;
    perStageLimitType: PerStageBindingLimitType;
    maxDynamicCount: number;
    // Add fields as needed
  };
  // TODO: maxDynamicCount should be kPerPipelineLayoutBindingLimits instead
} = /* prettier-ignore */ {
  'uniform-buffer':            { type: 'buffer',  validStages: kStagesAll,     perStageLimitType: 'uniform-buffer',  maxDynamicCount: 8 },
  'storage-buffer':            { type: 'buffer',  validStages: kStagesCompute, perStageLimitType: 'storage-buffer',  maxDynamicCount: 4 },
  'readonly-storage-buffer':   { type: 'buffer',  validStages: kStagesAll,     perStageLimitType: 'storage-buffer',  maxDynamicCount: 4 },
  'sampler':                   { type: 'sampler', validStages: kStagesAll,     perStageLimitType: 'sampler',         maxDynamicCount: 0 },
  'comparison-sampler':        { type: 'sampler', validStages: kStagesAll,     perStageLimitType: 'sampler',         maxDynamicCount: 0 },
  'sampled-texture':           { type: 'texture', validStages: kStagesAll,     perStageLimitType: 'sampled-texture', maxDynamicCount: 0 },
  'writeonly-storage-texture': { type: 'texture', validStages: kStagesCompute, perStageLimitType: 'storage-texture', maxDynamicCount: 0 },
  'readonly-storage-texture':  { type: 'texture', validStages: kStagesAll,     perStageLimitType: 'storage-texture', maxDynamicCount: 0 },
};
export const kBindingTypes = Object.keys(kBindingTypeInfo) as GPUBindingType[];

export const kShaderStages: GPUShaderStageFlags[] = [
  C.ShaderStage.Vertex,
  C.ShaderStage.Fragment,
  C.ShaderStage.Compute,
];
export const kShaderStageCombinations: GPUShaderStageFlags[] = [0, 1, 2, 3, 4, 5, 6, 7];
