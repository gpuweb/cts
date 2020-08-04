export const description = `
writeTexture validation tests.
`;

import { kTextureFormatInfo } from '../../capability_info.js';

import { ValidationTest } from './validation_test.js';

export enum TestMethod {
  WriteTexture = 'WriteTexture',
  CopyBufferToTexture = 'CopyBufferToTexture',
  CopyTextureToBuffer = 'CopyTextureToBuffer',
}

export class CopyBetweenLinearDataAndTextureTest extends ValidationTest {
  bytesInACompleteRow(copyWidth: number, format: GPUTextureFormat): number {
    return kTextureFormatInfo[format].bytesPerBlock * copyWidth / kTextureFormatInfo[format].blockWidth;
  }

  requiredBytesInCopy(layout: GPUTextureDataLayout, format: GPUTextureFormat, copyExtent: GPUExtent3DDict): number {
    if (copyExtent.width == 0 || copyExtent.height == 0 || copyExtent.depth == 0) {
      return 0;
    } else {
      const texelBlockRowsPerImage = layout.rowsPerImage / kTextureFormatInfo[format].blockHeight;
      const bytesPerImage = layout.bytesPerRow * texelBlockRowsPerImage;
      const bytesInLastSlice =
        layout.bytesPerRow * (copyExtent.height / kTextureFormatInfo[format].blockHeight - 1) +
        (copyExtent.width / kTextureFormatInfo[format].blockWidth * kTextureFormatInfo[format].bytesPerBlock);
      return bytesPerImage * (copyExtent.depth - 1) + bytesInLastSlice;
    }
  }

  testRun(
    textureCopyView: GPUTextureCopyView,
    textureDataLayout: GPUTextureDataLayout,
    size: GPUExtent3D,
    { dataSize, method, success }: { dataSize: number, method: TestMethod, success: Boolean }
  ): void {
     switch (method) {
      case TestMethod.WriteTexture: {
        const data = new Uint8Array(dataSize);
        
        this.expectValidationError(() => {
          this.device.defaultQueue.writeTexture(
            textureCopyView, data, textureDataLayout, size
          );
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
        encoder.copyBufferToTexture(
          { buffer: buffer, offset: textureDataLayout.offset, bytesPerRow: textureDataLayout.bytesPerRow, rowsPerImage: textureDataLayout.rowsPerImage },
          textureCopyView,
          size
        );

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
          { buffer: buffer, offset: textureDataLayout.offset, bytesPerRow: textureDataLayout.bytesPerRow, rowsPerImage: textureDataLayout.rowsPerImage },
          size
        );

        this.expectValidationError(() => {
          this.device.defaultQueue.submit([encoder.finish()]);
        }, !success);

        break;
      }
    }
  }
}

export const kTestValuesForDivisibilityBy4 = [1, 2, 3, 4, 6, 8, 12];
