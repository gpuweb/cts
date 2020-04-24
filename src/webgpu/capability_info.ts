import * as C from '../common/constants.js';

function keysOf<T extends string>(obj: { [k in T]: unknown }): readonly T[] {
  return (Object.keys(obj) as unknown[]) as T[];
}

function numericKeysOf<T>(obj: object): readonly T[] {
  return (Object.keys(obj).map(n => Number(n)) as unknown[]) as T[];
}

// Textures

export const kTextureFormatInfo: {
  readonly [k in GPUTextureFormat]: {
    readonly renderable: boolean;
    readonly color: boolean;
    readonly depth: boolean;
    readonly stencil: boolean;
    readonly storage: boolean;
    readonly copyable: boolean;
    readonly bytesPerBlock?: number;
    readonly blockWidth?: number;
    readonly blockHeight?: number;
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
export const kTextureFormats = keysOf(kTextureFormatInfo);

export const kTextureDimensionInfo: {
  readonly [k in GPUTextureDimension]: {
    // Add fields as needed
  };
} = /* prettier-ignore */ {
  '1d': {},
  '2d': {},
  '3d': {},
};
export const kTextureDimensions = keysOf(kTextureDimensionInfo);

export const kTextureAspectInfo: {
  readonly [k in GPUTextureAspect]: {
    // Add fields as needed
  };
} = /* prettier-ignore */ {
  'all': {},
  'depth-only': {},
  'stencil-only': {},
};
export const kTextureAspects = keysOf(kTextureAspectInfo);

export const kTextureUsageInfo: {
  readonly [k in C.TextureUsage]: {};
} = {
  [C.TextureUsage.CopySrc]: {},
  [C.TextureUsage.CopyDst]: {},
  [C.TextureUsage.Sampled]: {},
  [C.TextureUsage.Storage]: {},
  [C.TextureUsage.OutputAttachment]: {},
};
export const kTextureUsages = numericKeysOf<C.TextureUsage>(kTextureUsageInfo);

// Bindings

export const kMaxBindingsPerBindGroup = 16;

export type PerStageBindingLimitType =
  | 'uniform-buffer'
  | 'storage-buffer'
  | 'sampler'
  | 'sampled-texture'
  | 'storage-texture';
export const kPerStageBindingLimits: {
  readonly [k in PerStageBindingLimitType]: {
    readonly max: number;
  };
} = /* prettier-ignore */ {
  'uniform-buffer':  { max: 12, },
  'storage-buffer':  { max:  4, },
  'sampler':         { max: 16, },
  'sampled-texture': { max: 16, },
  'storage-texture': { max:  4, },
};

export type PerPipelineBindingLimitType = PerStageBindingLimitType;
export const kPerPipelineBindingLimits: {
  readonly [k in PerPipelineBindingLimitType]: {
    readonly maxDynamic: number;
  };
} = /* prettier-ignore */ {
  'uniform-buffer':  { maxDynamic: 8, },
  'storage-buffer':  { maxDynamic: 4, },
  'sampler':         { maxDynamic: 0, },
  'sampled-texture': { maxDynamic: 0, },
  'storage-texture': { maxDynamic: 0, },
};

export type BindableResource =
  | 'error-buffer'
  | 'error-sampler'
  | 'error-textureview'
  | 'uniform-buffer'
  | 'storage-buffer'
  | 'sampler'
  | 'comparison-sampler'
  | 'sampled-textureview'
  | 'storage-textureview';
const kBindableResource: {
  readonly [k in BindableResource]: {};
} = /* prettier-ignore */ {
  'error-buffer':        {},
  'error-sampler':       {},
  'error-textureview':   {},
  'uniform-buffer':      {},
  'storage-buffer':      {},
  'sampler':             {},
  'comparison-sampler':  {},
  'sampled-textureview': {},
  'storage-textureview': {},
};
export const kBindableResources = keysOf(kBindableResource);

type ValidBindableResource =
  | 'uniform-buffer'
  | 'storage-buffer'
  | 'sampler'
  | 'comparison-sampler'
  | 'sampled-textureview'
  | 'storage-textureview';
interface BindingKind {
  readonly resource: ValidBindableResource;
  readonly perStageBindingLimitType: PerStageBindingLimitType;
  readonly perPipelineBindingLimitType: PerPipelineBindingLimitType;
}
const kBindingKind = /* prettier-ignore */ {
  uniformBuf:  { resource: 'uniform-buffer',      perStageBindingLimitType: 'uniform-buffer',  perPipelineBindingLimitType: 'uniform-buffer',  } as BindingKind,
  storageBuf:  { resource: 'storage-buffer',      perStageBindingLimitType: 'storage-buffer',  perPipelineBindingLimitType: 'storage-buffer',  } as BindingKind,
  plainSamp:   { resource: 'sampler',             perStageBindingLimitType: 'sampler',         perPipelineBindingLimitType: 'sampler',         } as BindingKind,
  compareSamp: { resource: 'comparison-sampler',  perStageBindingLimitType: 'sampler',         perPipelineBindingLimitType: 'sampler',         } as BindingKind,
  sampledTex:  { resource: 'sampled-textureview', perStageBindingLimitType: 'sampled-texture', perPipelineBindingLimitType: 'sampled-texture', } as BindingKind,
  storageTex:  { resource: 'storage-textureview', perStageBindingLimitType: 'storage-texture', perPipelineBindingLimitType: 'storage-texture', } as BindingKind,
};

const kValidStagesAll = {
  validStages: C.ShaderStage.Vertex | C.ShaderStage.Fragment | C.ShaderStage.Compute,
};
const kValidStagesCompute = { validStages: C.ShaderStage.Compute };

// Binding types

interface BindingTypeInfo {
  readonly resource: ValidBindableResource;
  readonly validStages: GPUShaderStageFlags;
  readonly perStageBindingLimitType: PerStageBindingLimitType;
  readonly perPipelineBindingLimitType: PerPipelineBindingLimitType;
  // Add fields as needed
}

// Buffer bindings

type BufferBindingType = 'uniform-buffer' | 'storage-buffer' | 'readonly-storage-buffer';
export const kBufferBindingTypeInfo: {
  readonly [k in BufferBindingType]: {
    readonly usage: C.BufferUsage;
  } & BindingTypeInfo;
} = /* prettier-ignore */ {
  'uniform-buffer':          { usage: C.BufferUsage.Uniform, ...kBindingKind.uniformBuf,  ...kValidStagesAll,     },
  'storage-buffer':          { usage: C.BufferUsage.Storage, ...kBindingKind.storageBuf,  ...kValidStagesCompute, },
  'readonly-storage-buffer': { usage: C.BufferUsage.Storage, ...kBindingKind.storageBuf,  ...kValidStagesAll,     },
};
export const kBufferBindingTypes = keysOf(kBufferBindingTypeInfo);

// Sampler bindings

type SamplerBindingType = 'sampler' | 'comparison-sampler';
export const kSamplerBindingTypeInfo: {
  readonly [k in SamplerBindingType]: {
    // Add fields as needed
  } & BindingTypeInfo;
} = /* prettier-ignore */ {
  'sampler':                   { ...kBindingKind.plainSamp,   ...kValidStagesAll,     },
  'comparison-sampler':        { ...kBindingKind.compareSamp, ...kValidStagesAll,     },
};
export const kSamplerBindingTypes = keysOf(kSamplerBindingTypeInfo);

// Texture bindings

type TextureBindingType =
  | 'sampled-texture'
  | 'writeonly-storage-texture'
  | 'readonly-storage-texture';
export const kTextureBindingTypeInfo: {
  readonly [k in TextureBindingType]: {
    readonly usage: C.TextureUsage;
  } & BindingTypeInfo;
} = /* prettier-ignore */ {
  'sampled-texture':           { usage: C.TextureUsage.Sampled, ...kBindingKind.sampledTex,  ...kValidStagesAll,     },
  'writeonly-storage-texture': { usage: C.TextureUsage.Storage, ...kBindingKind.storageTex,  ...kValidStagesCompute, },
  'readonly-storage-texture':  { usage: C.TextureUsage.Storage, ...kBindingKind.storageTex,  ...kValidStagesAll,     },
};
export const kTextureBindingTypes = keysOf(kTextureBindingTypeInfo);

// All binding types (merged from above)

export const kBindingTypeInfo: {
  readonly [k in GPUBindingType]: BindingTypeInfo;
} = {
  ...kBufferBindingTypeInfo,
  ...kSamplerBindingTypeInfo,
  ...kTextureBindingTypeInfo,
};
export const kBindingTypes = keysOf(kBindingTypeInfo);

export const kShaderStages: readonly GPUShaderStageFlags[] = [
  C.ShaderStage.Vertex,
  C.ShaderStage.Fragment,
  C.ShaderStage.Compute,
];
export const kShaderStageCombinations: readonly GPUShaderStageFlags[] = [0, 1, 2, 3, 4, 5, 6, 7];
