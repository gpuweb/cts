import { kTextureFormatInfo } from '../../capability_info.js';

import { ValidationTest } from './validation_test.js';

export enum TestMethod {
  WriteTexture = 'WriteTexture',
  CopyBufferToTexture = 'CopyBufferToTexture',
  CopyTextureToBuffer = 'CopyTextureToBuffer',
}

export const kAllTestMethods = [
  TestMethod.WriteTexture,
  TestMethod.CopyBufferToTexture,
  TestMethod.CopyTextureToBuffer,
];

export class CopyBetweenLinearDataAndTextureTest extends ValidationTest {
  bytesInACompleteRow(copyWidth: number, format: GPUTextureFormat): number {
    return (
      (kTextureFormatInfo[format].bytesPerBlock * copyWidth) / kTextureFormatInfo[format].blockWidth
    );
  }

  requiredBytesInCopy(
    layout: GPUTextureDataLayout,
    format: GPUTextureFormat,
    copyExtent: GPUExtent3DDict
  ): number {
    if (copyExtent.width === 0 || copyExtent.height === 0 || copyExtent.depth === 0) {
      return 0;
    } else {
      const texelBlockRowsPerImage = layout.rowsPerImage / kTextureFormatInfo[format].blockHeight;
      const bytesPerImage = layout.bytesPerRow * texelBlockRowsPerImage;
      const bytesInLastSlice =
        layout.bytesPerRow * (copyExtent.height / kTextureFormatInfo[format].blockHeight - 1) +
        (copyExtent.width / kTextureFormatInfo[format].blockWidth) *
          kTextureFormatInfo[format].bytesPerBlock;
      return bytesPerImage * (copyExtent.depth - 1) + bytesInLastSlice;
    }
  }

  testRun(
    textureCopyView: GPUTextureCopyView,
    textureDataLayout: GPUTextureDataLayout,
    size: GPUExtent3D,
    { dataSize, method, success }: { dataSize: number; method: TestMethod; success: boolean }
  ): void {
    switch (method) {
      case TestMethod.WriteTexture: {
        const data = new Uint8Array(dataSize);

        this.expectValidationError(() => {
          this.device.defaultQueue.writeTexture(textureCopyView, data, textureDataLayout, size);
        }, !success);

        break;
      }
      case TestMethod.CopyBufferToTexture: {
        const buffer = this.device.createBuffer({
          mappedAtCreation: false,
          size: dataSize,
          usage: GPUBufferUsage.COPY_SRC,
        });

        const encoder = this.device.createCommandEncoder();
        encoder.copyBufferToTexture({ buffer, ...textureDataLayout }, textureCopyView, size);

        this.expectValidationError(() => {
          this.device.defaultQueue.submit([encoder.finish()]);
        }, !success);

        break;
      }
      case TestMethod.CopyTextureToBuffer: {
        const buffer = this.device.createBuffer({
          mappedAtCreation: false,
          size: dataSize,
          usage: GPUBufferUsage.COPY_DST,
        });

        const encoder = this.device.createCommandEncoder();
        encoder.copyTextureToBuffer(
          textureCopyView,
          {
            buffer,
            offset: textureDataLayout.offset,
            bytesPerRow: textureDataLayout.bytesPerRow,
            rowsPerImage: textureDataLayout.rowsPerImage,
          },
          size
        );

        this.expectValidationError(() => {
          this.device.defaultQueue.submit([encoder.finish()]);
        }, !success);

        break;
      }
    }
  }

  // This is a helper function used for creating a texture when we don't have to be very
  // precise about its size as long as it's big enough and properly aligned.
  createAlignedTexture(
    format: GPUTextureFormat,
    copySize: GPUExtent3DDict = { width: 1, height: 1, depth: 1 }
  ): GPUTexture {
    return this.device.createTexture({
      size: {
        width: Math.max(1, copySize.width) * kTextureFormatInfo[format].blockWidth,
        height: Math.max(1, copySize.height) * kTextureFormatInfo[format].blockHeight,
        depth: Math.max(1, copySize.depth),
      },
      format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });
  }
}

// For testing divisibility by a number we test all the values returned by this function:
export function valuesToTestDivisibilityBy(number: number): number[] {
  const values = [];
  for (let i = 0; i <= 2 * number; ++i) {
    values.push(i);
  }
  values.push(3 * number);
  return values;
}
