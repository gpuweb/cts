export const description = `
TODO:
- test compatibility between bind groups and pipelines
    - the binding resource in bindGroups[i].layout is "group-equivalent" (value-equal) to pipelineLayout.bgls[i].
    - in the test fn, test once without the dispatch/draw (should always be valid) and once with
      the dispatch/draw, to make sure the validation happens in dispatch/draw.
    - x= {dispatch, all draws} (dispatch/draw should be size 0 to make sure validation still happens if no-op)
    - x= all relevant stages

TODO: subsume existing test, rewrite fixture as needed.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { kShaderStageCombinations } from '../../../../capability_info.js';
import { GPUConst } from '../../../../constants.js';
import {
  ProgrammableEncoderType,
  kProgrammableEncoderTypes,
} from '../../util/command_buffer_maker.js';
import { ValidationTest } from '../../validation_test.js';

function getTestCmds(encoderType: ProgrammableEncoderType): readonly string[] {
  if (encoderType === 'compute pass') {
    return ['dispatch', 'dispatchIndirect'] as const;
  } else {
    return ['draw', 'drawIndexed', 'drawIndirect', 'drawIndexedIndirect'] as const;
  }
}

const kResourceTypes = ['buffer', 'sampler', 'texture', 'storageTexture', 'externalTexture'];

class F extends ValidationTest {
  getUniformBuffer(): GPUBuffer {
    return this.device.createBuffer({
      size: 8 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM,
    });
  }

  createRenderPipeline(): GPURenderPipeline {
    const pipeline = this.device.createRenderPipeline({
      vertex: {
        module: this.device.createShaderModule({
          code: `
            [[block]] struct VertexUniforms {
              transform : mat2x2<f32> ;
            };
            [[group(0), binding(0)]] var<uniform> uniforms : VertexUniforms;

            [[stage(vertex)]] fn main(
              [[builtin(vertex_index)]] VertexIndex : u32
              ) -> [[builtin(position)]] vec4<f32> {
              var pos : array<vec2<f32>, 3> = array<vec2<f32>, 3>(
                vec2<f32>(-1.0, -1.0),
                vec2<f32>( 1.0, -1.0),
                vec2<f32>(-1.0,  1.0)
              );
              return vec4<f32>(uniforms.transform * pos[VertexIndex], 0.0, 1.0);
            }`,
        }),
        entryPoint: 'main',
      },
      fragment: {
        module: this.device.createShaderModule({
          code: `
            [[block]] struct FragmentUniforms {
              color : vec4<f32>;
            };
            [[group(1), binding(0)]] var<uniform> uniforms : FragmentUniforms;

            [[stage(fragment)]] fn main() -> [[location(0)]] vec4<f32> {
              return uniforms.color;
            }`,
        }),
        entryPoint: 'main',
        targets: [{ format: 'rgba8unorm' }],
      },
      primitive: { topology: 'triangle-list' },
    });
    return pipeline;
  }

  beginRenderPass(commandEncoder: GPUCommandEncoder): GPURenderPassEncoder {
    const attachmentTexture = this.device.createTexture({
      format: 'rgba8unorm',
      size: { width: 16, height: 16, depthOrArrayLayers: 1 },
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    return commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: attachmentTexture.createView(),
          loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
          storeOp: 'store',
        },
      ],
    });
  }
}

export const g = makeTestGroup(F);

g.test('bind_groups_and_pipeline_layout_mismatch')
  .desc(
    `
    Tests the bind groups must match the requirements of the pipeline layout.
    - bind groups required by the pipeline layout are required.
    - bind groups unused by the pipeline layout can be set or not.

    TODO: merge existing tests to this test
    `
  )
  .params(u =>
    u
      .combine('encoderType', kProgrammableEncoderTypes)
      .expand('call', p => getTestCmds(p.encoderType))
      .beginSubcases()
      .combineWithParams([
        { setBindGroup0: true, setUnusedBindGroup1: true, setBindGroup2: true, _success: true },
        { setBindGroup0: true, setUnusedBindGroup1: false, setBindGroup2: true, _success: true },
        { setBindGroup0: true, setUnusedBindGroup1: true, setBindGroup2: false, _success: false },
        { setBindGroup0: false, setUnusedBindGroup1: true, setBindGroup2: true, _success: false },
        { setBindGroup0: false, setUnusedBindGroup1: false, setBindGroup2: false, _success: false },
      ])
      .combine('useU32Array', [false, true])
  )
  .unimplemented();

g.test('it_is_invalid_to_draw_in_a_render_pass_with_missing_bind_groups')
  .paramsSubcasesOnly([
    { setBindGroup1: true, setBindGroup2: true, _success: true },
    { setBindGroup1: true, setBindGroup2: false, _success: false },
    { setBindGroup1: false, setBindGroup2: true, _success: false },
    { setBindGroup1: false, setBindGroup2: false, _success: false },
  ])
  .fn(async t => {
    const { setBindGroup1, setBindGroup2, _success } = t.params;

    const pipeline = t.createRenderPipeline();

    const uniformBuffer = t.getUniformBuffer();

    const bindGroup0 = t.device.createBindGroup({
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
          },
        },
      ],
      layout: pipeline.getBindGroupLayout(0),
    });

    const bindGroup1 = t.device.createBindGroup({
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
          },
        },
      ],
      layout: pipeline.getBindGroupLayout(1),
    });

    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    renderPass.setPipeline(pipeline);
    if (setBindGroup1) {
      renderPass.setBindGroup(0, bindGroup0);
    }
    if (setBindGroup2) {
      renderPass.setBindGroup(1, bindGroup1);
    }
    renderPass.draw(3);
    renderPass.endPass();
    t.expectValidationError(() => {
      commandEncoder.finish();
    }, !_success);
  });

g.test('bgl_binding_mismatch')
  .desc(
    'Tests the binding number must exist or not exist in both bindGroups[i].layout and pipelineLayout.bgls[i]'
  )
  .params(u =>
    u
      .combine('encoderType', kProgrammableEncoderTypes)
      .expand('call', p => getTestCmds(p.encoderType))
      .beginSubcases()
      .combineWithParams([
        { bgBindings: [0, 1, 2], plBindings: [0, 1, 2], _success: true },
        { bgBindings: [0, 1, 2], plBindings: [0, 1, 3], _success: false },
        { bgBindings: [0, 2], plBindings: [0, 2], _success: true },
        { bgBindings: [0, 2], plBindings: [2, 0], _success: true },
        { bgBindings: [0, 1, 2], plBindings: [0, 1], _success: false },
        { bgBindings: [0, 1], plBindings: [0, 1, 2], _success: false },
      ])
      .combine('useU32Array', [false, true])
  )
  .unimplemented();

g.test('bgl_visibility_mismatch')
  .desc('Tests the visibility in bindGroups[i].layout and pipelineLayout.bgls[i] must be matched')
  .params(u =>
    u
      .combine('encoderType', kProgrammableEncoderTypes)
      .expand('call', p => getTestCmds(p.encoderType))
      .beginSubcases()
      .combine('bgVisibility', kShaderStageCombinations)
      .expand('plVisibility', p =>
        p.encoderType === 'compute pass'
          ? ([GPUConst.ShaderStage.COMPUTE] as const)
          : ([
              GPUConst.ShaderStage.VERTEX,
              GPUConst.ShaderStage.FRAGMENT,
              GPUConst.ShaderStage.VERTEX | GPUConst.ShaderStage.FRAGMENT,
            ] as const)
      )
      .combine('useU32Array', [false, true])
  )
  .unimplemented();

g.test('bgl_resource_type_mismatch')
  .desc(
    'Tests the binding resource type in bindGroups[i].layout and pipelineLayout.bgls[i] must be matched'
  )
  .params(u =>
    u
      .combine('encoderType', kProgrammableEncoderTypes)
      .expand('call', p => getTestCmds(p.encoderType))
      .beginSubcases()
      .combine('bgResourceType', kResourceTypes)
      .combine('plResourceType', kResourceTypes)
      .combine('useU32Array', [false, true])
  )
  .unimplemented();
