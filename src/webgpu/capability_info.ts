import { C } from '../common/framework/index.js';

// Textures

export const kTextureFormatInfo: {
  [k in GPUTextureFormat]: {
    renderable: boolean;
    color: boolean;
    depth: boolean;
    stencil: boolean;
    storage: boolean;
    bytes: number;
    // Add fields as needed
  };
} = /* prettier-ignore */ {
  // Try to keep these manually-formatted in a readable grid.
  // (Note: this list should always match the one in the spec.)

  // 8-bit formats
  'r8unorm':                { renderable:  true, color:  true, depth: false, stencil: false, storage: false, bytes:  1 },
  'r8snorm':                { renderable: false, color:  true, depth: false, stencil: false, storage: false, bytes:  1 },
  'r8uint':                 { renderable:  true, color:  true, depth: false, stencil: false, storage: false, bytes:  1 },
  'r8sint':                 { renderable:  true, color:  true, depth: false, stencil: false, storage: false, bytes:  1 },
  // 16-bit formats
  'r16uint':                { renderable:  true, color:  true, depth: false, stencil: false, storage: false, bytes:  2 },
  'r16sint':                { renderable:  true, color:  true, depth: false, stencil: false, storage: false, bytes:  2 },
  'r16float':               { renderable:  true, color:  true, depth: false, stencil: false, storage: false, bytes:  2 },
  'rg8unorm':               { renderable:  true, color:  true, depth: false, stencil: false, storage: false, bytes:  2 },
  'rg8snorm':               { renderable: false, color:  true, depth: false, stencil: false, storage: false, bytes:  2 },
  'rg8uint':                { renderable:  true, color:  true, depth: false, stencil: false, storage: false, bytes:  2 },
  'rg8sint':                { renderable:  true, color:  true, depth: false, stencil: false, storage: false, bytes:  2 },
  // 32-bit formats
  'r32uint':                { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, bytes:  4 },
  'r32sint':                { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, bytes:  4 },
  'r32float':               { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, bytes:  4 },
  'rg16uint':               { renderable:  true, color:  true, depth: false, stencil: false, storage: false, bytes:  4 },
  'rg16sint':               { renderable:  true, color:  true, depth: false, stencil: false, storage: false, bytes:  4 },
  'rg16float':              { renderable:  true, color:  true, depth: false, stencil: false, storage: false, bytes:  4 },
  'rgba8unorm':             { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, bytes:  4 },
  'rgba8unorm-srgb':        { renderable:  true, color:  true, depth: false, stencil: false, storage: false, bytes:  4 },
  'rgba8snorm':             { renderable: false, color:  true, depth: false, stencil: false, storage:  true, bytes:  4 },
  'rgba8uint':              { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, bytes:  4 },
  'rgba8sint':              { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, bytes:  4 },
  'bgra8unorm':             { renderable:  true, color:  true, depth: false, stencil: false, storage: false, bytes:  4 },
  'bgra8unorm-srgb':        { renderable:  true, color:  true, depth: false, stencil: false, storage: false, bytes:  4 },
  // Packed 32-bit formats
  'rgb10a2unorm':           { renderable:  true, color:  true, depth: false, stencil: false, storage: false, bytes:  4 },
  'rg11b10float':           { renderable: false, color:  true, depth: false, stencil: false, storage: false, bytes:  4 },
  // 64-bit formats
  'rg32uint':               { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, bytes:  8 },
  'rg32sint':               { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, bytes:  8 },
  'rg32float':              { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, bytes:  8 },
  'rgba16uint':             { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, bytes:  8 },
  'rgba16sint':             { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, bytes:  8 },
  'rgba16float':            { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, bytes:  8 },
  // 128-bit formats
  'rgba32uint':             { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, bytes: 16 },
  'rgba32sint':             { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, bytes: 16 },
  'rgba32float':            { renderable:  true, color:  true, depth: false, stencil: false, storage:  true, bytes: 16 },
  // Depth/stencil formats
  'depth32float':           { renderable:  true, color: false, depth:  true, stencil: false, storage: false, bytes:  4 },
  'depth24plus':            { renderable:  true, color: false, depth:  true, stencil: false, storage: false, bytes:  4 },
  'depth24plus-stencil8':   { renderable:  true, color: false, depth:  true, stencil:  true, storage: false, bytes:  4 },
};
export const kTextureFormats = Object.keys(kTextureFormatInfo) as GPUTextureFormat[];

export function isPackedFormat(format: GPUTextureFormat): boolean {
  return format === 'depth24plus' || format === 'depth24plus-stencil8';
}

export const kTextureDimensions = (() => {
  const kTextureDimensionsObject: { [k in GPUTextureDimension]: GPUTextureDimension } = {
    [C.TextureDimension.E1d]: C.TextureDimension.E1d,
    [C.TextureDimension.E2d]: C.TextureDimension.E2d,
    [C.TextureDimension.E3d]: C.TextureDimension.E3d,
  };
  return Object.values(kTextureDimensionsObject);
})();

export const kTextureAspects = (() => {
  const kTextureAspectsObject: { [k in GPUTextureAspect]: GPUTextureAspect } = {
    [C.TextureAspect.All]: C.TextureAspect.All,
    [C.TextureAspect.DepthOnly]: C.TextureAspect.DepthOnly,
    [C.TextureAspect.StencilOnly]: C.TextureAspect.StencilOnly,
  };
  return Object.values(kTextureAspectsObject);
})();

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
