export const description = `
setBindGroup validation tests.

TODO: merge these notes and implement.
> (Note: If there are errors with using certain binding types in certain passes, test those in the file for that pass type, not here.)
>
> - state tracking (probably separate file)
>     - x= {compute pass, render pass}
>     - {null, compatible, incompatible} current pipeline (should have no effect without draw/dispatch)
>     - setBindGroup in different orders (e.g. 0,1,2 vs 2,0,1)
`;

import { poptions, params, pbool } from '../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { range, unreachable } from '../../../../../common/framework/util/util.js';
import {
  kProgrammableEncoderTypes,
  ProgrammableEncoderType,
  ValidationTest,
} from '../../validation_test.js';

class F extends ValidationTest {
  encoderTypeToStageFlag(encoderType: ProgrammableEncoderType): GPUShaderStageFlags {
    switch (encoderType) {
      case 'compute pass':
        return GPUShaderStage.COMPUTE;
      case 'render pass':
      case 'render bundle':
        return GPUShaderStage.FRAGMENT;
      default:
        unreachable('Unknown encoder type');
    }
  }

  createResourceWithState(
    resourceType: 'texture' | 'buffer',
    state: 'valid' | 'destroyed'
  ): GPUBindingResource {
    switch (resourceType) {
      case 'texture':
        return this.createTextureWithState(state).createView();
      case 'buffer':
        return {
          buffer: this.createBufferWithState(state, {
            size: 4,
            usage: GPUBufferUsage.STORAGE,
          }),
        };
      default:
        unreachable('unknown resource type');
    }
  }

  createBindGroup(
    state: 'valid' | 'invalid' | 'destroyed',
    resourceType: 'buffer' | 'texture',
    encoderType: ProgrammableEncoderType,
    indices: number[]
  ) {
    const layoutIndices =
      state === 'invalid' ? new Array<number>(indices.length + 1).fill(0) : indices;
    const layout = this.device.createBindGroupLayout({
      entries: layoutIndices.map(binding => ({
        binding,
        visibility: this.encoderTypeToStageFlag(encoderType),
        ...(resourceType === 'buffer'
          ? {
              buffer: {
                type: 'storage',
              },
            }
          : { texture: {} }),
      })),
    });
    return this.device.createBindGroup({
      layout,
      entries: indices.map(binding => ({
        binding,
        resource: this.createResourceWithState(
          resourceType,
          state === 'destroyed' ? state : 'valid'
        ),
      })),
    });
  }
}

export const g = makeTestGroup(F);

g.test('state_and_binding_index')
  .desc('Tests that setBindGroup correctly handles {valid, invalid} bindGroups.')
  .cases(
    params()
      .combine(poptions('encoderType', kProgrammableEncoderTypes))
      .combine(poptions('state', ['valid', 'invalid', 'destroyed'] as const))
      .combine(poptions('resourceType', ['buffer', 'texture'] as const))
  )
  .fn(t => {
    const { encoderType, state, resourceType } = t.params;
    const { maxBindGroups } = t.device.adapter.limits || { maxBindGroups: 4 };

    function runTest(index: number) {
      const { encoder, finish } = t.createEncoder(encoderType);

      t.expectValidationError(() => {
        encoder.setBindGroup(index, t.createBindGroup(state, resourceType, encoderType, [index]));
        // Submit required to test destroyed buffer
        t.queue.submit([finish()]);
      }, index >= maxBindGroups || state !== 'valid');
    }

    for (const index of [1, maxBindGroups - 1, maxBindGroups]) {
      t.debug(`test bind group index ${index}`);
      runTest(index);
    }
  });

g.test('dynamic_offsets_passed_but_not_expected')
  .desc('Tests that setBindGroup correctly unexpected dynamicOffsets.')
  .cases(poptions('encoderType', kProgrammableEncoderTypes))
  .fn(async t => {
    const { encoderType } = t.params;
    const bindGroup = t.createBindGroup('valid', 'buffer', encoderType, []);
    const dynamicOffsets = [0];

    t.expectValidationError(() => {
      const { encoder, finish } = t.createEncoder(encoderType);
      encoder.setBindGroup(0, bindGroup, dynamicOffsets);
      finish();
    });
  });

g.test('dynamic_offsets_match_expectations_in_pass_encoder')
  .desc('Tests that given dynamicOffsets match the specified bindGroup.')
  .cases(
    params()
      .combine(poptions('encoderType', kProgrammableEncoderTypes))
      .combine([
        { dynamicOffsets: [256, 0], _success: true }, // Dynamic offsets aligned
        { dynamicOffsets: [1, 2], _success: false }, // Dynamic offsets not aligned

        // Wrong number of dynamic offsets
        { dynamicOffsets: [256, 0, 0], _success: false },
        { dynamicOffsets: [256], _success: false },
        { dynamicOffsets: [], _success: false },

        // Dynamic uniform buffer out of bounds because of binding size
        { dynamicOffsets: [512, 0], _success: false },
        { dynamicOffsets: [1024, 0], _success: false },
        { dynamicOffsets: [0xffffffff, 0], _success: false },

        // Dynamic storage buffer out of bounds because of binding size
        { dynamicOffsets: [0, 512], _success: false },
        { dynamicOffsets: [0, 1024], _success: false },
        { dynamicOffsets: [0, 0xffffffff], _success: false },
      ])
      .combine(pbool('useU32array'))
  )
  .fn(async t => {
    // Dynamic buffer offsets require offset to be divisible by 256
    const kMinDynamicBufferOffsetAlignment = 256;
    const kBindingSize = 9;

    const bindGroupLayout = t.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
          buffer: {
            type: 'uniform',
            hasDynamicOffset: true,
          },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
          buffer: {
            type: 'storage',
            hasDynamicOffset: true,
          },
        },
      ],
    });

    const uniformBuffer = t.device.createBuffer({
      size: 2 * kMinDynamicBufferOffsetAlignment + 8,
      usage: GPUBufferUsage.UNIFORM,
    });

    const storageBuffer = t.device.createBuffer({
      size: 2 * kMinDynamicBufferOffsetAlignment + 8,
      usage: GPUBufferUsage.STORAGE,
    });

    const bindGroup = t.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
            size: kBindingSize,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: storageBuffer,
            size: kBindingSize,
          },
        },
      ],
    });

    const { encoderType, dynamicOffsets, useU32array, _success } = t.params;

    t.expectValidationError(() => {
      const { encoder, finish } = t.createEncoder(encoderType);
      if (useU32array) {
        encoder.setBindGroup(
          0,
          bindGroup,
          new Uint32Array(dynamicOffsets),
          0,
          dynamicOffsets.length
        );
      } else {
        encoder.setBindGroup(0, bindGroup, dynamicOffsets);
      }
      finish();
    }, !_success);
  });

g.test('minBufferBindingSize')
  .desc('Tests that minBufferBindingSize is correctly enforced.')
  .fn(t => {
    const { encoder, finish } = t.createEncoder('render pass');

    const bindGroupLayout = t.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {
            type: 'storage',
            minBindingSize: 256,
          },
        },
      ],
    });

    const storageBuffer = t.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.STORAGE,
    });

    t.expectValidationError(() => {
      const bindGroup = t.device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: {
              buffer: storageBuffer,
            },
          },
        ],
      });

      encoder.setBindGroup(0, bindGroup);
      finish();
    });
  });

g.test('u32array_start_and_length')
  .desc('Tests that dynamicOffsetsData(Start|Length) apply to the given Uint32Array.')
  .cases([
    // dynamicOffsetsDataLength > offsets.length
    {
      offsets: [0] as const,
      dynamicOffsetsDataStart: 0,
      dynamicOffsetsDataLength: 2,
      _success: false,
    },
    // dynamicOffsetsDataStart + dynamicOffsetsDataLength > offsets.length
    {
      offsets: [0] as const,
      dynamicOffsetsDataStart: 1,
      dynamicOffsetsDataLength: 1,
      _success: false,
    },
    {
      offsets: [0, 0] as const,
      dynamicOffsetsDataStart: 1,
      dynamicOffsetsDataLength: 1,
      _success: true,
    },
  ])
  .fn(t => {
    const { offsets, dynamicOffsetsDataStart, dynamicOffsetsDataLength, _success } = t.params;
    const kBindingSize = 8;

    const bindGroupLayout = t.device.createBindGroupLayout({
      entries: range(dynamicOffsetsDataLength, i => ({
        binding: i,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: {
          type: 'storage',
          hasDynamicOffset: true,
        },
      })),
    });

    const bindGroup = t.device.createBindGroup({
      layout: bindGroupLayout,
      entries: range(dynamicOffsetsDataLength, i => ({
        binding: i,
        resource: {
          buffer: t.createBufferWithState('valid', {
            size: kBindingSize,
            usage: GPUBufferUsage.STORAGE,
          }),
          size: kBindingSize,
        },
      })),
    });

    t.expectValidationError(() => {
      const { encoder, finish } = t.createEncoder('render pass');
      encoder.setBindGroup(
        0,
        bindGroup,
        new Uint32Array(offsets),
        dynamicOffsetsDataStart,
        dynamicOffsetsDataLength
      );
      finish();
    }, !_success);
  });
