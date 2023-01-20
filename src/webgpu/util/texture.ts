import { assert } from '../../common/util/util.js';
import { kTextureFormatInfo } from '../capability_info.js';

import { align } from './math.js';
import { getTextureCopyLayout } from './texture/layout.js';
import { TexelView } from './texture/texel_view.js';
import { reifyExtent3D } from './unions.js';

/**
 * Creates a texture with the contents of a TexelView.
 */
export function makeTextureWithContents(
  device: GPUDevice,
  texelView: TexelView,
  desc: Omit<GPUTextureDescriptor, 'format'>
): GPUTexture {
  const { width, height, depthOrArrayLayers } = reifyExtent3D(desc.size);

  const { bytesPerBlock, blockWidth } = kTextureFormatInfo[texelView.format];
  // Currently unimplemented for compressed textures.
  assert(blockWidth === 1);

  // Compute bytes per row.
  const bytesPerRow = align(bytesPerBlock * width, 256);

  // Create a staging buffer to upload the texture contents.
  const stagingBuffer = device.createBuffer({
    mappedAtCreation: true,
    size: bytesPerRow * height * depthOrArrayLayers,
    usage: GPUBufferUsage.COPY_SRC,
  });

  // Write the texels into the staging buffer.
  texelView.writeTextureData(new Uint8Array(stagingBuffer.getMappedRange()), {
    bytesPerRow,
    rowsPerImage: height,
    subrectOrigin: [0, 0, 0],
    subrectSize: [width, height, depthOrArrayLayers],
  });
  stagingBuffer.unmap();

  // Create the texture.
  const texture = device.createTexture({
    ...desc,
    format: texelView.format,
    usage: desc.usage | GPUTextureUsage.COPY_DST,
  });

  // Copy from the staging buffer into the texture.
  const commandEncoder = device.createCommandEncoder();
  commandEncoder.copyBufferToTexture(
    { buffer: stagingBuffer, bytesPerRow },
    { texture },
    desc.size
  );
  device.queue.submit([commandEncoder.finish()]);

  // Clean up the staging buffer.
  stagingBuffer.destroy();

  return texture;
}

/**
 * Creates a mipmapped texture where each mipmap level's (`i`) content is
 * from `texelViews[i]`.
 */
export function createTextureFromTexelViews(
  device: GPUDevice,
  texelViews: TexelView[],
  desc: Omit<GPUTextureDescriptor, 'format'>
): GPUTexture {
  // All texel views must be the same format for mipmaps.
  assert(texelViews.length > 0 && texelViews.every(e => e.format === texelViews[0].format));
  const format = texelViews[0].format;
  const { width, height, depthOrArrayLayers } = reifyExtent3D(desc.size);

  // Create the texture and then initialize each mipmap level separately.
  const texture = device.createTexture({
    ...desc,
    format: texelViews[0].format,
    usage: desc.usage | GPUTextureUsage.COPY_DST,
    mipLevelCount: texelViews.length,
  });

  // Copy the texel view into each mip level layer.
  const commandEncoder = device.createCommandEncoder();
  const stagingBuffers = [];
  for (let mipLevel = 0; mipLevel < texelViews.length; mipLevel++) {
    const {
      bytesPerRow,
      mipSize: [mipWidth, mipHeight, mipDepthOrArray],
    } = getTextureCopyLayout(format, desc.dimension ?? '2d', [width, height, depthOrArrayLayers], {
      mipLevel,
    });

    // Create a staging buffer to upload the texture mip level contents.
    const stagingBuffer = device.createBuffer({
      mappedAtCreation: true,
      size: bytesPerRow * mipHeight * mipDepthOrArray,
      usage: GPUBufferUsage.COPY_SRC,
    });
    stagingBuffers.push(stagingBuffer);

    // Write the texels into the staging buffer.
    texelViews[mipLevel].writeTextureData(new Uint8Array(stagingBuffer.getMappedRange()), {
      bytesPerRow,
      rowsPerImage: mipHeight,
      subrectOrigin: [0, 0, 0],
      subrectSize: [mipWidth, mipHeight, mipDepthOrArray],
    });
    stagingBuffer.unmap();

    // Copy from the staging buffer into the texture.
    commandEncoder.copyBufferToTexture(
      { buffer: stagingBuffer, bytesPerRow },
      { texture, mipLevel },
      [mipWidth, mipHeight, mipDepthOrArray]
    );
  }
  device.queue.submit([commandEncoder.finish()]);

  // Cleanup the staging buffers.
  stagingBuffers.map(value => value.destroy());

  return texture;
}

/**
 * Creates a 1 mip level texture with the contents of a TexelView.
 */
export function createTextureFromTexelView(
  device: GPUDevice,
  texelView: TexelView,
  desc: Omit<GPUTextureDescriptor, 'format'>
): GPUTexture {
  return createTextureFromTexelViews(device, [texelView], desc);
}
