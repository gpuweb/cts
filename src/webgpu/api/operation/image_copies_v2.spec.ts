export const description = `
writeTexture + copyBufferToTexture + copyTextureToBuffer operation tests.
`;

import { params, poptions } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import { unreachable } from '../../../common/framework/util/util.js';
import { RegularTextureFormat } from '../../capability_info.js';
import { GPUTest } from '../../gpu_test.js';
import {
  createTextureWithData,
  TextureInitMethod,
  arbitraryTextureData,
} from '../../util/texture/create.js';

/**
 * - PartialCopyT2B: do CopyT2B to check that the part of the texture we copied to with InitMethod
 *   matches the data we were copying and that we don't overwrite any data in the target buffer that
 *   we're not supposed to - that's primarily for testing CopyT2B functionality.
 * - FullCopyT2B: do CopyT2B on the whole texture and check wether the part we copied to matches
 *   the data we were copying and that the nothing else was modified - that's primarily for testing
 *   WriteTexture and CopyB2T.
 */
type CheckMethod = 'PartialCopyT2B' | 'FullCopyT2B';

/** Each combination of methods assume that the ones before it were tested and work correctly. */
const kMethodsToTest = [
  // We make sure that CopyT2B works when copying the whole texture for renderable formats:
  // TODO
  // Then we make sure that WriteTexture works for all formats:
  { initMethod: 'WriteTexture', checkMethod: 'FullCopyT2B' },
  // Then we make sure that CopyB2T works for all formats:
  { initMethod: 'CopyB2T', checkMethod: 'FullCopyT2B' },
  // Then we make sure that CopyT2B works for all formats:
  { initMethod: 'WriteTexture', checkMethod: 'PartialCopyT2B' },
] as const;

class F extends GPUTest {
  generateData(byteSize: number, start: number = 0): Uint8Array {
    const arr = new Uint8Array(byteSize);
    for (let i = 0; i < byteSize; ++i) {
      arr[i] = (i ** 3 + i + start) % 251;
    }
    return arr;
  }

  uploadTextureAndVerifyCopy(
    { initMethod, checkMethod }: { initMethod: TextureInitMethod; checkMethod: CheckMethod },
    // TODO: Expand to EncodableTextureFormat
    textureDesc: GPUTextureDescriptor & { format: RegularTextureFormat },
    layout: GPUImageDataLayout,
    region: Omit<GPUImageCopyTexture, 'texture'>,
    copySize: GPUExtent3D
  ) {
    const texture = createTextureWithData(
      this.device,
      initMethod,
      textureDesc,
      arbitraryTextureData(textureDesc.format)
    );
    const copyTexture: GPUImageCopyTexture = { texture, ...region };

    switch (checkMethod) {
      case 'PartialCopyT2B':
        unreachable('TODO');
      case 'FullCopyT2B':
        unreachable('TODO');
      default:
        unreachable();
    }
  }
}

export const g = makeTestGroup(F);

g.test('bytesPerRow_undefined')
  .desc(`Test the behavior when bytesPerRow is (validly) undefined is same as when it's defined`)
  .cases(
    params()
      .combine(kMethodsToTest)
      .combine(poptions('bytesPerRow', [256, undefined]))
  )
  .fn(t => {
    const { initMethod, checkMethod, bytesPerRow } = t.params;

    t.uploadTextureAndVerifyCopy(
      { initMethod, checkMethod },
      {
        size: [100, 3, 2],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
      },
      { offset: 0, bytesPerRow, rowsPerImage: 256 },
      { mipLevel: 0, origin: [0, 0, 0] },
      [3, 1, 1]
    );
  });
