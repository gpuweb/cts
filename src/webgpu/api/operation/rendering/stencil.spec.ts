export const description = `
Test related to stencil states, stencil op, compare func, etc.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { TypedArrayBufferView } from '../../../../common/util/util.js';
import { GPUTest } from '../../../gpu_test.js';
import { TexelView } from '../../../util/texture/texel_view.js';
import { textureContentIsOKByT2B } from '../../../util/texture/texture_ok.js';

const kBaseColor = new Float32Array([1.0, 1.0, 1.0, 1.0]);
const kStencilColor = new Float32Array([0.0, 0.0, 0.0, 1.0]);

class StencilTest extends GPUTest {
  checkStencilCompareFunction(
    compareFunction: GPUCompareFunction,
    stencilRefValue: number,
    expectedColor: Float32Array
  ) {
    const depthStencilFormat: GPUTextureFormat = 'depth24plus-stencil8';

    const baseStencilState = {
      compare: 'always',
      failOp: 'keep',
      passOp: 'replace',
    } as const;

    const stencilState = {
      compare: compareFunction,
      failOp: 'keep',
      passOp: 'keep',
    } as const;

    const baseState = {
      format: depthStencilFormat,
      depthWriteEnabled: false,
      depthCompare: 'always',
      stencilFront: baseStencilState,
      stencilBack: baseStencilState,
    } as const;

    const state = {
      format: depthStencilFormat,
      depthWriteEnabled: false,
      depthCompare: 'always',
      stencilFront: stencilState,
      stencilBack: stencilState,
    } as const;

    this.runStencilStateTest(baseState, state, stencilRefValue, expectedColor);
  }

  runStencilStateTest(
    baseState: GPUDepthStencilState,
    state: GPUDepthStencilState,
    stencilRefValue: number,
    expectedColor: Float32Array
  ) {
    const renderTargetFormat = 'rgba8unorm';
    const renderTarget = this.device.createTexture({
      format: renderTargetFormat,
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const depthStencilFormat: GPUTextureFormat = 'depth24plus-stencil8';
    const depthTexture = this.device.createTexture({
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      format: depthStencilFormat,
      sampleCount: 1,
      mipLevelCount: 1,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
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

    // Draw the base triangle with stencil reference 1.
    // This clears the stencil buffer to 1.
    {
      const testPipeline = this.createRenderPipelineForTest(baseState);
      pass.setPipeline(testPipeline);
      pass.setStencilReference(1);
      pass.setBindGroup(
        0,
        this.createBindGroupForTest(testPipeline.getBindGroupLayout(0), kBaseColor)
      );
      pass.draw(1);
    }

    // Draw a triangle with the given stencil reference and the comparison function.
    // The color will be kStencilColor if the stencil test passes, and kBaseColor if not.
    {
      const testPipeline = this.createRenderPipelineForTest(state);
      pass.setPipeline(testPipeline);
      pass.setStencilReference(stencilRefValue);
      pass.setBindGroup(
        0,
        this.createBindGroupForTest(testPipeline.getBindGroupLayout(0), kStencilColor)
      );
      pass.draw(1);
    }

    pass.end();
    this.device.queue.submit([encoder.finish()]);

    const expColor = {
      R: expectedColor[0],
      G: expectedColor[1],
      B: expectedColor[2],
      A: expectedColor[3],
    };
    const expTexelView = TexelView.fromTexelsAsColors(renderTargetFormat, coords => expColor);

    const result = textureContentIsOKByT2B(
      this,
      { texture: renderTarget },
      [1, 1],
      { expTexelView },
      { maxDiffULPsForNormFormat: 1 }
    );
    this.eventualExpectOK(result);
    this.trackForCleanup(renderTarget);
  }

  createRenderPipelineForTest(depthStencil: GPUDepthStencilState): GPURenderPipeline {
    return this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: this.device.createShaderModule({
          code: `
            @vertex
            fn main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
                return vec4<f32>(0.0, 0.0, 0.0, 1.0);
            }
            `,
        }),
        entryPoint: 'main',
      },
      fragment: {
        targets: [{ format: 'rgba8unorm' }],
        module: this.device.createShaderModule({
          code: `
            struct Params {
              color : vec4<f32>
            }
            @group(0) @binding(0) var<uniform> params : Params;

            @fragment fn main() -> @location(0) vec4<f32> {
                return vec4<f32>(params.color);
            }`,
        }),
        entryPoint: 'main',
      },
      primitive: { topology: 'point-list' },
      depthStencil,
    });
  }

  createBindGroupForTest(layout: GPUBindGroupLayout, data: TypedArrayBufferView): GPUBindGroup {
    return this.device.createBindGroup({
      layout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.makeBufferWithContents(data, GPUBufferUsage.UNIFORM),
          },
        },
      ],
    });
  }
}

export const g = makeTestGroup(StencilTest);

g.test('stencil_compare_func')
  .desc(
    `
  Tests that stencil comparison functions with the stencil reference value works as expected.
  `
  )
  .params(u =>
    u //
      .combineWithParams([
        { stencilCompare: 'always', stencilRefValue: 0, _expectedColor: kStencilColor },
        { stencilCompare: 'always', stencilRefValue: 1, _expectedColor: kStencilColor },
        { stencilCompare: 'always', stencilRefValue: 2, _expectedColor: kStencilColor },
        { stencilCompare: 'equal', stencilRefValue: 0, _expectedColor: kBaseColor },
        { stencilCompare: 'equal', stencilRefValue: 1, _expectedColor: kStencilColor },
        { stencilCompare: 'equal', stencilRefValue: 2, _expectedColor: kBaseColor },
        { stencilCompare: 'greater', stencilRefValue: 0, _expectedColor: kBaseColor },
        { stencilCompare: 'greater', stencilRefValue: 1, _expectedColor: kBaseColor },
        { stencilCompare: 'greater', stencilRefValue: 2, _expectedColor: kStencilColor },
        { stencilCompare: 'greater-equal', stencilRefValue: 0, _expectedColor: kBaseColor },
        { stencilCompare: 'greater-equal', stencilRefValue: 1, _expectedColor: kStencilColor },
        { stencilCompare: 'greater-equal', stencilRefValue: 2, _expectedColor: kStencilColor },
        { stencilCompare: 'less', stencilRefValue: 0, _expectedColor: kStencilColor },
        { stencilCompare: 'less', stencilRefValue: 1, _expectedColor: kBaseColor },
        { stencilCompare: 'less', stencilRefValue: 2, _expectedColor: kBaseColor },
        { stencilCompare: 'less-equal', stencilRefValue: 0, _expectedColor: kStencilColor },
        { stencilCompare: 'less-equal', stencilRefValue: 1, _expectedColor: kStencilColor },
        { stencilCompare: 'less-equal', stencilRefValue: 2, _expectedColor: kBaseColor },
        { stencilCompare: 'never', stencilRefValue: 0, _expectedColor: kBaseColor },
        { stencilCompare: 'never', stencilRefValue: 1, _expectedColor: kBaseColor },
        { stencilCompare: 'never', stencilRefValue: 2, _expectedColor: kBaseColor },
        { stencilCompare: 'not-equal', stencilRefValue: 0, _expectedColor: kStencilColor },
        { stencilCompare: 'not-equal', stencilRefValue: 1, _expectedColor: kBaseColor },
        { stencilCompare: 'not-equal', stencilRefValue: 2, _expectedColor: kStencilColor },
      ] as const)
  )
  .fn(async t => {
    const { stencilCompare, stencilRefValue, _expectedColor } = t.params;
    t.checkStencilCompareFunction(stencilCompare, stencilRefValue, _expectedColor);
  });
