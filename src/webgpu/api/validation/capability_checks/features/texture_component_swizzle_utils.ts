import { PerTexelComponent } from '../../../../util/texture/texel_data.js';

declare global {
  // MAINTENANCE_TODO: Remove these types once texture-component-swizzle is added to @webgpu/types
  /* prettier-ignore */
  type GPUComponentSwizzle =
    | 'zero' // Force its value to 0.
    | 'one'  // Force its value to 1.
    | 'r'    // Take its value from the red channel of the texture.
    | 'g'    // Take its value from the green channel of the texture.
    | 'b'    // Take its value from the blue channel of the texture.
    | 'a'    // Take its value from the alpha channel of the texture.
    ;

  type GPUTextureComponentSwizzle = {
    r?: GPUComponentSwizzle;
    g?: GPUComponentSwizzle;
    b?: GPUComponentSwizzle;
    a?: GPUComponentSwizzle;
  };

  interface GPUTextureViewDescriptor {
    swizzle?: GPUTextureComponentSwizzle | undefined;
  }
}

// Note: There are 4 settings with 7 options each including undefined
// which is 2401 combinations. So we don't check them all. Just a few below.
export const kSwizzleTests = [
  'uuuu',
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
  'ubga',
  'ruga',
  'rbua',
  'rbgu',
] as const;
export type SwizzleSpec = (typeof kSwizzleTests)[number];

const kSwizzleLetterToComponent: Record<string, GPUComponentSwizzle | undefined> = {
  u: undefined,
  r: 'r',
  g: 'g',
  b: 'b',
  a: 'a',
  '0': 'zero',
  '1': 'one',
} as const;

const kComponents = ['r', 'g', 'b', 'a'] as const;

export function swizzleSpecToGPUTextureComponentSwizzle(spec: string): GPUTextureComponentSwizzle {
  const swizzle: Record<string, string> = {};
  kComponents.forEach((component, i) => {
    const v = kSwizzleLetterToComponent[spec[i]];
    if (v) {
      swizzle[component] = v;
    }
  });
  return swizzle as GPUTextureComponentSwizzle;
}

function swizzleComponentToTexelComponent(
  src: PerTexelComponent<number>,
  component: GPUComponentSwizzle
): number {
  switch (component) {
    case 'zero':
      return 0;
    case 'one':
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
    R: swizzle.r ? swizzleComponentToTexelComponent(src, swizzle.r) : src.R,
    G: swizzle.g ? swizzleComponentToTexelComponent(src, swizzle.g) : src.G,
    B: swizzle.b ? swizzleComponentToTexelComponent(src, swizzle.b) : src.B,
    A: swizzle.a ? swizzleComponentToTexelComponent(src, swizzle.a) : src.A,
  };
}

export function isIdentitySwizzle(swizzle: GPUTextureComponentSwizzle): boolean {
  return (
    (swizzle.r === undefined || swizzle.r === 'r') &&
    (swizzle.g === undefined || swizzle.g === 'g') &&
    (swizzle.b === undefined || swizzle.b === 'b') &&
    (swizzle.a === undefined || swizzle.a === 'a')
  );
}

function normalizeSwizzle(swizzle: GPUTextureComponentSwizzle): GPUTextureComponentSwizzle {
  return {
    r: swizzle.r ?? 'r',
    g: swizzle.g ?? 'g',
    b: swizzle.b ?? 'b',
    a: swizzle.a ?? 'a',
  };
}

export function swizzlesAreTheSame(
  a: GPUTextureComponentSwizzle,
  b: GPUTextureComponentSwizzle
): boolean {
  a = normalizeSwizzle(a);
  b = normalizeSwizzle(b);
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}
