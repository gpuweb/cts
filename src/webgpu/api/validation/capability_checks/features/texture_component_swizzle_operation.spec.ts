export const description = `
Operational tests for the 'texture-component-swizzle' feature.

Test that:
* when the feature is on, swizzling is applied correctly.

TODO:
* test stencil aspect of depth-stencil formats
* test texture_depth_xxx with textureSample
* test texture_2d<f32> with textureGatherCompare
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { assert, range } from '../../../../../common/util/util.js';
import {
  isSintOrUintFormat,
  isDepthOrStencilTextureFormat,
  kAllTextureFormats,
  isDepthTextureFormat,
  getBlockInfoForTextureFormat,
} from '../../../../format_info.js';
import { AllFeaturesMaxLimitsGPUTest } from '../../../../gpu_test.js';
import {
  applyCompareToTexel,
  chooseTextureSize,
  convertPerTexelComponentToResultFormat,
  createTextureWithRandomDataAndGetTexels,
  getTextureFormatTypeInfo,
  isBuiltinComparison,
  isBuiltinGather,
  isFillable,
  TextureBuiltin,
} from '../../../../shader/execution/expression/call/builtin/texture_utils.js';
import * as ttu from '../../../../texture_test_utils.js';
import { PerTexelComponent, TexelComponent } from '../../../../util/texture/texel_data.js';
import { TexelView } from '../../../../util/texture/texel_view.js';

import {
  kSwizzleTests,
  swizzlesAreTheSame,
  swizzleSpecToGPUTextureComponentSwizzle,
  swizzleTexel,
} from './texture_component_swizzle_utils.js';

function isChannelImplementationDefined(
  func: TextureBuiltin,
  channel: number,
  component: GPUComponentSwizzle
): boolean {
  if (component === 'zero' || component === 'one') {
    return false;
  }

  if (isBuiltinGather(func)) {
    return channel > 0;
  }

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

// This returns a validMask vec4u for if a channel is valid (1) or not-valid (0)
// and for each channel that is not-valid it returns the value we will expect the
// shader to write. The shader chooses either the value sampled/read if valid, OR
// the altResult if not valid. For depth and stencil textures, G, B, and A are not
// valid.
export function makeValidMaskAndAltResultForFormatSwizzle(
  swizzle: GPUTextureComponentSwizzle,
  format: GPUTextureFormat,
  func: TextureBuiltin,
  channel: number
) {
  if (!isDepthOrStencilTextureFormat(format)) {
    return {
      validMask: [1, 1, 1, 1],
      altResult: [0, 0, 0, 0],
    };
  }
  return {
    validMask: [
      isChannelImplementationDefined(func, channel, swizzle.r ?? 'r') ? 0 : 1,
      isChannelImplementationDefined(func, channel, swizzle.g ?? 'g') ? 0 : 1,
      isChannelImplementationDefined(func, channel, swizzle.b ?? 'b') ? 0 : 1,
      isChannelImplementationDefined(func, channel, swizzle.a ?? 'a') ? 0 : 1,
    ],
    altResult: [
      altResultForSwizzle(swizzle.r ?? 'r'),
      altResultForSwizzle(swizzle.g ?? 'g'),
      altResultForSwizzle(swizzle.b ?? 'b'),
      altResultForSwizzle(swizzle.a ?? 'a'),
    ],
  };
}

function applyValidMask(
  texel: PerTexelComponent<number>,
  validMask: ReturnType<typeof makeValidMaskAndAltResultForFormatSwizzle>
): PerTexelComponent<number> {
  return {
    R: validMask.validMask[0] ? texel.R : validMask.altResult[0],
    G: validMask.validMask[1] ? texel.G : validMask.altResult[1],
    B: validMask.validMask[2] ? texel.B : validMask.altResult[2],
    A: validMask.validMask[3] ? texel.A : validMask.altResult[3],
  };
}

const kTextureBuiltinFunctions = [
  'textureGather',
  'textureGatherCompare',
  'textureLoad',
  'textureSample',
  'textureSampleBias',
  // 'textureSampleCompare',          // returns f32, can't swizzle
  // 'textureSampleCompareLevel',     // returns f32, can't swizzle
  'textureSampleGrad',
  'textureSampleLevel',
  // 'textureSampleBaseClampToEdge',  // tested separately, no format
] as const;

function canUseBuiltinFuncWithFormat(func: TextureBuiltin, format: GPUTextureFormat) {
  if (isSintOrUintFormat(format)) {
    return func === 'textureGather' || func === 'textureLoad';
  } else if (!isDepthTextureFormat(format)) {
    return (
      func !== 'textureGatherCompare' &&
      func !== 'textureSampleCompare' &&
      func !== 'textureSampleCompareLevel'
    );
  } else {
    return true;
  }
}

function canUseBuiltinFuncInStage(func: TextureBuiltin, stage: 'compute' | 'fragment' | 'vertex') {
  if (stage === 'fragment') {
    return true;
  }
  return func === 'textureLoad' || func === 'textureSampleLevel';
}

function channelIndexToTexelComponent(channel: number): TexelComponent {
  switch (channel) {
    case 0:
      return TexelComponent.R;
    case 1:
      return TexelComponent.G;
    case 2:
      return TexelComponent.B;
    case 3:
      return TexelComponent.A;
    default:
      throw new Error(`Invalid channel index: ${channel}`);
  }
}

function getColorByChannelIndex(texel: PerTexelComponent<number>, channel: number): number {
  const component = channelIndexToTexelComponent(channel);
  const v = texel[component];
  assert(v !== undefined);
  return v;
}

function gather(
  srcColors: PerTexelComponent<number>[],
  channel: number
): PerTexelComponent<number> {
  //   texel gather offsets
  // r [0, 1] 2
  // g [1, 1] 3
  // b [1, 0] 1
  // a [0, 0] 0
  return {
    R: getColorByChannelIndex(srcColors[2], channel),
    G: getColorByChannelIndex(srcColors[3], channel),
    B: getColorByChannelIndex(srcColors[1], channel),
    A: getColorByChannelIndex(srcColors[0], channel),
  };
}

const kGatherComponentOrder = ['B', 'A', 'R', 'G'] as const;

type PipelineCache = Map<string, GPUComputePipeline | GPURenderPipeline>;
const s_deviceToPipelines = new WeakMap<GPUDevice, PipelineCache>();

export const g = makeTestGroup(AllFeaturesMaxLimitsGPUTest);

g.test('read_swizzle')
  .desc(
    `
  Test reading textures with swizzles.
  * Test that multiple swizzles of the same texture work.
  * Test that multiple swizzles of the same fails in compat if the swizzles are different.
  `
  )
  .params(
    u =>
      u
        .combine('format', kAllTextureFormats)
        .filter(t => isFillable(t.format))
        .combine('func', kTextureBuiltinFunctions)
        .beginSubcases()
        .expand('channel', function* (t) {
          if (isBuiltinGather(t.func)) {
            yield 0;
            yield 1;
            yield 2;
            yield 3;
          } else {
            yield 0;
          }
        })
        .expand('compare', function* (t) {
          if (isBuiltinComparison(t.func)) {
            yield 'less';
            yield 'greater';
          } else {
            yield 'always';
          }
        })
        .filter(t => canUseBuiltinFuncWithFormat(t.func, t.format))
        .combine('stage', ['compute', 'fragment', 'vertex'] as const)
        .filter(t => canUseBuiltinFuncInStage(t.func, t.stage))
        .combine('swizzleSpec', kSwizzleTests)
        .combine('otherSwizzleIndexOffset', [0, 1, 5]) // used to choose a different 2nd swizzle. 0 = same swizzle as 1st
  )
  .fn(async t => {
    // MAINTENANCE_TODO: Remove this cast once texture-component-swizzle is added to @webgpu/types
    t.skipIfDeviceDoesNotHaveFeature('texture-component-swizzle' as GPUFeatureName);
    const { format, stage, func, channel, compare, swizzleSpec, otherSwizzleIndexOffset } =
      t.params;
    t.skipIfTextureFormatNotSupported(format);

    const depthRef = 0.5;
    const size = chooseTextureSize({ minSize: 2, minBlocks: 2, format });
    const { blockWidth, blockHeight } = getBlockInfoForTextureFormat(format);
    // Choose a texture coordinate that will cross a block boundary for gather.
    // This is because we only create solid color blocks for some formats so we
    // won't get a different color per channel unless we sample across blocks.
    const tx = blockWidth - 0.4;
    const ty = blockHeight - 0.4;
    const descriptor: GPUTextureDescriptor = {
      format,
      size,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    };
    const { texels: srcTexelView, texture } = await createTextureWithRandomDataAndGetTexels(
      t,
      descriptor
    );
    const samples = [];
    const srcColors = range(4, i => {
      const x = (tx | 0) + (i % 2);
      const y = (ty | 0) + ((i / 2) | 0);

      const sample = srcTexelView[0].color({ x, y, z: 0 });
      samples.push(sample);
      return convertPerTexelComponentToResultFormat(sample, format);
    });
    t.debug(
      () => `samples:
${srcColors.map((c, i) => `${i % 2}, ${(i / 2) | 0}, ${JSON.stringify(c)}`).join('\n')}`
    );

    const srcColor = isBuiltinGather(func) ? gather(srcColors, channel) : srcColors[0];

    const {
      componentType,
      resultType,
      sampleType: srcSampleType,
      resultFormat: expFormat,
    } = getTextureFormatTypeInfo(format);

    const otherSwizzleSpec =
      kSwizzleTests[
        (kSwizzleTests.indexOf(swizzleSpec) + otherSwizzleIndexOffset) % kSwizzleTests.length
      ];
    // BA  in a 2x2 texel area this is
    // RG  the order of gather.
    t.debug(
      () => `\
swizzleSpec: ${swizzleSpec}, otherSwizzleSpec: ${otherSwizzleSpec}, channel: ${channel}, compare: ${compare}
srcColors:
${srcColors
  .map((c, i) => `${i % 2}, ${(i / 2) | 0}, ${JSON.stringify(c)} ${kGatherComponentOrder[i]}`)
  .join('\n')}
`
    );

    const data = [swizzleSpec, otherSwizzleSpec].map(swizzleSpec => {
      const swizzle = swizzleSpecToGPUTextureComponentSwizzle(swizzleSpec);
      const validMask = makeValidMaskAndAltResultForFormatSwizzle(swizzle, format, func, channel);
      const swizzledColor = applyValidMask(swizzleTexel(srcColor, swizzle), validMask);

      const components = [TexelComponent.R, TexelComponent.G, TexelComponent.B, TexelComponent.A];
      const expColor = isBuiltinComparison(func)
        ? applyCompareToTexel(components, swizzledColor, compare, depthRef)
        : swizzledColor;

      const expTexelView = TexelView.fromTexelsAsColors(expFormat, _coords => expColor);
      const aspect = isDepthTextureFormat(format) ? 'depth-only' : 'all';
      const textureView = texture.createView({ swizzle, aspect });
      return { swizzle, expColor, expFormat, expTexelView, textureView, validMask };
    });
    t.debug(
      () => `expColors:
${data
  .map(({ expColor }, i) => `${i % 2}, ${(i / 2) | 0}, ${JSON.stringify(expColor)}`)
  .join('\n')}`
    );

    const loadWGSL = ((func: TextureBuiltin) => {
      switch (func) {
        case 'textureGather':
          t.skipIf(true, func);
          return (v: number) => `textureGather(tex${v}, smp, uni.texCoord)`;
        case 'textureGatherCompare':
          return (v: number) => `textureGatherCompare(tex${v}, smp, uni.texCoord, ${depthRef})`;
        case 'textureLoad':
          return (v: number) =>
            `textureLoad(tex${v}, vec2u(uni.texCoord * vec2f(textureDimensions(tex${v}))), 0)`;
        case 'textureSample':
          return (v: number) => `textureSample(tex${v}, smp, uni.texCoord)`;
        case 'textureSampleBias':
          return (v: number) => `textureSampleBias(tex${v}, smp, uni.texCoord, 0)`;
        case 'textureSampleGrad':
          return (v: number) => `textureSampleGrad(tex${v}, smp, uni.texCoord, vec2f(0), vec2f(0))`;
        case 'textureSampleLevel':
          return (v: number) => `textureSampleLevel(tex${v}, smp, uni.texCoord, 0)`;
        default:
          throw new Error(`Unsupported texture builtin function: ${func}`);
      }
    })(func);

    const [textureType, samplerWGSL] = isBuiltinComparison(func)
      ? ['texture_depth_2d', 'sampler_comparison']
      : [`texture_2d<${componentType}>`, 'sampler'];
    const code = `
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

      struct Uniforms {
        validMasks: array<ValidMaskAndAltResult, 2>,
        texCoord: vec2f,
      };

      // These are intentionally in different bindGroups to test in compat that different swizzles
      // of the same texture are not allowed.
      @group(0) @binding(0) var tex0: ${textureType};
      @group(1) @binding(0) var tex1: ${textureType};
      @group(0) @binding(1) var smp: ${samplerWGSL};
      @group(0) @binding(2) var<uniform> uni: Uniforms;
      @group(0) @binding(3) var result: texture_storage_2d<${expFormat}, write>;

      fn maskMix(v: ${resultType}, maskAlt: ValidMaskAndAltResult) -> ${resultType} {
        let alt = ${resultType}(maskAlt.altResult);
        return ${resultType}(
          select(alt.x, v.x, maskAlt.validMask.x != 0u),
          select(alt.y, v.y, maskAlt.validMask.y != 0u),
          select(alt.z, v.z, maskAlt.validMask.z != 0u),
          select(alt.w, v.w, maskAlt.validMask.w != 0u),
        );
      }

      ${
        stage === 'vertex'
          ? `
      struct VSToFS {
        @builtin(position) pos: vec4f,
        @location(0) @interpolate(flat, either) c0: ${resultType},
        @location(1) @interpolate(flat, either) c1: ${resultType},
      };

      @vertex fn vsVSResults() -> VSToFS {
        let c0 = maskMix(${loadWGSL(0)}, uni.validMasks[0]);
        let c1 = maskMix(${loadWGSL(1)}, uni.validMasks[1]);
        return VSToFS(vec4f(0, 0, 0, 1), c0, c1);
      }

      @fragment fn fsVSResults(input: VSToFS) -> @location(0) vec4f {
        textureStore(result, vec2u(0, 0), input.c0);
        textureStore(result, vec2u(1, 0), input.c1);
        return vec4f(0, 0, 0, 1);
      }

      `
          : ''
      }

      // ----

      ${
        stage === 'fragment'
          ? `

      @vertex fn vsFSResults() -> @builtin(position) vec4f {
        return vec4f(0, 0, 0, 1);
      }

      @fragment fn fsFSResults() -> @location(0) vec4f {
        let c0 = maskMix(${loadWGSL(0)}, uni.validMasks[0]);
        let c1 = maskMix(${loadWGSL(1)}, uni.validMasks[1]);
        textureStore(result, vec2u(0, 0), c0);
        textureStore(result, vec2u(1, 0), c1);
        return vec4f(0, 0, 0, 1);
      }
      `
          : ''
      }

      // ----

      ${
        stage === 'compute'
          ? `

      @compute @workgroup_size(1) fn cs() {
        let c0 = maskMix(${loadWGSL(0)}, uni.validMasks[0]);
        let c1 = maskMix(${loadWGSL(1)}, uni.validMasks[1]);
        textureStore(result, vec2u(0, 0), c0);
        textureStore(result, vec2u(1, 0), c1);
      }
      `
          : ''
      }
    `;

    const sampleType =
      srcSampleType === 'depth'
        ? isBuiltinComparison(func)
          ? 'depth'
          : 'unfilterable-float'
        : srcSampleType;
    const samplerType = isBuiltinComparison(func) ? 'comparison' : 'non-filtering';

    const pipelineId = `${sampleType}:${samplerType}${code}`;
    const cache = s_deviceToPipelines.get(t.device) ?? new Map();
    s_deviceToPipelines.set(t.device, cache);
    let pipeline = cache.get(pipelineId);
    if (!pipeline) {
      const module = t.device.createShaderModule({ code });

      const bgl0 = t.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
            texture: {
              sampleType,
            },
          },
          {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
            sampler: {
              type: samplerType,
            },
          },
          {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
            buffer: {},
          },
          {
            binding: 3,
            visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
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
            visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
            texture: {
              sampleType,
            },
          },
        ],
      });

      const layout = t.device.createPipelineLayout({
        bindGroupLayouts: [bgl0, bgl1],
      });

      switch (stage) {
        case 'compute':
          pipeline = t.device.createComputePipeline({
            layout,
            compute: { module },
          });
          break;
        case 'fragment':
        case 'vertex':
          pipeline = t.device.createRenderPipeline({
            layout,
            vertex: { module },
            fragment: { module, targets: [{ format: 'rgba8unorm' }] },
            primitive: { topology: 'point-list' },
          });
      }
      cache.set(pipelineId, pipeline);
    }

    const outputTexture = t.createTextureTracked({
      format: expFormat,
      size: [2],
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
    });

    const sampler = t.device.createSampler(
      isBuiltinComparison(func)
        ? {
            compare,
          }
        : {}
    );

    const uniformBuffer = t.createBufferTracked({
      size: (4 * 2 * 2 + 2 + 2) * 4, // vec4u * 2 * 2 + vec2f + padding
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const uniformValues = new ArrayBuffer(uniformBuffer.size);
    const asU32 = new Uint32Array(uniformValues);
    const asF32 = new Float32Array(uniformValues);
    asU32.set(data.map(({ validMask }) => [...validMask.validMask, ...validMask.altResult]).flat());
    asF32.set([tx / texture.width, ty / texture.height], 16);
    t.device.queue.writeBuffer(uniformBuffer, 0, new Uint32Array(uniformValues));

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
    switch (stage) {
      case 'compute': {
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup0);
        pass.setBindGroup(1, bindGroup1);
        pass.dispatchWorkgroups(1);
        pass.end();
        break;
      }
      case 'fragment':
      case 'vertex': {
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: t.createTextureTracked({
                format: 'rgba8unorm',
                size: [1],
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
              }),
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup0);
        pass.setBindGroup(1, bindGroup1);
        pass.draw(1);
        pass.end();
        break;
      }
    }

    if (t.isCompatibility && !swizzlesAreTheSame(data[0].swizzle, data[1].swizzle)) {
      // Swizzles can not be different in compatibility mode
      t.expectValidationError(() => {
        t.device.queue.submit([encoder.finish()]);
      });
    } else {
      t.device.queue.submit([encoder.finish()]);

      data.forEach(({ expTexelView }, i) => {
        t.debug(() => `${i}: ${JSON.stringify(data[i].validMask)}`);

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
