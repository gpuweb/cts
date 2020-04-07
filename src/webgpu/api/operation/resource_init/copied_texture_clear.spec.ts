export const description = `Test uninitialized textures are initialized to zero when copied.`;

import { C, TestGroup, assert, unreachable } from '../../../../common/framework/index.js';
import { fillTextureDataRows, getTextureCopyLayout } from '../../../util/texture/layout.js';
import { SubresourceRange } from '../../../util/texture/subresource.js';
import { getTexelDataRepresentation } from '../../../util/texture/texelData.js';

import { InitializedState, ReadMethod, TextureZeroInitTest } from './texture_zero_init_test.js';

class CopiedTextureClearTest extends TextureZeroInitTest {
  private checkTextureSliceByBufferCopy(
    texture: GPUTexture,
    state: InitializedState,
    width: number,
    height: number,
    level: number,
    layer: number
  ): void {
    const { byteLength, bytesPerRow, bytesPerTexel } = getTextureCopyLayout(this.params.format, {
      width,
      height,
      depth: 1,
    });

    const buffer = this.device.createBuffer({
      size: byteLength,
      usage: C.BufferUsage.CopySrc | C.BufferUsage.CopyDst,
    });

    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyTextureToBuffer(
      { texture, mipLevel: level, arrayLayer: layer },
      {
        buffer,
        bytesPerRow,
        rowsPerImage: height,
        // @ts-ignore
        rowPitch: bytesPerRow,
        imageHeight: height,
      },
      { width, height, depth: 1 }
    );
    this.queue.submit([commandEncoder.finish()]);

    const expectedTexelData = new Uint8Array(
      getTexelDataRepresentation(this.params.format).getBytes(this.stateToTexelComponents[state])
    );
    assert(expectedTexelData.byteLength === bytesPerTexel);

    const arrayBuffer = new ArrayBuffer(byteLength);
    fillTextureDataRows(arrayBuffer, [width, height, 1], expectedTexelData);

    this.expectContents(buffer, new Uint8Array(arrayBuffer));
  }

  private checkContentsByBufferCopy(
    texture: GPUTexture,
    state: InitializedState,
    subresourceRange: SubresourceRange
  ): void {
    for (const { level, slice } of subresourceRange.each()) {
      assert(this.params.dimension === '2d');

      const width = this.textureWidth >> level;
      const height = this.textureHeight >> level;

      this.checkTextureSliceByBufferCopy(texture, state, width, height, level, slice);
    }
  }

  private checkContentsByTextureCopy(
    texture: GPUTexture,
    state: InitializedState,
    subresourceRange: SubresourceRange
  ): void {
    for (const { level, slice } of subresourceRange.each()) {
      assert(this.params.dimension === '2d');

      const width = this.textureWidth >> level;
      const height = this.textureHeight >> level;

      const dst = this.device.createTexture({
        size: [width, height, 1],
        format: this.params.format,
        usage: C.TextureUsage.CopyDst | C.TextureUsage.CopySrc,
      });

      const commandEncoder = this.device.createCommandEncoder();
      commandEncoder.copyTextureToTexture(
        { texture, mipLevel: level, arrayLayer: slice },
        { texture: dst, mipLevel: 0, arrayLayer: 0 },
        { width, height, depth: 1 }
      );
      this.queue.submit([commandEncoder.finish()]);

      this.checkTextureSliceByBufferCopy(dst, state, width, height, 0, 0);
    }
  }

  checkContents(
    texture: GPUTexture,
    state: InitializedState,
    subresourceRange: SubresourceRange
  ): void {
    switch (this.params.readMethod) {
      case ReadMethod.CopyToBuffer:
        this.checkContentsByBufferCopy(texture, state, subresourceRange);
        break;

      case ReadMethod.CopyToTexture:
        this.checkContentsByTextureCopy(texture, state, subresourceRange);
        break;

      default:
        unreachable();
    }
  }
}

export const g = new TestGroup(CopiedTextureClearTest);

g.test('uninitialized texture is zero', t => {
  t.run();
}).params(TextureZeroInitTest.generateParams([ReadMethod.CopyToBuffer, ReadMethod.CopyToTexture]));
