import { C, assert, unreachable } from '../../../common/framework/index.js';
import { kTextureFormatInfo } from '../../capability_info.js';
import {
  assertInIntegerRange,
  float32ToFloatBits,
  floatAsNormalizedInteger,
  gammaCompress,
} from '../conversion.js';

export const enum TexelComponent {
  R = 'R',
  G = 'G',
  B = 'B',
  A = 'A',
  Depth = 'Depth',
  Stencil = 'Stencil',
}

export type PerTexelComponent<T> = { [c in TexelComponent]?: T };

const enum TexelWriteType {
  Sint,
  Uint,
  Float,
}

// Function to convert a value into a texel value. It returns the converted value
// and the type of the converted value. For example, conversion may convert:
//  - floats to unsigned normalized integers
//  - floats to half floats, interpreted as uint16 bits
type TexelWriteFn = (value: number) => { value: number; type: TexelWriteType };

type TexelComponentInfo = PerTexelComponent<{
  write?: TexelWriteFn; // |write| may be omitted if data is not writable. This is the case
  // for packed depth formats.
  bitLength: number;
}>;

const kComponentOrderR = [TexelComponent.R];
const kComponentOrderRG = [TexelComponent.R, TexelComponent.G];
const kComponentOrderRGB = [TexelComponent.R, TexelComponent.G, TexelComponent.B];
const kComponentOrderRGBA = [
  TexelComponent.R,
  TexelComponent.G,
  TexelComponent.B,
  TexelComponent.A,
];
const kComponentOrderBGRA = [
  TexelComponent.B,
  TexelComponent.G,
  TexelComponent.R,
  TexelComponent.A,
];

export interface TexelDataRepresentation {
  componentOrder: TexelComponent[];
  componentInfo: TexelComponentInfo;
  getBytes(components: { [c in TexelComponent]?: number }): ArrayBuffer;
}

class TexelDataRepresentationImpl implements TexelDataRepresentation {
  private constructor(
    private readonly format: GPUTextureFormat,
    readonly componentOrder: TexelComponent[],
    readonly componentInfo: TexelComponentInfo,
    private readonly sRGB: boolean = false
  ) {}

  static Create(format: GPUTextureFormat): TexelDataRepresentationImpl {
    switch (format) {
      case C.TextureFormat.RGB10A2Unorm: {
        const write10 = (n: number) => ({
          value: floatAsNormalizedInteger(n, 10, false),
          type: TexelWriteType.Uint,
        });
        const write2 = (n: number) => ({
          value: floatAsNormalizedInteger(n, 2, false),
          type: TexelWriteType.Uint,
        });

        return new TexelDataRepresentationImpl(format, kComponentOrderRGBA, {
          R: { bitLength: 10, write: write10 },
          G: { bitLength: 10, write: write10 },
          B: { bitLength: 10, write: write10 },
          A: { bitLength: 2, write: write2 },
        });
      }

      case C.TextureFormat.RGB11B10Float: {
        const write11 = (n: number) => ({
          value: float32ToFloatBits(n, 0, 5, 6, 15),
          type: TexelWriteType.Uint,
        });
        const write10 = (n: number) => ({
          value: float32ToFloatBits(n, 0, 5, 5, 15),
          type: TexelWriteType.Uint,
        });

        return new TexelDataRepresentationImpl(format, kComponentOrderRGB, {
          R: { bitLength: 11, write: write11 },
          G: { bitLength: 11, write: write11 },
          B: { bitLength: 10, write: write10 },
        });
      }

      case C.TextureFormat.Depth32Float: {
        return new TexelDataRepresentationImpl(format, [TexelComponent.Depth], {
          Depth: {
            bitLength: 32,
            write: (n: number) => ({
              value: n,
              type: TexelWriteType.Float,
            }),
          },
        });
      }

      case C.TextureFormat.Depth24Plus: {
        return new TexelDataRepresentationImpl(format, [TexelComponent.Depth], {
          Depth: {
            bitLength: 32,
          },
        });
      }

      case C.TextureFormat.Depth24PlusStencil8: {
        return new TexelDataRepresentationImpl(
          format,
          [TexelComponent.Depth, TexelComponent.Stencil],
          {
            Depth: {
              bitLength: 24,
            },
            Stencil: {
              bitLength: 8,
              write: (n: number) => ({
                value: (assertInIntegerRange(n, 8, false), n),
                type: TexelWriteType.Uint,
              }),
            },
          }
        );
      }

      default:
        break;
    }

    const m = format.match(/([rgba]+)(\d+)(snorm|unorm|uint|sint|float)(-srgb)?/);
    assert(m !== null);

    const bitLength = parseInt(m[2], 10);
    const componentType = m[3];
    const sRGB = m[4] !== undefined;

    let componentOrder: TexelComponent[];
    switch (m[1]) {
      case 'r':
        componentOrder = kComponentOrderR;
        break;
      case 'rg':
        componentOrder = kComponentOrderRG;
        break;
      case 'rgb':
        componentOrder = kComponentOrderRGB;
        break;
      case 'rgba':
        componentOrder = kComponentOrderRGBA;
        break;
      case 'bgra':
        componentOrder = kComponentOrderBGRA;
        break;
      default:
        unreachable();
    }

    let texelWriteType: TexelWriteType;
    let convert: (n: number) => number;
    switch (componentType) {
      case 'sint': {
        texelWriteType = TexelWriteType.Sint;
        convert = (n: number) => (assertInIntegerRange(n, bitLength, true), n);
        break;
      }
      case 'uint': {
        texelWriteType = TexelWriteType.Uint;
        convert = (n: number) => (assertInIntegerRange(n, bitLength, false), n);
        break;
      }
      case 'snorm': {
        texelWriteType = TexelWriteType.Sint;
        convert = (n: number) => floatAsNormalizedInteger(n, bitLength, true);
        break;
      }
      case 'unorm': {
        texelWriteType = TexelWriteType.Uint;
        convert = (n: number) => floatAsNormalizedInteger(n, bitLength, false);
        break;
      }
      case 'float': {
        switch (bitLength) {
          case 16:
            texelWriteType = TexelWriteType.Uint;
            convert = (n: number) => float32ToFloatBits(n, 1, 5, 10, 15);
            break;
          case 32:
            texelWriteType = TexelWriteType.Float;
            convert = (n: number) => Math.fround(n);
            break;
          default:
            unreachable();
        }
        break;
      }
      default:
        unreachable();
    }

    const write = (n: number) => ({
      value: convert(n),
      type: texelWriteType,
    });

    const componentInfo = {
      R: { bitLength, write },
      G: { bitLength, write },
      B: { bitLength, write },
      A: { bitLength, write },
    };

    return new TexelDataRepresentationImpl(format, componentOrder, componentInfo, sRGB);
  }

  private totalBitLength(): number {
    return this.componentOrder.reduce((acc, curr) => {
      return acc + this.componentInfo[curr]!.bitLength;
    }, 0);
  }

  private setComponent(data: ArrayBuffer, component: TexelComponent, n?: number): void {
    const componentIndex = this.componentOrder.indexOf(component);
    assert(componentIndex !== -1);
    const bitOffset = this.componentOrder.slice(0, componentIndex).reduce((acc, curr) => {
      return acc + this.componentInfo[curr]!.bitLength;
    }, 0);
    const bitLength = this.componentInfo[component]!.bitLength;

    const write = this.componentInfo[component]!.write;
    if (write === undefined) {
      // Ignore components that are not writable (packed depth).
      return;
    }
    assert(n !== undefined);
    const { value, type } = write(n);
    switch (type) {
      case TexelWriteType.Float: {
        const byteOffset = Math.floor(bitOffset / 8);
        const byteLength = Math.ceil(bitLength / 8);
        assert(byteOffset === bitOffset / 8 && byteLength === bitLength / 8);
        switch (byteLength) {
          case 4:
            new DataView(data, byteOffset, byteLength).setFloat32(0, value, true);
            break;
          default:
            unreachable();
        }
        break;
      }
      case TexelWriteType.Sint: {
        const byteOffset = Math.floor(bitOffset / 8);
        const byteLength = Math.ceil(bitLength / 8);
        assert(byteOffset === bitOffset / 8 && byteLength === bitLength / 8);
        switch (byteLength) {
          case 1:
            new DataView(data, byteOffset, byteLength).setInt8(0, value);
            break;
          case 2:
            new DataView(data, byteOffset, byteLength).setInt16(0, value, true);
            break;
          case 4:
            new DataView(data, byteOffset, byteLength).setInt32(0, value, true);
            break;
          default:
            unreachable();
        }
        break;
      }
      case TexelWriteType.Uint: {
        const byteOffset = Math.floor(bitOffset / 8);
        const byteLength = Math.ceil(bitLength / 8);
        if (byteOffset === bitOffset / 8 && byteLength === bitLength / 8) {
          switch (byteLength) {
            case 1:
              new DataView(data, byteOffset, byteLength).setUint8(0, value);
              break;
            case 2:
              new DataView(data, byteOffset, byteLength).setUint16(0, value, true);
              break;
            case 4:
              new DataView(data, byteOffset, byteLength).setUint32(0, value, true);
              break;
            default:
              unreachable();
          }
        } else {
          // Packed representations are all 32-bit and use Uint as the data type.
          switch (this.totalBitLength()) {
            case 32: {
              const view = new DataView(data);
              const currentValue = view.getUint32(0, true);

              let mask = 0xffffffff;
              mask = (mask >> bitOffset) << bitOffset;
              mask = (mask << (32 - (bitLength + bitOffset))) >> (32 - (bitLength + bitOffset));

              const newValue = (currentValue & ~mask) | (value << bitOffset);

              view.setUint32(0, newValue, true);
              break;
            }
            default:
              unreachable();
          }
        }
        break;
      }
      default:
        unreachable();
    }
  }

  getBytes(components: { [c in TexelComponent]?: number }): ArrayBuffer {
    if (this.sRGB) {
      components = Object.assign({}, components);
      assert(components.R !== undefined);
      assert(components.G !== undefined);
      assert(components.B !== undefined);
      [components.R, components.G, components.B] = [
        gammaCompress(components.R),
        gammaCompress(components.G),
        gammaCompress(components.B),
      ];
    }

    const data = new ArrayBuffer(kTextureFormatInfo[this.format].bytes);
    for (const c of this.componentOrder) {
      this.setComponent(data, c, components[c]);
    }
    return data;
  }
}

const kRepresentationCache: Map<GPUTextureFormat, TexelDataRepresentationImpl> = new Map();
export function getTexelDataRepresentation(format: GPUTextureFormat): TexelDataRepresentation {
  if (!kRepresentationCache.has(format)) {
    kRepresentationCache.set(format, TexelDataRepresentationImpl.Create(format));
  }
  return kRepresentationCache.get(format)!;
}
