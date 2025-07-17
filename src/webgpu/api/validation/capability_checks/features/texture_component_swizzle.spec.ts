export const description = `
Tests for capability checking for the 'texture-component-swizzle' feature.

Test that when the feature is off, swizzling is not allowed, even the identity swizzle.
When the feature is on, swizzling is applied correctly.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUConst } from '../../../../constants.js';
import {
  EncodableTextureFormat,
  isDepthOrStencilTextureFormat,
  isDepthTextureFormat,
  isSintOrUintFormat,
  isStencilTextureFormat,
} from '../../../../format_info.js';
import { UniqueFeaturesOrLimitsGPUTest } from '../../../../gpu_test.js';
import { convertPerTexelComponentToResultFormat } from '../../../../shader/execution/expression/call/builtin/texture_utils.js';
import * as ttu from '../../../../texture_test_utils.js';
import { PerTexelComponent } from '../../../../util/texture/texel_data.js';
import { TexelView } from '../../../../util/texture/texel_view.js';
import { createTextureFromTexelViews } from '../../../../util/texture.js';

export const g = makeTestGroup(UniqueFeaturesOrLimitsGPUTest);

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

declare global {
  interface GPUTextureViewDescriptor {
    swizzle?: GPUTextureComponentSwizzle | undefined;
  }
}

// Note: There are 4 settings with 7 options each including undefined
// which is 2401 combinations. So we don't check them all. Just a few below.
const kSwizzleTests = [
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

function swizzleSpecToGPUTextureComponentSwizzle(spec: string): GPUTextureComponentSwizzle {
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

function swizzleTexel(
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

function isIdentitySwizzle(swizzle: GPUTextureComponentSwizzle): boolean {
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

function swizzlesAreTheSame(a: GPUTextureComponentSwizzle, b: GPUTextureComponentSwizzle): boolean {
  a = normalizeSwizzle(a);
  b = normalizeSwizzle(b);
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

function isChannelImplementationDefined(component: GPUComponentSwizzle | undefined): boolean {
  return component === 'g' || component === 'b' || component === 'a';
}

function altResultForSwizzle(component: GPUComponentSwizzle): number {
  switch (component) {
    case 'zero':
      return 0;
    case 'one':
      return 1;
    case 'r':
      return 0;
    case 'g':
      return 0;
    case 'b':
      return 0;
    case 'a':
      return 1;
  }
}

// This returns a vec4u for if a channel is valid (1) or not-valid (0)
// and for each channel that is not-valid it returns the value we will expect.
function makeValidMaskAndAltResultForFormatSwizzle(
  swizzle: GPUTextureComponentSwizzle,
  format: GPUTextureFormat
) {
  if (!isDepthOrStencilTextureFormat(format)) {
    return {
      validMask: [1, 1, 1, 1],
      altResult: [0, 0, 0, 0],
    };
  }
  return {
    validMask: [
      isChannelImplementationDefined(swizzle.r ?? 'r') ? 0 : 1,
      isChannelImplementationDefined(swizzle.g ?? 'g') ? 0 : 1,
      isChannelImplementationDefined(swizzle.b ?? 'b') ? 0 : 1,
      isChannelImplementationDefined(swizzle.a ?? 'a') ? 0 : 1,
    ],
    altResult: [
      altResultForSwizzle(swizzle.r ?? 'r'),
      altResultForSwizzle(swizzle.g ?? 'g'),
      altResultForSwizzle(swizzle.b ?? 'b'),
      altResultForSwizzle(swizzle.a ?? 'a'),
    ],
  };
}

g.test('no_swizzle')
  .desc(
    `
  Test that if texture-component-swizzle is not enabled, having a swizzle property generates a validation error.
  `
  )
  .fn(t => {
    const texture = t.createTextureTracked({
      format: 'rgba8unorm',
      size: [1],
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    });
    t.expectValidationError(() => {
      texture.createView({ swizzle: {} });
    });
  });

g.test('no_render_nor_storage')
  .desc(
    `
  Test that setting the swizzle on the texture with RENDER_ATTACHMENT or STORAGE_BINDING usage works
  if the swizzle is the identity but generates a validation error otherwise.
  `
  )
  .params(u =>
    u
      .combine('usage', [
        GPUConst.TextureUsage.COPY_SRC,
        GPUConst.TextureUsage.COPY_DST,
        GPUConst.TextureUsage.TEXTURE_BINDING,
        GPUConst.TextureUsage.RENDER_ATTACHMENT,
        GPUConst.TextureUsage.STORAGE_BINDING,
      ] as const)
      .beginSubcases()
      .combine('swizzleSpec', kSwizzleTests)
  )
  .beforeAllSubcases(t => {
    // MAINTENANCE_TODO: Remove this cast once texture-component-swizzle is added to @webgpu/types
    t.selectDeviceOrSkipTestCase('texture-component-swizzle' as GPUFeatureName);
  })
  .fn(t => {
    const { swizzleSpec, usage } = t.params;
    const swizzle = swizzleSpecToGPUTextureComponentSwizzle(swizzleSpec);
    const texture = t.createTextureTracked({
      format: 'rgba8unorm',
      size: [1],
      usage,
    });
    const badUsage =
      (usage &
        (GPUConst.TextureUsage.RENDER_ATTACHMENT | GPUConst.TextureUsage.STORAGE_BINDING)) !==
      0;
    const shouldError = badUsage && !isIdentitySwizzle(swizzle);
    t.expectValidationError(() => {
      texture.createView({ swizzle });
    }, shouldError);
  });

g.test('read_swizzle')
  .desc(
    `
  Test reading textures with swizzles.
  * Test that multiple swizzles of the same texture work.
  * Test that multiple swizzles of the same fails in compat if the swizzles are different.
  `
  )
  .params(u =>
    u
      .combine('format', [
        'rgba8unorm',
        'bgra8unorm',
        'r8unorm',
        'rg8unorm',
        'r8uint',
        'rgba8uint',
        'depth16unorm',
        'stencil8',
      ] as const)
      .beginSubcases()
      .combine('sampled', [false, true] as const)
      .combine('swizzleSpec', kSwizzleTests)
      .combine('otherSwizzleIndexOffset', [0, 1, 5]) // used to choose a different 2nd swizzle. 0 = same swizzle as 1st
      .unless(t => isSintOrUintFormat(t.format) && t.sampled)
  )
  .beforeAllSubcases(t => {
    // MAINTENANCE_TODO: Remove this cast once texture-component-swizzle is added to @webgpu/types
    t.selectDeviceOrSkipTestCase('texture-component-swizzle' as GPUFeatureName);
  })
  .fn(t => {
    const { format, sampled, swizzleSpec, otherSwizzleIndexOffset } = t.params;

    const isIntFormat = isSintOrUintFormat(format);
    const srcColor = isDepthTextureFormat(format)
      ? { Depth: 0.5 }
      : isStencilTextureFormat(format)
      ? { Stencil: 123 }
      : isIntFormat
      ? { R: 20, G: 40, B: 60, A: 80 }
      : { R: 0.2, G: 0.4, B: 0.6, A: 0.8 };
    const srcTexelView = TexelView.fromTexelsAsColors(format, _coords => srcColor);

    const texture = createTextureFromTexelViews(t, [srcTexelView], {
      format,
      size: [1],
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    });

    const otherSwizzleSpec =
      kSwizzleTests[
        (kSwizzleTests.indexOf(swizzleSpec) + otherSwizzleIndexOffset) % kSwizzleTests.length
      ];
    t.debug(`swizzleSpec: ${swizzleSpec}, otherSwizzleSpec: ${otherSwizzleSpec}`);

    const expFormat: EncodableTextureFormat = isIntFormat ? 'rgba32uint' : 'rgba32float';
    const data = [swizzleSpec, otherSwizzleSpec].map(swizzleSpec => {
      const swizzle = swizzleSpecToGPUTextureComponentSwizzle(swizzleSpec);
      const expColor = swizzleTexel(
        convertPerTexelComponentToResultFormat(srcColor, format),
        swizzle
      );
      const validMask = makeValidMaskAndAltResultForFormatSwizzle(swizzle, format);
      const expTexelView = TexelView.fromTexelsAsColors(expFormat, _coords => expColor);
      const textureView = texture.createView({ swizzle });
      return { swizzle, expFormat, expTexelView, textureView, validMask };
    });

    const loadWGSL = sampled
      ? (v: number) => `textureSampleLevel(tex${v}, smp, vec2f(0), 0)`
      : (v: number) => `textureLoad(tex${v}, vec2u(0), 0)`;
    const typeWGSL = isIntFormat ? 'vec4u' : 'vec4f';
    const channelType = isIntFormat ? 'u32' : 'f32';
    const module = t.device.createShaderModule({
      code: `
        // from the spec: https://gpuweb.github.io/gpuweb/#reading-depth-stencil
        // depth and stencil values are D, ?, ?, ?
        // so for these formats, for each swizzle that references g, b, or a
        // we set validMask to 0 (0 = not valid). If that channel is not valid
        // we return the altResult for that channel. altResult is effectively
        // swizzle(vec4(0, 0, 0, 1)) since that is what is in expColor.

        struct ValidMaskAndAltResult {
          validMask: vec4u,
          altResult: vec4u,
        };

        // These are intentionally in different bindGroups to test in compat that different swizzles
        // of the same texture are not allowed.
        @group(0) @binding(0) var tex0: texture_2d<${channelType}>;
        @group(1) @binding(0) var tex1: texture_2d<${channelType}>;
        @group(0) @binding(1) var smp: sampler;
        @group(0) @binding(2) var<uniform> validMasks: array<ValidMaskAndAltResult, 2>;
        @group(0) @binding(3) var result: texture_storage_2d<${expFormat}, write>;

        fn maskMix(v: ${typeWGSL}, maskAlt: ValidMaskAndAltResult) -> ${typeWGSL} {
          let alt = ${typeWGSL}(maskAlt.altResult);
          return ${typeWGSL}(
            select(alt.x, v.x, maskAlt.validMask.x != 0u),
            select(alt.y, v.y, maskAlt.validMask.y != 0u),
            select(alt.z, v.z, maskAlt.validMask.z != 0u),
            select(alt.w, v.w, maskAlt.validMask.w != 0u),
          );
        }

        @compute @workgroup_size(1) fn cs() {
          _ = smp;
          let c0 = maskMix(${loadWGSL(0)}, validMasks[0]);
          let c1 = maskMix(${loadWGSL(1)}, validMasks[1]);
          textureStore(result, vec2u(0, 0), c0);
          textureStore(result, vec2u(1, 0), c1);
        }
      `,
    });

    const bgl0 = t.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          texture: {
            sampleType: isIntFormat ? 'uint' : 'unfilterable-float',
          },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          sampler: {
            type: 'non-filtering',
          },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {},
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
            format: expFormat,
          },
        },
      ],
    });

    const bgl1 = t.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          texture: {
            sampleType: isIntFormat ? 'uint' : 'unfilterable-float',
          },
        },
      ],
    });

    const layout = t.device.createPipelineLayout({
      bindGroupLayouts: [bgl0, bgl1],
    });

    const pipeline = t.device.createComputePipeline({
      layout,
      compute: { module },
    });

    const outputTexture = t.createTextureTracked({
      format: expFormat,
      size: [2],
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
    });

    const sampler = t.device.createSampler();

    const uniformBuffer = t.createBufferTracked({
      size: 4 * 2 * 2 * 4, // vec4u * 2 * 2
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const validMaskAndAltValue = data
      .map(({ validMask }) => [...validMask.validMask, ...validMask.altResult])
      .flat();
    t.device.queue.writeBuffer(uniformBuffer, 0, new Uint32Array(validMaskAndAltValue));

    const bindGroup0 = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: data[0].textureView },
        { binding: 1, resource: sampler },
        { binding: 2, resource: uniformBuffer },
        { binding: 3, resource: outputTexture },
      ],
    });

    const bindGroup1 = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(1),
      entries: [{ binding: 0, resource: data[1].textureView }],
    });

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup0);
    pass.setBindGroup(1, bindGroup1);
    pass.dispatchWorkgroups(1);
    pass.end();

    if (t.isCompatibility && !swizzlesAreTheSame(data[0].swizzle, data[1].swizzle)) {
      // Swizzles can not be different in compatibility mode
      t.expectValidationError(() => {
        t.device.queue.submit([encoder.finish()]);
      });
    } else {
      t.device.queue.submit([encoder.finish()]);

      data.forEach(({ expTexelView }, i) => {
        ttu.expectTexelViewComparisonIsOkInTexture(
          t,
          { texture: outputTexture, origin: [i, 0, 0] },
          expTexelView,
          [1, 1, 1],
          { maxFractionalDiff: 0.01 }
        );
      });
    }
  });
