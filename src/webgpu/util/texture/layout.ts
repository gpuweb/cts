import * as C from '../../../common/constants.js';
import { assert, unreachable } from '../../../common/framework/util/util.js';
import { kTextureFormatInfo } from '../../capability_info.js';
import { align, isAligned } from '../math.js';

export const kBytesPerRowAlignment = 256;
export const kBufferCopyAlignment = 4;

export function getTextureCopyLayout(
  format: GPUTextureFormat,
  dimension: GPUTextureDimension,
  size: [number, number, number],
  mipLevel: number = 0,
  bytesPerRow?: number,
  rowsPerImage?: number
): {
  bytesPerBlock: number;
  byteLength: number;
  minBytesPerRow: number;
  bytesPerRow: number;
  rowsPerImage: number;
} {
  let mipSize: [number, number, number];
  switch (dimension) {
    case '1d':
      mipSize = [size[0] >> mipLevel, size[1], size[2]];
      break;
    case '2d':
      mipSize = [size[0] >> mipLevel, size[1] >> mipLevel, size[2]];
      break;
    case '3d':
      mipSize = [size[0] >> mipLevel, size[1] >> mipLevel, size[2] >> mipLevel];
      break;
    default:
      unreachable();
  }

  const { blockWidth, blockHeight, bytesPerBlock } = kTextureFormatInfo[format];
  assert(!!bytesPerBlock && !!blockWidth && !!blockHeight);

  const minBytesPerRow = (mipSize[0] / blockWidth) * bytesPerBlock;
  const alignedMinBytesPerRow = align(minBytesPerRow, kBytesPerRowAlignment);
  if (bytesPerRow !== undefined) {
    assert(bytesPerRow >= alignedMinBytesPerRow);
    assert(isAligned(bytesPerRow, kBytesPerRowAlignment));
  } else {
    bytesPerRow = alignedMinBytesPerRow;
  }

  if (rowsPerImage !== undefined) {
    assert(rowsPerImage >= size[1]);
  } else {
    rowsPerImage = size[1];
  }

  const bytesPerSlice = (bytesPerRow * rowsPerImage) / blockWidth;
  const sliceSize =
    bytesPerRow * (size[1] / blockHeight - 1) + bytesPerBlock * (size[0] / blockWidth);
  const byteLength = bytesPerSlice * (size[2] - 1) + sliceSize;

  return {
    bytesPerBlock,
    byteLength: align(byteLength, kBufferCopyAlignment),
    minBytesPerRow,
    bytesPerRow,
    rowsPerImage,
  };
}

export function fillTextureDataWithTexelValue(
  outputBuffer: ArrayBuffer,
  size: [number, number, number],
  texelValue: ArrayBuffer,
  bytesPerRow?: number,
  rowsPerImage?: number
): void {
  const minBytesPerRow = texelValue.byteLength * size[0];
  const alignedMinBytesPerRow =
    Math.ceil(minBytesPerRow / kBytesPerRowAlignment) * kBytesPerRowAlignment;
  if (bytesPerRow === undefined) {
    bytesPerRow = alignedMinBytesPerRow;
  } else {
    assert(bytesPerRow >= alignedMinBytesPerRow);
    assert(isAligned(bytesPerRow, kBytesPerRowAlignment));
  }

  if (rowsPerImage === undefined) {
    rowsPerImage = size[1];
  } else {
    assert(rowsPerImage >= size[1]);
  }

  const texelValueBytes = new Uint8Array(texelValue);
  const outputTexelValueBytes = new Uint8Array(outputBuffer);
  for (let slice = 0; slice < size[2]; ++slice) {
    for (let row = 0; row < size[1]; ++row) {
      for (let col = 0; col < size[0]; ++col) {
        const byteOffset =
          slice * rowsPerImage * bytesPerRow + row * bytesPerRow + col * texelValue.byteLength;
        outputTexelValueBytes.set(texelValueBytes, byteOffset);
      }
    }
  }
}

export function createTextureUploadBuffer(
  device: GPUDevice,
  format: GPUTextureFormat,
  dimension: GPUTextureDimension,
  size: [number, number, number],
  texelValue: ArrayBuffer,
  mipLevel: number = 0,
  bytesPerRowIn?: number,
  rowsPerImageIn?: number
): {
  buffer: GPUBuffer;
  bytesPerRow: number;
  rowsPerImage: number;
} {
  const { byteLength, bytesPerRow, rowsPerImage, bytesPerBlock } = getTextureCopyLayout(
    format,
    dimension,
    size,
    mipLevel,
    bytesPerRowIn,
    rowsPerImageIn
  );

  const [buffer, mapping] = device.createBufferMapped({
    size: byteLength,
    usage: C.BufferUsage.CopySrc,
  });

  assert(texelValue.byteLength === bytesPerBlock);
  fillTextureDataWithTexelValue(mapping, size, texelValue, bytesPerRow, rowsPerImage);
  buffer.unmap();

  return {
    buffer,
    bytesPerRow,
    rowsPerImage,
  };
}

export function createTextureReadbackBuffer(
  device: GPUDevice,
  format: GPUTextureFormat,
  dimension: GPUTextureDimension,
  size: [number, number, number],
  expectedTexelData: ArrayBuffer,
  mipLevel: number = 0,
  bytesPerRowIn?: number,
  rowsPerImageIn?: number
): {
  buffer: GPUBuffer;
  cpuData: ArrayBuffer;
} {
  const { bytesPerRow, byteLength, rowsPerImage, bytesPerBlock } = getTextureCopyLayout(
    format,
    dimension,
    size,
    mipLevel,
    bytesPerRowIn,
    rowsPerImageIn
  );

  const buffer = device.createBuffer({
    size: byteLength,
    usage: C.BufferUsage.CopySrc | C.BufferUsage.CopyDst,
  });

  const cpuData = new ArrayBuffer(byteLength);
  assert(expectedTexelData.byteLength === bytesPerBlock);
  fillTextureDataWithTexelValue(cpuData, size, expectedTexelData, bytesPerRow, rowsPerImage);

  return { buffer, cpuData };
}
