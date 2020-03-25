import { C, assert } from '../../../common/framework/index.js';
import { kTextureFormatInfo } from '../../capability_info.js';

export const kBytesPerRowAlignment = 256;

export function getTextureCopyLayout(
  format: GPUTextureFormat,
  size: GPUExtent3D,
  mipLevel: number = 0,
  bytesPerRow?: number,
  rowsPerImage?: number
): {
  bytesPerTexel: number;
  byteLength: number;
  minBytesPerRow: number;
  bytesPerRow: number;
  rowsPerImage: number;
} {
  if (!Array.isArray(size)) {
    size = [size.width, size.height, size.depth];
  }

  const bytesPerTexel = kTextureFormatInfo[format].bytes;
  const minBytesPerRow = (size[0] >> mipLevel) * bytesPerTexel;
  const alignedMinBytesPerRow =
    Math.ceil(minBytesPerRow / kBytesPerRowAlignment) * kBytesPerRowAlignment;
  if (bytesPerRow !== undefined) {
    assert(bytesPerRow >= alignedMinBytesPerRow);
  } else {
    bytesPerRow = alignedMinBytesPerRow;
  }

  if (rowsPerImage !== undefined) {
    assert(rowsPerImage >= size[1]);
  } else {
    rowsPerImage = size[1];
  }

  return {
    bytesPerTexel,
    byteLength: bytesPerRow * rowsPerImage,
    minBytesPerRow,
    bytesPerRow,
    rowsPerImage,
  };
}

export function fillTextureDataRows(
  outputBuffer: ArrayBuffer,
  size: GPUExtent3D,
  inputTexelData: ArrayBuffer,
  bytesPerRow?: number,
  rowsPerImage?: number
): void {
  if (!Array.isArray(size)) {
    size = [size.width, size.height, size.depth];
  }

  const minBytesPerRow = inputTexelData.byteLength * size[0];
  const alignedMinBytesPerRow =
    Math.ceil(minBytesPerRow / kBytesPerRowAlignment) * kBytesPerRowAlignment;
  if (bytesPerRow === undefined) {
    bytesPerRow = alignedMinBytesPerRow;
  } else {
    assert(bytesPerRow >= alignedMinBytesPerRow);
  }

  if (rowsPerImage === undefined) {
    rowsPerImage = size[1];
  } else {
    assert(rowsPerImage >= size[1]);
  }

  const outputTexelData = new Uint8Array(outputBuffer);
  for (let slice = 0; slice < size[2]; ++slice) {
    for (let row = 0; row < size[1]; ++row) {
      for (let col = 0; col < size[0]; ++col) {
        const byteOffset =
          slice * rowsPerImage * bytesPerRow + row * bytesPerRow + col * inputTexelData.byteLength;
        outputTexelData.set(new Uint8Array(inputTexelData), byteOffset);
      }
    }
  }
}

export function createTextureUploadBuffer(
  device: GPUDevice,
  format: GPUTextureFormat,
  size: GPUExtent3D,
  inputTexelData: ArrayBuffer,
  mipLevel: number = 0,
  bytesPerRowIn?: number,
  rowsPerImageIn?: number
): {
  buffer: GPUBuffer;
  bytesPerRow: number;
  rowsPerImage: number;
} {
  const { byteLength, bytesPerRow, rowsPerImage, bytesPerTexel } = getTextureCopyLayout(
    format,
    size,
    mipLevel,
    bytesPerRowIn,
    rowsPerImageIn
  );

  const [buffer, mapping] = device.createBufferMapped({
    size: byteLength,
    usage: C.BufferUsage.CopySrc,
  });

  assert(inputTexelData.byteLength === bytesPerTexel);
  fillTextureDataRows(mapping, size, inputTexelData, bytesPerRow, rowsPerImage);
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
  size: GPUExtent3D,
  expectedTexelData: ArrayBuffer,
  mipLevel: number = 0,
  bytesPerRowIn?: number,
  rowsPerImageIn?: number
): {
  buffer: GPUBuffer;
  cpuData: ArrayBuffer;
} {
  const { bytesPerRow, byteLength, rowsPerImage, bytesPerTexel } = getTextureCopyLayout(
    format,
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
  assert(expectedTexelData.byteLength === bytesPerTexel);
  fillTextureDataRows(cpuData, size, expectedTexelData, bytesPerRow, rowsPerImage);

  return { buffer, cpuData };
}
