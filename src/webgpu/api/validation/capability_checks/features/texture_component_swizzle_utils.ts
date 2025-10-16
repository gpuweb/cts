import { PerTexelComponent } from '../../../../util/texture/texel_data.js';

declare global {
  type GPUComponentSwizzle = 'r' | 'g' | 'b' | 'a' | '0' | '1';

  // Note this is a four-character string that only includes `"r"`, `"g"`, `"b"`, `"a"`, `"0"`, or `"1"`.
  type GPUTextureComponentSwizzle = string;
}

// Note: There are 4 settings with 6 options which is 1296 combinations. So we don't check them all. Just a few below.
export const kSwizzleTests = [
  'rgba',
  '0000',
  '1111',
  'rrrr',
  'gggg',
  'bbbb',
  'aaaa',
  'abgr',
  'gbar',
  'barg',
  'argb',
  '0gba',
  'r0ba',
  'rg0a',
  'rgb0',
  '1gba',
  'r1ba',
  'rg1a',
  'rgb1',
] as const;
export type SwizzleSpec = (typeof kSwizzleTests)[number];

function swizzleComponentToTexelComponent(
  src: PerTexelComponent<number>,
  component: GPUComponentSwizzle
): number {
  switch (component) {
    case '0':
      return 0;
    case '1':
      return 1;
    case 'r':
      return src.R!;
    case 'g':
      return src.G!;
    case 'b':
      return src.B!;
    case 'a':
      return src.A!;
  }
}

export function swizzleTexel(
  src: PerTexelComponent<number>,
  swizzle: GPUTextureComponentSwizzle
): PerTexelComponent<number> {
  return {
    R: swizzle[0]
      ? swizzleComponentToTexelComponent(src, swizzle[0] as GPUComponentSwizzle)
      : src.R,
    G: swizzle[1]
      ? swizzleComponentToTexelComponent(src, swizzle[1] as GPUComponentSwizzle)
      : src.G,
    B: swizzle[2]
      ? swizzleComponentToTexelComponent(src, swizzle[2] as GPUComponentSwizzle)
      : src.B,
    A: swizzle[3]
      ? swizzleComponentToTexelComponent(src, swizzle[3] as GPUComponentSwizzle)
      : src.A,
  };
}

export function isIdentitySwizzle(swizzle: GPUTextureComponentSwizzle): boolean {
  return swizzle === 'rgba';
}
