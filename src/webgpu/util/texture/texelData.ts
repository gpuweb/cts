import { assert, unreachable } from '../../../common/framework/util/util.js';
import {
  EncodableTextureFormat,
  kEncodableTextureFormatInfo,
  kUncompressedTextureFormatInfo,
  UncompressedTextureFormat,
} from '../../capability_info.js';
import {
  assertInIntegerRange,
  float32ToFloatBits,
  floatAsNormalizedInteger,
  gammaCompress,
  encodeRGB9E5UFloat,
  normalizedIntegerAsFloat,
  gammaDecompress,
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

// Converts a data value to its representation in a shader
type DecodeFn = (value: number) => number;

interface SingleComponentInfo {
  decode: DecodeFn;
  write: TexelWriteFn;
  bitLength: number;
}

type TexelComponentInfo = PerTexelComponent<null | SingleComponentInfo>;

const kR = [TexelComponent.R];
const kRG = [TexelComponent.R, TexelComponent.G];
const kRGB = [TexelComponent.R, TexelComponent.G, TexelComponent.B];
const kRGBA = [TexelComponent.R, TexelComponent.G, TexelComponent.B, TexelComponent.A];
const kBGRA = [TexelComponent.B, TexelComponent.G, TexelComponent.R, TexelComponent.A];

const unorm = (bitLength: number) => (n: number) => ({
  value: floatAsNormalizedInteger(n, bitLength, false),
  type: TexelWriteType.Uint,
});

const snorm = (bitLength: number) => (n: number) => ({
  value: floatAsNormalizedInteger(n, bitLength, true),
  type: TexelWriteType.Sint,
});

const uint = (bitLength: number) => (n: number) => ({
  value: (assertInIntegerRange(n, bitLength, false), n),
  type: TexelWriteType.Uint,
});

const sint = (bitLength: number) => (n: number) => ({
  value: (assertInIntegerRange(n, bitLength, true), n),
  type: TexelWriteType.Sint,
});

const decodeUnorm = (bitLength: number) => (n: number) =>
  normalizedIntegerAsFloat(n, bitLength, false);
const decodeSnorm = (bitLength: number) => (n: number) =>
  normalizedIntegerAsFloat(n, bitLength, true);
const identity = (n: number) => n;

const unorm2 = { decode: decodeUnorm(2), write: unorm(2), bitLength: 2 };
const unorm8 = { decode: decodeUnorm(8), write: unorm(8), bitLength: 8 };
const unorm10 = { decode: decodeUnorm(10), write: unorm(10), bitLength: 10 };

const snorm8 = { decode: decodeSnorm(8), write: snorm(8), bitLength: 8 };

const uint8 = { decode: identity, write: uint(8), bitLength: 8 };
const uint16 = { decode: identity, write: uint(16), bitLength: 16 };
const uint32 = { decode: identity, write: uint(32), bitLength: 32 };

const sint8 = { decode: identity, write: sint(8), bitLength: 8 };
const sint16 = { decode: identity, write: sint(16), bitLength: 16 };
const sint32 = { decode: identity, write: sint(32), bitLength: 32 };

const float10 = {
  decode: identity,
  write: (n: number) => ({
    value: float32ToFloatBits(n, 0, 5, 5, 15),
    type: TexelWriteType.Uint,
  }),
  bitLength: 10,
};

const float11 = {
  decode: identity,
  write: (n: number) => ({
    value: float32ToFloatBits(n, 0, 5, 6, 15),
    type: TexelWriteType.Uint,
  }),
  bitLength: 11,
};

const float16 = {
  decode: identity,
  write: (n: number) => ({
    value: float32ToFloatBits(n, 1, 5, 10, 15),
    type: TexelWriteType.Uint,
  }),
  bitLength: 16,
};

const float32 = {
  decode: identity,
  write: (n: number) => ({
    value: Math.fround(n),
    type: TexelWriteType.Float,
  }),
  bitLength: 32,
};

const componentUnimplemented = {
  decode: identity,
  write: () => {
    unreachable('TexelComponentInfo not implemented for this texture format');
  },
  bitLength: 0,
};

const repeatComponents = (
  componentOrder: TexelComponent[],
  perComponentInfo: SingleComponentInfo
) => {
  const componentInfo = componentOrder.reduce((acc, curr) => {
    return Object.assign(acc, {
      [curr]: perComponentInfo,
    });
  }, {});

  return {
    componentOrder,
    componentInfo,
  };
};

const kRepresentationInfo: {
  // TODO: Figure out if/how to extend this to more texture formats
  [k in UncompressedTextureFormat]: {
    componentOrder: TexelComponent[];
    componentInfo: TexelComponentInfo;
    sRGB: boolean;
    // Add fields as needed
  };
} = /* prettier-ignore */ {
  'r8unorm':                { ...repeatComponents(   kR,  unorm8), sRGB: false },
  'r8snorm':                { ...repeatComponents(   kR,  snorm8), sRGB: false },
  'r8uint':                 { ...repeatComponents(   kR,   uint8), sRGB: false },
  'r8sint':                 { ...repeatComponents(   kR,   sint8), sRGB: false },
  'r16uint':                { ...repeatComponents(   kR,  uint16), sRGB: false },
  'r16sint':                { ...repeatComponents(   kR,  sint16), sRGB: false },
  'r16float':               { ...repeatComponents(   kR, float16), sRGB: false },
  'rg8unorm':               { ...repeatComponents(  kRG,  unorm8), sRGB: false },
  'rg8snorm':               { ...repeatComponents(  kRG,  snorm8), sRGB: false },
  'rg8uint':                { ...repeatComponents(  kRG,   uint8), sRGB: false },
  'rg8sint':                { ...repeatComponents(  kRG,   sint8), sRGB: false },
  'r32uint':                { ...repeatComponents(   kR,  uint32), sRGB: false },
  'r32sint':                { ...repeatComponents(   kR,  sint32), sRGB: false },
  'r32float':               { ...repeatComponents(   kR, float32), sRGB: false },
  'rg16uint':               { ...repeatComponents(  kRG,  uint16), sRGB: false },
  'rg16sint':               { ...repeatComponents(  kRG,  sint16), sRGB: false },
  'rg16float':              { ...repeatComponents(  kRG, float16), sRGB: false },

  'rgba8unorm':             { ...repeatComponents(kRGBA,  unorm8), sRGB: false },
  'rgba8unorm-srgb':        { ...repeatComponents(kRGBA,  unorm8), sRGB:  true },
  'rgba8snorm':             { ...repeatComponents(kRGBA,  snorm8), sRGB: false },
  'rgba8uint':              { ...repeatComponents(kRGBA,   uint8), sRGB: false },
  'rgba8sint':              { ...repeatComponents(kRGBA,   sint8), sRGB: false },
  'bgra8unorm':             { ...repeatComponents(kBGRA,  unorm8), sRGB: false },
  'bgra8unorm-srgb':        { ...repeatComponents(kBGRA,  unorm8), sRGB:  true },
  'rg32uint':               { ...repeatComponents(  kRG,  uint32), sRGB: false },
  'rg32sint':               { ...repeatComponents(  kRG,  sint32), sRGB: false },
  'rg32float':              { ...repeatComponents(  kRG, float32), sRGB: false },
  'rgba16uint':             { ...repeatComponents(kRGBA,  uint16), sRGB: false },
  'rgba16sint':             { ...repeatComponents(kRGBA,  sint16), sRGB: false },
  'rgba16float':            { ...repeatComponents(kRGBA, float16), sRGB: false },
  'rgba32uint':             { ...repeatComponents(kRGBA,  uint32), sRGB: false },
  'rgba32sint':             { ...repeatComponents(kRGBA,  sint32), sRGB: false },
  'rgba32float':            { ...repeatComponents(kRGBA, float32), sRGB: false },

  'rgb10a2unorm':           { componentOrder: kRGBA, componentInfo: { R: unorm10, G: unorm10, B: unorm10, A: unorm2 }, sRGB: false },
  'rg11b10ufloat':          { componentOrder: kRGB, componentInfo: { R: float11, G: float11, B: float10 }, sRGB: false },
  // TODO: the e5 is shared between all components; figure out how to write it.
  'rgb9e5ufloat':           { componentOrder: kRGB, componentInfo: { R: componentUnimplemented, G: componentUnimplemented, B: componentUnimplemented }, sRGB: false },

  'depth32float':           { componentOrder: [TexelComponent.Depth], componentInfo: { Depth: float32 }, sRGB: false },
  'depth24plus':            { componentOrder: [TexelComponent.Depth], componentInfo: { Depth: null }, sRGB: false },
  'depth24plus-stencil8':   { componentOrder: [TexelComponent.Depth, TexelComponent.Stencil], componentInfo: { Depth: null, Stencil: null }, sRGB: false },
};

export interface TexelDataRepresentation {
  readonly componentOrder: TexelComponent[];
  readonly componentInfo: TexelComponentInfo;

  // Gets the data representation for |components| where |components| is the expected
  // values when read in a shader. i.e. Passing in 1.0 for a 8-bit unorm component will
  // yield 255.
  getBytes(components: { [c in TexelComponent]?: number }): ArrayBuffer;

  // Pack texel components into the packed byte representation. This may round values, but
  // does not do unorm <-> float conversion.
  packData(components: { [c in TexelComponent]?: number }): ArrayBuffer;

  // Decode data into the shader representation
  decode(components: { [c in TexelComponent]?: number }): { [c in TexelComponent]?: number };
}

class TexelDataRepresentationImpl implements TexelDataRepresentation {
  // TODO: Determine endianness of the GPU data?
  private isGPULittleEndian = true;

  constructor(
    private readonly format: UncompressedTextureFormat,
    readonly componentOrder: TexelComponent[],
    readonly componentInfo: TexelComponentInfo,
    private readonly sRGB: boolean
  ) {}

  private totalBitLength(): number {
    return this.componentOrder.reduce((acc, curr) => {
      return acc + this.componentInfo[curr]!.bitLength;
    }, 0);
  }

  private writeTexelData(
    data: ArrayBuffer,
    bitOffset: number,
    bitLength: number,
    type: TexelWriteType,
    value: number
  ) {
    switch (type) {
      case TexelWriteType.Float: {
        const byteOffset = Math.floor(bitOffset / 8);
        const byteLength = Math.ceil(bitLength / 8);
        assert(byteOffset === bitOffset / 8 && byteLength === bitLength / 8);
        switch (byteLength) {
          case 4:
            new DataView(data, byteOffset, byteLength).setFloat32(0, value, this.isGPULittleEndian);
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
            new DataView(data, byteOffset, byteLength).setInt16(0, value, this.isGPULittleEndian);
            break;
          case 4:
            new DataView(data, byteOffset, byteLength).setInt32(0, value, this.isGPULittleEndian);
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
              new DataView(data, byteOffset, byteLength).setUint16(
                0,
                value,
                this.isGPULittleEndian
              );
              break;
            case 4:
              new DataView(data, byteOffset, byteLength).setUint32(
                0,
                value,
                this.isGPULittleEndian
              );
              break;
            default:
              unreachable();
          }
        } else {
          // Packed representations are all 32-bit and use Uint as the data type.
          // ex.) rg10b11float, rgb10a2unorm
          switch (this.totalBitLength()) {
            case 32: {
              const view = new DataView(data);
              const currentValue = view.getUint32(0, this.isGPULittleEndian);

              let mask = 0xffffffff;
              const bitsToClearRight = bitOffset;
              const bitsToClearLeft = 32 - (bitLength + bitOffset);

              mask = (mask >>> bitsToClearRight) << bitsToClearRight;
              mask = (mask << bitsToClearLeft) >>> bitsToClearLeft;

              const newValue = (currentValue & ~mask) | (value << bitOffset);

              view.setUint32(0, newValue, this.isGPULittleEndian);
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

  private getComponentBitOffset(component: TexelComponent): number {
    const componentIndex = this.componentOrder.indexOf(component);
    assert(componentIndex !== -1);
    return this.componentOrder.slice(0, componentIndex).reduce((acc, curr) => {
      const componentInfo = this.componentInfo[curr];
      assert(!!componentInfo);
      return acc + componentInfo.bitLength;
    }, 0);
  }

  private setComponent(data: ArrayBuffer, component: TexelComponent, n: number): void {
    const bitOffset = this.getComponentBitOffset(component);
    const componentInfo = this.componentInfo[component];
    assert(!!componentInfo);
    const { write, bitLength } = componentInfo;

    const { value, type } = write(n);
    this.writeTexelData(data, bitOffset, bitLength, type, value);
  }

  private setComponentBytes(data: ArrayBuffer, component: TexelComponent, value: number): void {
    assert(this.format in kEncodableTextureFormatInfo);
    const format = this.format as EncodableTextureFormat;

    const componentInfo = this.componentInfo[component];
    assert(!!componentInfo);

    const bitOffset = this.getComponentBitOffset(component);
    const { bitLength } = componentInfo;

    switch (kEncodableTextureFormatInfo[format].dataType) {
      case 'float':
      case 'ufloat':
        // Use the shader encoding which can pack floats as uint data.
        this.setComponent(data, component, value);
        break;
      case 'snorm':
      case 'sint': {
        this.writeTexelData(data, bitOffset, bitLength, TexelWriteType.Sint, value);
        break;
      }
      case 'unorm':
      case 'uint': {
        this.writeTexelData(data, bitOffset, bitLength, TexelWriteType.Uint, value);
        break;
      }
    }
  }

  getBytes(components: PerTexelComponent<number>): ArrayBuffer {
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

    const bytesPerBlock = kUncompressedTextureFormatInfo[this.format].bytesPerBlock;
    assert(!!bytesPerBlock);

    if (this.format === 'rgb9e5ufloat') {
      assert(this.componentOrder.length === 3);
      assert(this.componentOrder[0] === TexelComponent.R);
      assert(this.componentOrder[1] === TexelComponent.G);
      assert(this.componentOrder[2] === TexelComponent.B);
      assert(bytesPerBlock === 4);
      assert(components.R !== undefined);
      assert(components.G !== undefined);
      assert(components.B !== undefined);

      const buf = new ArrayBuffer(bytesPerBlock);
      new DataView(buf).setUint32(
        0,
        encodeRGB9E5UFloat(components.R, components.G, components.B),
        this.isGPULittleEndian
      );
      return buf;
    }

    const data = new ArrayBuffer(bytesPerBlock);
    for (const c of this.componentOrder) {
      const componentValue = components[c];
      assert(componentValue !== undefined);
      this.setComponent(data, c, componentValue);
    }
    return data;
  }

  packData(components: PerTexelComponent<number>): ArrayBuffer {
    const bytesPerBlock = kUncompressedTextureFormatInfo[this.format].bytesPerBlock;
    assert(!!bytesPerBlock);

    if (this.format === 'rgb9e5ufloat') {
      assert(this.componentOrder.length === 3);
      assert(this.componentOrder[0] === TexelComponent.R);
      assert(this.componentOrder[1] === TexelComponent.G);
      assert(this.componentOrder[2] === TexelComponent.B);
      assert(bytesPerBlock === 4);
      assert(components.R !== undefined);
      assert(components.G !== undefined);
      assert(components.B !== undefined);

      const buf = new ArrayBuffer(bytesPerBlock);
      new DataView(buf).setUint32(
        0,
        encodeRGB9E5UFloat(components.R, components.G, components.B),
        this.isGPULittleEndian
      );
      return buf;
    }

    const data = new ArrayBuffer(bytesPerBlock);
    for (const c of this.componentOrder) {
      const componentValue = components[c];
      assert(componentValue !== undefined);
      this.setComponentBytes(data, c, componentValue);
    }
    return data;
  }

  decode(components: PerTexelComponent<number>): PerTexelComponent<number> {
    const values: PerTexelComponent<number> = {};
    for (const c of this.componentOrder) {
      const componentValue = components[c];
      const info = this.componentInfo[c];
      assert(componentValue !== undefined);
      assert(!!info);
      values[c] = info.decode(componentValue);
    }
    if (this.sRGB) {
      assert('R' in values && values.R !== undefined);
      assert('G' in values && values.G !== undefined);
      assert('B' in values && values.B !== undefined);
      [values.R, values.G, values.B] = [
        gammaDecompress(values.R),
        gammaDecompress(values.G),
        gammaDecompress(values.B),
      ];
    }
    return values;
  }
}

const kRepresentationCache: Map<UncompressedTextureFormat, TexelDataRepresentationImpl> = new Map();
export function getTexelDataRepresentation(
  format: UncompressedTextureFormat
): TexelDataRepresentation {
  if (!kRepresentationCache.has(format)) {
    const { componentOrder, componentInfo, sRGB } = kRepresentationInfo[format];
    kRepresentationCache.set(
      format,
      new TexelDataRepresentationImpl(format, componentOrder, componentInfo, sRGB)
    );
  }
  return kRepresentationCache.get(format)!;
}
