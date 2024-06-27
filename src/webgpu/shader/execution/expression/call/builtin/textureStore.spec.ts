export const description = `
Writes a single texel to a texture.

The channel format T depends on the storage texel format F.
See the texel format table for the mapping of texel format to channel format.

Note: An out-of-bounds access occurs if:
 * any element of coords is outside the range [0, textureDimensions(t)) for the corresponding element, or
 * array_index is outside the range of [0, textureNumLayers(t))

If an out-of-bounds access occurs, the built-in function should not be executed.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { iterRange } from '../../../../../../common/util/util.js';
import { GPUTest, TextureTestMixin } from '../../../../../gpu_test.js';
import { virtualMipSize } from '../../../../../util/texture/base.js';
import { TexelFormats } from '../../../../types.js';

import { generateCoordBoundaries } from './utils.js';

export const g = makeTestGroup(TextureTestMixin(GPUTest));

g.test('store_1d_coords')
  .specURL('https://www.w3.org/TR/WGSL/#texturestore')
  .desc(
    `
C is i32 or u32

fn textureStore(t: texture_storage_1d<F,write>, coords: C, value: vec4<T>)

Parameters:
 * t  The sampled, depth, or external texture to sample.
 * s  The sampler type.
 * coords The texture coordinates used for sampling.
 * value The new texel value
`
  )
  .params(u =>
    u
      .combineWithParams(TexelFormats)
      .beginSubcases()
      .combine('coords', generateCoordBoundaries(1))
      .combine('C', ['i32', 'u32'] as const)
  )
  .unimplemented();

g.test('store_2d_coords')
  .specURL('https://www.w3.org/TR/WGSL/#texturestore')
  .desc(
    `
C is i32 or u32

fn textureStore(t: texture_storage_2d<F,write>, coords: vec2<C>, value: vec4<T>)

Parameters:
 * t  The sampled, depth, or external texture to sample.
 * s  The sampler type.
 * coords The texture coordinates used for sampling.
 * value The new texel value
`
  )
  .params(u =>
    u
      .combineWithParams(TexelFormats)
      .beginSubcases()
      .combine('coords', generateCoordBoundaries(2))
      .combine('C', ['i32', 'u32'] as const)
  )
  .unimplemented();

g.test('store_array_2d_coords')
  .specURL('https://www.w3.org/TR/WGSL/#texturestore')
  .desc(
    `
C is i32 or u32

fn textureStore(t: texture_storage_2d_array<F,write>, coords: vec2<C>, array_index: C, value: vec4<T>)

Parameters:
 * t  The sampled, depth, or external texture to sample.
 * s  The sampler type.
 * array_index The 0-based texture array index
 * coords The texture coordinates used for sampling.
 * value The new texel value
`
  )
  .params(
    u =>
      u
        .combineWithParams(TexelFormats)
        .beginSubcases()
        .combine('coords', generateCoordBoundaries(2))
        .combine('C', ['i32', 'u32'] as const)
        .combine('C_value', [-1, 0, 1, 2, 3, 4] as const)
    /* array_index not param'd as out-of-bounds is implementation specific */
  )
  .unimplemented();

g.test('store_3d_coords')
  .specURL('https://www.w3.org/TR/WGSL/#texturestore')
  .desc(
    `
C is i32 or u32

fn textureStore(t: texture_storage_3d<F,write>, coords: vec3<C>, value: vec4<T>)

Parameters:
 * t  The sampled, depth, or external texture to sample.
 * s  The sampler type.
 * coords The texture coordinates used for sampling.
 * value The new texel value
`
  )
  .params(u =>
    u
      .combineWithParams(TexelFormats)
      .beginSubcases()
      .combine('coords', generateCoordBoundaries(3))
      .combine('C', ['i32', 'u32'] as const)
  )
  .unimplemented();

// Texture width for dimensions >1D.
// Sized such that mip level 2 will be at least 256 bytes/row.
const kWidth = 256;

// Returns the texture geometry based on a given number of texels.
function getTextureSize(numTexels: number, dim: GPUTextureDimension, array: number): GPUExtent3D {
  const size: GPUExtent3D = { width: 1, height: 1, depthOrArrayLayers: 1 };
  switch (dim) {
    case '1d':
      size.width = numTexels;
      break;
    case '2d': {
      const texelsPerArray = numTexels / array;
      size.width = kWidth;
      size.height = texelsPerArray / kWidth;
      size.depthOrArrayLayers = array;
      break;
    }
    case '3d':
      size.width = kWidth;
      size.height = numTexels / (2 * kWidth);
      size.depthOrArrayLayers = 2;
      break;
  }
  return size;
}

// WGSL declaration type for the texture.
function textureType(dim: GPUTextureDimension): string {
  return `texture_storage_${dim}<r32uint, write>`;
}

// Defines a function to convert linear global id into a texture coordinate.
function indexToCoord(dim: GPUTextureDimension, type: string): string {
  switch (dim) {
    case '1d':
      return `
fn indexToCoord(id : u32) -> ${type} {
  return ${type}(id);
}`;
      break;
    case '2d':
      return `
fn indexToCoord(id : u32) -> vec2<${type}> {
  return vec2<${type}>(${type}(id % width), ${type}(id / width));
}`;
      break;
    case '3d':
      return `
fn indexToCoord(id : u32) -> vec3<${type}> {
  const half = numTexels / depth;
  let half_id = id % half;
  return vec3<${type}>(${type}(half_id % width), ${type}(half_id / width), ${type}(id / half));
}`;
      break;
  }
  return ``;
}

// Mutates 'coords' to produce an out-of-bounds value.
// 1D workgroups are launched so 'gid.x' is the linear id.
//
// This code is only executed for odd global ids (gid.x % 2 == 1).
// All the values are chosen such they will further divide the odd invocations.
function outOfBoundsValue(dim: GPUTextureDimension, type: string): string {
  switch (dim) {
    case '1d': {
      if (type === 'i32') {
        return `if gid.x % 3 == 0 {
          coords = -coords;
        } else {
          coords = coords + numTexels;
        }`;
      } else {
        return `coords = coords + numTexels;`;
      }
      break;
    }
    case '2d': {
      if (type === 'i32') {
        return `if gid.x % 3 == 0 {
          coords.x = -coords.x;
        } else {
          coords.y = coords.y + height;
        }`;
      } else {
        return `if gid.x % 3 == 1 {
          coords.x = coords.x + width;
        } else {
          coords.y = coords.y + height;
        }`;
      }
      break;
    }
    case '3d': {
      if (type === 'i32') {
        return `if gid.x % 3 == 0 {
          coords.x = -coords.x;
        } else if gid.x % 5 == 0 {
          coords.y = coords.y + height;
        } else {
          coords.z = coords.z + depth;
        }`;
      } else {
        return `if gid.x % 3 == 1 {
          coords.x = coords.x + width;
        } else if gid.x % 5 == 1 {
          coords.y = coords.y + height;
        } else {
          coords.z = 2 * depth;
        }`;
      }
      break;
    }
  }
  return ``;
}

// Returns the number of texels for a given mip level.
//
// 1D textures cannot have multiple mip levels so always return the input number of texels.
function getMipTexels(numTexels: number, dim: GPUTextureDimension, mip: number): number {
  let texels = numTexels;
  if (mip === 0) {
    return texels;
  }
  if (dim === '2d') {
    texels /= 1 << mip;
    texels /= 1 << mip;
  } else if (dim === '3d') {
    texels /= 1 << mip;
    texels /= 1 << mip;
    texels /= 1 << mip;
  }
  return texels;
}

const kDims = ['1d', '2d', '3d'] as const;

g.test('out_of_bounds')
  .desc('Test that textureStore on out-of-bounds coordinates have no effect')
  .params(u =>
    u
      .combine('dim', kDims)
      .combine('coords', ['i32', 'u32'] as const)
      .combine('mipCount', [1, 2, 3] as const)
      .combine('mip', [0, 1, 2] as const)
      .filter(t => {
        if (t.dim === '1d') {
          return t.mipCount === 1 && t.mip === 0;
        }
        if (t.dim === '3d') {
          return t.mipCount <= 2 && t.mip < t.mipCount;
        }
        return t.mip < t.mipCount;
      })
  )
  .fn(t => {
    const texel_format = 'r32uint';
    // Chosen such that the even at higher mip counts,
    // the texture is laid out without padding.
    // This simplifies the checking code below.
    //
    // Mip level | 1d   | 2d       | 3d
    // -----------------------------------------
    // 0         | 4096 | 256 x 16 | 256 x 8 x 2
    // 1         | -    | 128 x 8  | 128 x 4 x 1
    // 2         | -    | 64  x 4  | -
    const num_texels = 4096;
    const view_texels = getMipTexels(num_texels, t.params.dim, t.params.mip);

    const texture_size = getTextureSize(num_texels, t.params.dim, 1);
    const mip_size = virtualMipSize(t.params.dim, texture_size, t.params.mip);
    const texture = t.createTextureTracked({
      format: texel_format,
      dimension: t.params.dim,
      size: texture_size,
      mipLevelCount: t.params.mipCount,
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
    });

    const oob_value = outOfBoundsValue(t.params.dim, t.params.coords);
    const wgx_size = 32;
    const num_wgs_x = view_texels / wgx_size;

    const wgsl = `
@group(0) @binding(0) var tex : ${textureType(t.params.dim)};

const numTexels = ${view_texels};
const width = ${mip_size[0]};
const height = ${mip_size[1]};
const depth = ${mip_size[2]};

${indexToCoord(t.params.dim, t.params.coords)}

@compute @workgroup_size(${wgx_size})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  var coords = indexToCoord(gid.x);
  if gid.x % 2 == 1 {
    ${oob_value}
  }
  textureStore(tex, coords, vec4u(gid.x));
}`;

    const pipeline = t.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: t.device.createShaderModule({
          code: wgsl,
        }),
        entryPoint: 'main',
      },
    });
    const bg = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: texture.createView({
            format: texel_format,
            dimension: t.params.dim,
            baseArrayLayer: 0,
            arrayLayerCount: 1,
            baseMipLevel: t.params.mip,
            mipLevelCount: 1,
          }),
        },
      ],
    });

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(num_wgs_x, 1, 1);
    pass.end();
    t.queue.submit([encoder.finish()]);

    for (let m = 0; m < t.params.mipCount; m++) {
      const buffer = t.copyWholeTextureToNewBufferSimple(texture, m);
      if (m === t.params.mip) {
        const expectedOutput = new Uint32Array([
          ...iterRange(view_texels, x => {
            if (x >= view_texels) {
              return 0;
            }
            if (x % 2 === 1) {
              return 0;
            }
            return x;
          }),
        ]);
        t.expectGPUBufferValuesEqual(buffer, expectedOutput);
      } else {
        const expectedOutput = new Uint32Array([
          ...iterRange(getMipTexels(num_texels, t.params.dim, m), x => 0),
        ]);
        t.expectGPUBufferValuesEqual(buffer, expectedOutput);
      }
    }
  });

const kArrayLevels = 4;

g.test('out_of_bounds_array')
  .desc('Test that out-of-bounds array coordinates to textureStore have no effect')
  .params(u =>
    u
      .combine('baseLevel', [0, 1, 2, 3] as const)
      .combine('arrayLevels', [1, 2, 3, 4] as const)
      .combine('type', ['i32', 'u32'] as const)
      .filter(t => {
        if (t.arrayLevels <= t.baseLevel) {
          return false;
        }
        if (kArrayLevels < t.baseLevel + t.arrayLevels) {
          return false;
        }
        return true;
      })
  )
  .fn(t => {
    const dim = '2d';
    const view_dim = '2d-array';
    const texel_format = 'r32uint';
    const width = 64;
    const height = 64;
    const base_texels = width * height;
    const num_texels = base_texels * kArrayLevels;
    const view_texels = base_texels * t.params.arrayLevels;
    const texture_size: GPUExtent3D = { width, height, depthOrArrayLayers: kArrayLevels };
    const view_size: GPUExtent3D = { width, height, depthOrArrayLayers: t.params.arrayLevels };

    const texture = t.createTextureTracked({
      format: texel_format,
      dimension: dim,
      size: texture_size,
      mipLevelCount: 1,
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
    });

    const wgx_size = 32;
    const num_wgs_x = num_texels / wgx_size;

    let oob_value = `layer = layer + layers;`;
    if (t.params.type === 'i32') {
      oob_value = `if gid.x % 3 == 0 {
        layer = -(layer + layers);
      } else {
        layer = layer + layers;
      }`;
    }

    const wgsl = `
@group(0) @binding(0) var tex : texture_storage_2d_array<r32uint, write>;

const numTexels = ${view_texels};
const width = ${view_size.width};
const height = ${view_size.height ?? 1};
const layers = ${view_size.depthOrArrayLayers ?? 1};
const layerTexels = numTexels / layers;

@compute @workgroup_size(${wgx_size})
fn main(@builtin(global_invocation_id) gid : vec3u) {
  let layer_id = gid.x % layerTexels;
  var x = ${t.params.type}(layer_id % width);
  var y = ${t.params.type}(layer_id / width);
  var layer = ${t.params.type}(gid.x / layerTexels);
  if gid.x % 2 == 1 {
    ${oob_value}
  }
  textureStore(tex, vec2(x, y), layer, vec4u(gid.x));
}`;

    const pipeline = t.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: t.device.createShaderModule({
          code: wgsl,
        }),
        entryPoint: 'main',
      },
    });
    const bg = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: texture.createView({
            format: texel_format,
            dimension: view_dim,
            baseArrayLayer: t.params.baseLevel,
            arrayLayerCount: t.params.arrayLevels,
            baseMipLevel: 0,
            mipLevelCount: 1,
          }),
        },
      ],
    });

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(num_wgs_x, 1, 1);
    pass.end();
    t.queue.submit([encoder.finish()]);

    const buffer = t.copyWholeTextureToNewBufferSimple(texture, 0);
    const expectedOutput = new Uint32Array([
      ...iterRange(num_texels, x => {
        const baseOffset = base_texels * t.params.baseLevel;
        if (x < baseOffset) {
          return 0;
        }
        if (base_texels * (t.params.baseLevel + t.params.arrayLevels) <= x) {
          return 0;
        }
        if (x % 2 === 1) {
          return 0;
        }
        return x - baseOffset;
      }),
    ]);
    t.expectGPUBufferValuesEqual(buffer, expectedOutput);
  });
