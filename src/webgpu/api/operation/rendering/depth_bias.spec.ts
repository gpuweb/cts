export const description = `
Tests render results with different depth bias values like 'positive', 'negative', 'infinity',
'slope', 'clamp', etc.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { unreachable } from '../../../../common/util/util.js';
import { DepthStencilFormat, EncodableTextureFormat } from '../../../capability_info.js';
import { GPUTest } from '../../../gpu_test.js';
import { kValue } from '../../../util/constants.js';
import { TexelView } from '../../../util/texture/texel_view.js';
import { textureContentIsOKByT2B } from '../../../util/texture/texture_ok.js';

enum QuadAngle {
  Flat,
  TiltedX,
}

// Floating point depth buffers use the following formula to calculate bias
// bias = depthBias * 2 ** (exponent(max z of primitive) - number of bits in mantissa) +
//        slopeScale * maxSlope
// https://docs.microsoft.com/en-us/windows/win32/direct3d11/d3d10-graphics-programming-guide-output-merger-stage-depth-bias
// https://www.khronos.org/registry/vulkan/specs/1.2-extensions/man/html/vkCmdSetDepthBias.html
// https://developer.apple.com/documentation/metal/mtlrendercommandencoder/1516269-setdepthbias
//
// To get a final bias of 0.25 for primitives with z = 0.25, we can use
// depthBias = 0.25 / (2 ** (-2 - 23)) = 8388608.
const kPointTwoFiveBiasForPointTwoFiveZOnFloat = 8388608;

class DepthBiasTest extends GPUTest {
  runDepthBiasTest(
    depthFormat: EncodableTextureFormat & DepthStencilFormat,
    {
      quadAngle,
      bias,
      biasSlopeScale,
      biasClamp,
      expectedDepth,
    }: {
      quadAngle: QuadAngle;
      bias: number;
      biasSlopeScale: number;
      biasClamp: number;
      expectedDepth: number;
    }
  ) {
    const renderTargetFormat = 'rgba8unorm';
    let vertexShaderCode: string;
    switch (quadAngle) {
      case QuadAngle.Flat:
        // Draw a square at z = 0.25.
        vertexShaderCode = `
          @vertex
          fn main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
            var pos = array<vec2<f32>, 6>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>( 1.0, -1.0),
            vec2<f32>(-1.0,  1.0),
            vec2<f32>(-1.0,  1.0),
            vec2<f32>( 1.0, -1.0),
            vec2<f32>( 1.0,  1.0));
            return vec4<f32>(pos[VertexIndex], 0.25, 1.0);
          }
          `;
        break;
      case QuadAngle.TiltedX:
        // Draw a square ranging from 0 to 0.5, bottom to top.
        vertexShaderCode = `
          @vertex
          fn main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
            var pos = array<vec3<f32>, 6>(
            vec3<f32>(-1.0, -1.0, 0.0),
            vec3<f32>( 1.0, -1.0, 0.0),
            vec3<f32>(-1.0,  1.0, 0.5),
            vec3<f32>(-1.0,  1.0, 0.5),
            vec3<f32>( 1.0, -1.0, 0.0),
            vec3<f32>( 1.0,  1.0, 0.5));
            return vec4<f32>(pos[VertexIndex], 1.0);
          }
          `;
        break;
      default:
        unreachable();
    }

    const renderTarget = this.device.createTexture({
      format: renderTargetFormat,
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const depthTexture = this.device.createTexture({
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      format: depthFormat,
      sampleCount: 1,
      mipLevelCount: 1,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    const depthStencilAttachment: GPURenderPassDepthStencilAttachment = {
      view: depthTexture.createView(),
      depthLoadOp: 'load',
      depthStoreOp: 'store',
      stencilLoadOp: 'load',
      stencilStoreOp: 'store',
    };

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: renderTarget.createView(),
          storeOp: 'store',
          loadOp: 'load',
        },
      ],
      depthStencilAttachment,
    });

    let depthCompare: GPUCompareFunction = 'always';
    if (depthFormat !== 'depth32float') {
      depthCompare = 'greater';
    }

    const testState = {
      format: depthFormat,
      depthCompare,
      depthWriteEnabled: true,
      depthBias: bias,
      depthBiasSlopeScale: biasSlopeScale,
      depthBiasClamp: biasClamp,
    } as const;

    // Draw a square with the given depth state and bias values.
    const testPipeline = this.createRenderPipelineForTest(vertexShaderCode, testState);
    pass.setPipeline(testPipeline);
    pass.draw(6);
    pass.end();
    this.device.queue.submit([encoder.finish()]);

    const expColor = { Depth: expectedDepth };
    const expTexelView = TexelView.fromTexelsAsColors(depthFormat, coords => expColor);

    const result = textureContentIsOKByT2B(
      this,
      { texture: depthTexture },
      [1, 1],
      { expTexelView },
      { maxDiffULPsForFloatFormat: 1 }
    );
    this.eventualExpectOK(result);
    this.trackForCleanup(renderTarget);
  }

  createRenderPipelineForTest(
    vertex: string,
    depthStencil: GPUDepthStencilState
  ): GPURenderPipeline {
    return this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: this.device.createShaderModule({
          code: vertex,
        }),
        entryPoint: 'main',
      },
      fragment: {
        targets: [{ format: 'rgba8unorm' }],
        module: this.device.createShaderModule({
          code: `
            @fragment fn main() -> @location(0) vec4<f32> {
              return vec4<f32>(1.0, 0.0, 0.0, 1.0);
            }`,
        }),
        entryPoint: 'main',
      },
      depthStencil,
    });
  }
}

export const g = makeTestGroup(DepthBiasTest);

g.test('depth_bias')
  .desc(
    `
  Tests that a square with different depth bias values like 'positive', 'negative', 'infinity',
  'slope', 'clamp', etc. is drawn as expected.

  TODO: Need to test 'depth24plus-stencil8' format?
  `
  )
  .params(u =>
    u //
      .combineWithParams([
        {
          quadAngle: QuadAngle.Flat,
          bias: kPointTwoFiveBiasForPointTwoFiveZOnFloat,
          biasSlopeScale: 0,
          biasClamp: 0,
          expectedDepth: 0.5,
        },
        {
          quadAngle: QuadAngle.Flat,
          bias: kPointTwoFiveBiasForPointTwoFiveZOnFloat,
          biasSlopeScale: 0,
          biasClamp: 0.125,
          expectedDepth: 0.375,
        },
        {
          quadAngle: QuadAngle.Flat,
          bias: -kPointTwoFiveBiasForPointTwoFiveZOnFloat,
          biasSlopeScale: 0,
          biasClamp: 0.125,
          expectedDepth: 0,
        },
        {
          quadAngle: QuadAngle.Flat,
          bias: -kPointTwoFiveBiasForPointTwoFiveZOnFloat,
          biasSlopeScale: 0,
          biasClamp: -0.125,
          expectedDepth: 0.125,
        },
        {
          quadAngle: QuadAngle.TiltedX,
          bias: 0,
          biasSlopeScale: 0,
          biasClamp: 0,
          expectedDepth: 0.25,
        },
        {
          quadAngle: QuadAngle.TiltedX,
          bias: 0,
          biasSlopeScale: 1,
          biasClamp: 0,
          expectedDepth: 0.75,
        },
        {
          quadAngle: QuadAngle.TiltedX,
          bias: 0,
          biasSlopeScale: -0.5,
          biasClamp: 0,
          expectedDepth: 0,
        },
        {
          quadAngle: QuadAngle.TiltedX,
          bias: 0,
          biasSlopeScale: kValue.f32.infinity.positive,
          biasClamp: 0,
          expectedDepth: 1,
        },
        {
          quadAngle: QuadAngle.TiltedX,
          bias: 0,
          biasSlopeScale: kValue.f32.infinity.negative,
          biasClamp: 0,
          expectedDepth: 0,
        },
      ] as const)
  )
  .fn(async t => {
    t.runDepthBiasTest('depth32float', t.params);
  });
