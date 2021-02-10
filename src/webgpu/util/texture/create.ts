import { assert, unreachable } from '../../../common/framework/util/util.js';
import {
  EncodableTextureFormat,
  kEncodableTextureFormatInfo,
  RegularTextureFormat,
} from '../../capability_info.js';
import { makeBufferWithContents } from '../buffer.js';
import { align } from '../math.js';
import { standardizeExtent3D } from '../unions.js';
import { dataBytesForCopy } from './image_copy.js';
import { physicalMipSize } from './subresource.js';
import { ComponentInfo, kTexelRepresentationInfo } from './texel_data.js';

type Texel = readonly [number, number?, number?, number?];
export type DataCallback = (pos: {
  readonly mip: number;
  readonly coords: readonly [number, number, number];
  readonly uv: readonly [number, number, number];
}) => Texel;

// TODO: expand with CopyT2T, RenderPassStore, RenderPassResolve, CopyImageBitmapToTexture, ...?
export type TextureInitMethod = 'WriteTexture' | 'CopyB2T';
export const kTextureInitMethods = ['WriteTexture', 'CopyB2T'];

class TextureInitAccumulator {
  private device: GPUDevice;
  private buffers: GPUBuffer[] = [];
  private encoder: GPUCommandEncoder | undefined;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  write(
    method: TextureInitMethod,
    destination: GPUImageCopyTexture,
    layout: GPUImageDataLayout,
    sizeAtLevel: GPUExtent3DDict,
    bytes: Uint8Array
  ): void {
    if (method === 'CopyB2T') {
      this.encoder ??= this.device.createCommandEncoder();

      const buffer = makeBufferWithContents(this.device, bytes, GPUBufferUsage.COPY_SRC);
      this.buffers.push(buffer);

      this.encoder.copyBufferToTexture({ buffer, ...layout }, destination, sizeAtLevel);
    } else if (method === 'WriteTexture') {
      this.device.queue.writeTexture(destination, bytes, layout, sizeAtLevel);
    } else {
      unreachable();
    }
  }

  finish(): void {
    if (this.encoder) {
      this.device.queue.submit([this.encoder.finish()]);
    }
    for (const buffer of this.buffers) {
      buffer.destroy();
    }
  }
}

/**
 * Returns a "representative" range (and integer-ness) for a component type/length.
 * For int/norm, returns the full range.
 * For floats (which have big limits), picks some range bigger than 1.0.
 */
export function representativeRangeForComponent({
  dataType,
  bitLength,
}: ComponentInfo): { min: number; max: number; integral: boolean } {
  assert(bitLength <= 32);
  switch (dataType) {
    case 'uint':
      return { min: 0, max: 2 ** bitLength - 1, integral: true };
    case 'sint':
      const absMin = 2 ** (bitLength - 1);
      return { min: -absMin, max: absMin - 1, integral: true };
    case 'unorm':
      return { min: 0, max: 1, integral: false };
    case 'float':
      return { min: -1, max: 1, integral: false };
    case 'ufloat':
      return { min: 0, max: 10, integral: false };
    case 'snorm':
      return { min: -10, max: 10, integral: false };
  }
  unreachable();
}

export function arbitraryTextureData(format: EncodableTextureFormat): DataCallback {
  const rep = kTexelRepresentationInfo[format];
  const gen = (component: ComponentInfo | undefined, v: number) => {
    if (!component) return 0;
    const { min, max, integral } = representativeRangeForComponent(component);
    return integral //
      ? Math.round(Math.sin(v) ** 2 * (max - min) + min)
      : Math.sin(v) ** 2 * (max - min) + min;
  };

  return ({ mip, uv: [x, y, z] }) => [
    gen(rep.componentInfo.R, mip + 0.2 + x * 2 + y * 3 + z * 5),
    gen(rep.componentInfo.G, mip + 0.4 + x * 2 + y * 3 + z * 5),
    gen(rep.componentInfo.B, mip + 0.6 + x * 2 + y * 3 + z * 5),
    gen(rep.componentInfo.A, mip + 0.8 + x * 2 + y * 3 + z * 5),
  ];
}

export function createTextureWithData(
  device: GPUDevice,
  method: TextureInitMethod,
  // TODO: Expand to EncodableTextureFormat
  desc: GPUTextureDescriptor & { format: RegularTextureFormat },
  data: DataCallback
): GPUTexture {
  const info = kEncodableTextureFormatInfo[desc.format];
  // Creating compressed textures requires pre-compressed data for each block, not color values.
  assert(info.blockWidth === 1 && info.blockHeight === 1);

  const size = standardizeExtent3D(desc.size);
  const mipLevelCount = desc.mipLevelCount ?? 1;
  const rep = kTexelRepresentationInfo[desc.format];

  let toComponents;
  if (info.color) {
    assert(!info.depth && !info.stencil);
    toComponents = ([R, G, B, A]: Texel) => ({ R, G, B, A });
  } else {
    unreachable();
  }

  const texture = device.createTexture(desc);

  const accumulator = new TextureInitAccumulator(device);
  for (let mip = 0; mip < mipLevelCount; ++mip) {
    const mipLevelSize = physicalMipSize(size, desc.format, desc.dimension ?? '2d', mip);
    const bytesPerRow = align(mipLevelSize.width * info.bytesPerBlock, 256);
    assert(mipLevelSize.height % info.blockHeight === 0);
    const rowsPerImage = mipLevelSize.height / info.blockHeight;

    const { minDataSize, valid } = dataBytesForCopy(
      { bytesPerRow, rowsPerImage },
      desc.format,
      mipLevelSize,
      // validate against the most conservative image layout rules
      { method: 'CopyB2T' }
    );
    assert(valid);

    const bytes = new Uint8Array(minDataSize);

    for (let z = 0; z < mipLevelSize.depth; ++z) {
      for (let y = 0; y < mipLevelSize.height; ++y) {
        for (let x = 0; x < mipLevelSize.width; ++x) {
          const coords = [x, y, z] as const;
          const uv = [
            x / mipLevelSize.width,
            y / mipLevelSize.height,
            z / mipLevelSize.depth,
          ] as const;
          const texel = toComponents(data({ mip, coords, uv }));
          const texelBytes = new Uint8Array(rep.pack(rep.encode(texel)));

          const offset = (z * rowsPerImage + y) * bytesPerRow + x * info.bytesPerBlock;
          bytes.set(texelBytes, offset);
        }
      }
    }

    console.log(bytes);
    accumulator.write(method, { texture }, { bytesPerRow, rowsPerImage }, mipLevelSize, bytes);
  }
  accumulator.finish();

  return texture;
}
