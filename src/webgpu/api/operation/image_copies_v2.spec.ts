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
  kTextureInitMethods,
} from '../../util/texture/create.js';

/**
 * - PartialCopyT2B: do CopyT2B to check that the part of the texture we copied to with InitMethod
 *   matches the data we were copying and that we don't overwrite any data in the target buffer that
 *   we're not supposed to - that's primarily for testing CopyT2B functionality.
 * - FullCopyT2B: do CopyT2B on the whole texture and check wether the part we copied to matches
 *   the data we were copying and that the nothing else was modified - that's primarily for testing
 *   WriteTexture and CopyB2T.
 */
type TextureCheckMethod = 'FullCopyT2B' | 'PartialCopyT2B';
const kTextureCheckMethods = ['FullCopyT2B', 'PartialCopyT2B'] as const;

class F extends GPUTest {
  uploadTextureAndVerifyCopy(
    { initMethod, checkMethod }: { initMethod: TextureInitMethod; checkMethod: TextureCheckMethod },
    // TODO: Expand to EncodableTextureFormat
    textureDesc: GPUTextureDescriptor & { format: RegularTextureFormat },
    layout: GPUImageDataLayout,
    region: Omit<GPUImageCopyTexture, 'texture'>,
    copySize: GPUExtent3D
  ) {
    const testData = arbitraryTextureData(textureDesc.format);
    // XXX: doesn't make sense to use createTextureWithData here, the init IS what's being tested.
    const texture = createTextureWithData(this.device, initMethod, textureDesc, testData);
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
      .combine(poptions('checkMethod', kTextureCheckMethods))
      .combine(poptions('initMethod', kTextureInitMethods))
      .combine(poptions('format', ['rgba8unorm', 'r8snorm', 'r16float', 'rgba32float'] as const))
  )
  .subcases(() =>
    params()
      .combine(poptions('bytesPerRow', [256, undefined]))
      .combine(
        poptions('copySize', [
          [1, 1, 1],
          [3, 1, 1],
          [0, 1, 1],
          [3, 0, 1],
          [3, 1, 0],
        ])
      )
  )
  .fn(t => {
    const { format, initMethod, checkMethod, bytesPerRow } = t.params;

    t.uploadTextureAndVerifyCopy(
      { initMethod, checkMethod },
      {
        size: [100, 3, 3],
        format,
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
      },
      { offset: 0, bytesPerRow, rowsPerImage: 256 },
      { mipLevel: 0, origin: [1, 1, 1] },
      [3, 1, 1]
    );
  });
