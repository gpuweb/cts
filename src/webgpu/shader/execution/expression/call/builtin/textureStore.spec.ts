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
function getTextureSize(numTexels: number, dim: string, array: number): GPUExtent3D {
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
function textureType(dim: string): string {
  return `texture_storage_${dim}<r32uint, write>`;
}

// Defines a function to convert linear global id into a texture coordinate.
function indexToCoord(dim: string, type: string): string {
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
      break;
  }
  return ``;
}

// Mutates 'coords' to produce an out-of-bounds value.
// 1D workgroups are launched so 'gid.x' is the linear id.
function outOfBoundsValue(dim: string, type: string): string {
  switch (dim) {
    case '1d': {
      if (type === 'i32') {
        return `if gid.x % 3 == 1 {
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
        return `if gid.x % 3 == 1 {
          coords.x = -coords.x;
        } else {
          coords.y = coords.y + numTexels;
        }`;
      } else {
        return `if gid.x % 3 == 1 {
          coords.x = coords.x + numTexels;
        } else {
          coords.y = coords.y + numTexels;
        }`;
      }
      break;
    }
  }
  return ``;
}

g.test('out_of_bounds')
  .desc('Test that textureStore on out-of-bounds coordinates have no effect')
  .params(u =>
    u
      .combine('dim', ['1d', '2d'] as const)
      .combine('coords', ['i32', 'u32'] as const)
      .combine('mipCount', [1, 2, 3] as const)
      .combine('mip', [0, 1, 2] as const)
      .filter(t => {
        if (t.dim === '1d') {
          return t.mipCount === 1 && t.mip === 0;
        }
        return t.mip < t.mipCount;
      })
  )
  .fn(t => {
    const format = 'r32uint';
    const bytes_per_texel = 4;
    const num_texels = 4096;
    const view_texels = num_texels / (t.params.mip === 0 ? 1 : 1 << (t.params.mip * 2));

    const texture_size = getTextureSize(num_texels, t.params.dim, 1);
    const mip_size: GPUExtent3D = { width: 1, height: 1, depthOrArrayLayers: 1 };
    mip_size.width = (texture_size as GPUExtent3DDict).width / (1 << t.params.mip);
    mip_size.height = ((texture_size as GPUExtent3DDict).height ?? 1) / (1 << t.params.mip);
    const texture = t.device.createTexture({
      format: format,
      dimension: t.params.dim,
      size: texture_size,
      mipLevelCount: t.params.mipCount,
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
    });
    t.trackForCleanup(texture);

    const oob_value = outOfBoundsValue(t.params.dim, t.params.coords);
    const wgx_size = 16;
    const num_wgs_x = view_texels / wgx_size;

    const wgsl = `
@group(0) @binding(0) var tex : ${textureType(t.params.dim)};

const numTexels = ${view_texels};
const width = ${mip_size.width};

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
            format: format,
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

    const buffer = t.copyWholeTextureToNewBufferSimple(texture, t.params.mip);

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
  });
