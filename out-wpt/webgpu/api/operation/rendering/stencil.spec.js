/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ export const description = `
Test related to stencil states, stencil op, compare func, etc.
`;
import { makeTestGroup } from '../../../../common/framework/test_group.js';

import { GPUTest } from '../../../gpu_test.js';
import { TexelView } from '../../../util/texture/texel_view.js';
import { textureContentIsOKByT2B } from '../../../util/texture/texture_ok.js';

const kBaseColor = new Float32Array([1.0, 1.0, 1.0, 1.0]);
const kRedStencilColor = new Float32Array([1.0, 0.0, 0.0, 1.0]);
const kGreenStencilColor = new Float32Array([0.0, 1.0, 0.0, 1.0]);

class StencilTest extends GPUTest {
  checkStencilCompareFunction(compareFunction, stencilRefValue, expectedColor) {
    const depthStencilFormat = 'depth24plus-stencil8';

    const baseStencilState = {
      compare: 'always',
      failOp: 'keep',
      passOp: 'replace',
    };

    const stencilState = {
      compare: compareFunction,
      failOp: 'keep',
      passOp: 'keep',
    };

    const baseState = {
      format: depthStencilFormat,
      depthWriteEnabled: false,
      depthCompare: 'always',
      stencilFront: baseStencilState,
      stencilBack: baseStencilState,
    };

    const state = {
      format: depthStencilFormat,
      depthWriteEnabled: false,
      depthCompare: 'always',
      stencilFront: stencilState,
      stencilBack: stencilState,
    };

    const testParams = [{ state, color: kGreenStencilColor }];
    this.runStencilStateTest(baseState, testParams, stencilRefValue, expectedColor);
  }

  runStencilStateTest(baseState, testStates, stencilRefValue, expectedColor) {
    const renderTargetFormat = 'rgba8unorm';
    const renderTarget = this.device.createTexture({
      format: renderTargetFormat,
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const depthStencilFormat = 'depth24plus-stencil8';
    const depthTexture = this.device.createTexture({
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      format: depthStencilFormat,
      sampleCount: 1,
      mipLevelCount: 1,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
    });

    const depthStencilAttachment = {
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
    // The color will be kGreenStencilColor if the stencil test passes, and kBaseColor if not.
    for (const test of testStates) {
      const testPipeline = this.createRenderPipelineForTest(test.state);
      pass.setPipeline(testPipeline);
      pass.setStencilReference(stencilRefValue);
      pass.setBindGroup(
        0,
        this.createBindGroupForTest(testPipeline.getBindGroupLayout(0), test.color)
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

  createRenderPipelineForTest(depthStencil) {
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

  createBindGroupForTest(layout, data) {
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
        { stencilCompare: 'always', stencilRefValue: 0, _expectedColor: kGreenStencilColor },
        { stencilCompare: 'always', stencilRefValue: 1, _expectedColor: kGreenStencilColor },
        { stencilCompare: 'always', stencilRefValue: 2, _expectedColor: kGreenStencilColor },
        { stencilCompare: 'equal', stencilRefValue: 0, _expectedColor: kBaseColor },
        { stencilCompare: 'equal', stencilRefValue: 1, _expectedColor: kGreenStencilColor },
        { stencilCompare: 'equal', stencilRefValue: 2, _expectedColor: kBaseColor },
        { stencilCompare: 'greater', stencilRefValue: 0, _expectedColor: kBaseColor },
        { stencilCompare: 'greater', stencilRefValue: 1, _expectedColor: kBaseColor },
        { stencilCompare: 'greater', stencilRefValue: 2, _expectedColor: kGreenStencilColor },
        { stencilCompare: 'greater-equal', stencilRefValue: 0, _expectedColor: kBaseColor },
        { stencilCompare: 'greater-equal', stencilRefValue: 1, _expectedColor: kGreenStencilColor },
        { stencilCompare: 'greater-equal', stencilRefValue: 2, _expectedColor: kGreenStencilColor },
        { stencilCompare: 'less', stencilRefValue: 0, _expectedColor: kGreenStencilColor },
        { stencilCompare: 'less', stencilRefValue: 1, _expectedColor: kBaseColor },
        { stencilCompare: 'less', stencilRefValue: 2, _expectedColor: kBaseColor },
        { stencilCompare: 'less-equal', stencilRefValue: 0, _expectedColor: kGreenStencilColor },
        { stencilCompare: 'less-equal', stencilRefValue: 1, _expectedColor: kGreenStencilColor },
        { stencilCompare: 'less-equal', stencilRefValue: 2, _expectedColor: kBaseColor },
        { stencilCompare: 'never', stencilRefValue: 0, _expectedColor: kBaseColor },
        { stencilCompare: 'never', stencilRefValue: 1, _expectedColor: kBaseColor },
        { stencilCompare: 'never', stencilRefValue: 2, _expectedColor: kBaseColor },
        { stencilCompare: 'not-equal', stencilRefValue: 0, _expectedColor: kGreenStencilColor },
        { stencilCompare: 'not-equal', stencilRefValue: 1, _expectedColor: kBaseColor },
        { stencilCompare: 'not-equal', stencilRefValue: 2, _expectedColor: kGreenStencilColor },
      ])
  )
  .fn(async t => {
    const { stencilCompare, stencilRefValue, _expectedColor } = t.params;
    t.checkStencilCompareFunction(stencilCompare, stencilRefValue, _expectedColor);
  });

g.test('stencil_fail_operation')
  .desc(
    `
  Test that the stencil operation is executed on stencil fail. Triangle with stencil reference 2
  fails the 'less' comparison function because the base stencil reference is 1.
    - If the fail operation is 'keep', it keeps the base color.
    - If the fail operation is 'replace', it replaces the base color with the last stencil color.

  TODO: Need to test the other stencil operations?
  `
  )
  .params(u =>
    u //
      .combineWithParams([
        { operation: 'keep', _expectedColor: kBaseColor },
        { operation: 'replace', _expectedColor: kGreenStencilColor },
      ])
  )
  .fn(async t => {
    const { operation, _expectedColor } = t.params;

    const depthSpencilFormat = 'depth24plus-stencil8';

    const baseStencilState = {
      compare: 'always',
      failOp: 'keep',
      passOp: 'replace',
    };

    const failedStencilState = {
      compare: 'less',
      failOp: operation,
      passOp: 'keep',
    };

    const stencilState = {
      compare: 'equal',
      failOp: 'keep',
      passOp: 'keep',
    };

    const baseState = {
      format: depthSpencilFormat,
      depthWriteEnabled: false,
      depthCompare: 'always',
      stencilFront: baseStencilState,
      stencilBack: baseStencilState,
      stencilReadMask: 0xff,
      stencilWriteMask: 0xff,
    };

    const failState = {
      format: depthSpencilFormat,
      depthWriteEnabled: false,
      depthCompare: 'always',
      stencilFront: failedStencilState,
      stencilBack: failedStencilState,
      stencilReadMask: 0xff,
      stencilWriteMask: 0xff,
    };

    const passState = {
      format: depthSpencilFormat,
      depthWriteEnabled: false,
      depthCompare: 'always',
      stencilFront: stencilState,
      stencilBack: stencilState,
      stencilReadMask: 0xff,
      stencilWriteMask: 0xff,
    };

    const testStates = [
      // Always fails because the ref (2) is less than the initial stencil contents (1).
      // Therefore red is never drawn, and the stencil contents may be updated according to
      // `operation`.
      { state: failState, color: kRedStencilColor },
      // Passes iff the ref (2) equals the current stencil contents (1 or 2).
      { state: passState, color: kGreenStencilColor },
    ];

    t.runStencilStateTest(baseState, testStates, 2, _expectedColor);
  });
