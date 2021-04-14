import { ResolveType } from '../common/framework/util/types.js';

// Types ensures every field is specified.

const BufferUsage: ResolveType<Omit<GPUBufferUsage, '__brand'>> = {
  MAP_READ: 0x0001,
  MAP_WRITE: 0x0002,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  INDEX: 0x0010,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080,
  INDIRECT: 0x0100,
  QUERY_RESOLVE: 0x0200,
};
const TextureUsage: ResolveType<Omit<GPUTextureUsage, '__brand'>> = {
  COPY_SRC: 0x01,
  COPY_DST: 0x02,
  SAMPLED: 0x04,
  STORAGE: 0x08,
  RENDER_ATTACHMENT: 0x10,
};
const ColorWrite: ResolveType<Omit<GPUColorWrite, '__brand'>> = {
  RED: 0x1,
  GREEN: 0x2,
  BLUE: 0x4,
  ALPHA: 0x8,
  ALL: 0xf,
};
const ShaderStage: ResolveType<Omit<GPUShaderStage, '__brand'>> = {
  VERTEX: 0x1,
  FRAGMENT: 0x2,
  COMPUTE: 0x4,
};
const MapMode: ResolveType<Omit<GPUMapMode, '__brand'>> = {
  READ: 0x1,
  WRITE: 0x2,
};
export const GPUConst = {
  BufferUsage,
  TextureUsage,
  ColorWrite,
  ShaderStage,
  MapMode,
} as const;

export const DefaultLimits: ResolveType<Required<Readonly<GPULimits>>> = {
  maxTextureDimension1D: 8192,
  maxTextureDimension2D: 8192,
  maxTextureDimension3D: 2048,
  maxTextureArrayLayers: 2048,
  maxBindGroups: 4,
  maxDynamicUniformBuffersPerPipelineLayout: 8,
  maxDynamicStorageBuffersPerPipelineLayout: 4,
  maxSampledTexturesPerShaderStage: 16,
  maxSamplersPerShaderStage: 16,
  maxStorageBuffersPerShaderStage: 4,
  maxStorageTexturesPerShaderStage: 4,
  maxUniformBuffersPerShaderStage: 12,
  maxUniformBufferBindingSize: 16384,
};
