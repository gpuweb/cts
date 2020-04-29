export const description = `
createPipelineLayout validation tests.
`;

import * as C from '../../../common/constants.js';
import { pbool, poptions, params } from '../../../common/framework/params.js';
import { TestGroup } from '../../../common/framework/test_group.js';
import {
  kBindingTypeInfo,
  kBindingTypes,
  kShaderStageCombinations,
} from '../../capability_info.js';

import { ValidationTest } from './validation_test.js';

function clone<T extends GPUBindGroupLayoutDescriptor>(descriptor: T): T {
  return JSON.parse(JSON.stringify(descriptor));
}

export const g = new TestGroup(ValidationTest);

g.test('number of dynamic buffers exceeds the maximum value')
  .params(
    params()
      .combine(poptions('visibility', [0, 2, 4, 6]))
      .combine(
        poptions('type', [
          C.BindingType.UniformBuffer,
          C.BindingType.StorageBuffer,
          C.BindingType.ReadonlyStorageBuffer,
        ])
      )
  )
  .fn(async t => {
    const { type, visibility } = t.params;
    const { maxDynamic } = kBindingTypeInfo[type].perPipelineLimitClass;

    const maxDynamicBufferBindings: GPUBindGroupLayoutEntry[] = [];
    for (let binding = 0; binding < maxDynamic; binding++) {
      maxDynamicBufferBindings.push({ binding, visibility, type, hasDynamicOffset: true });
    }

    const maxDynamicBufferBindGroupLayout = t.device.createBindGroupLayout({
      entries: maxDynamicBufferBindings,
    });

    const goodDescriptor = {
      entries: [{ binding: 0, visibility, type, hasDynamicOffset: false }],
    };

    const goodPipelineLayoutDescriptor = {
      bindGroupLayouts: [
        maxDynamicBufferBindGroupLayout,
        t.device.createBindGroupLayout(goodDescriptor),
      ],
    };

    // Control case
    t.device.createPipelineLayout(goodPipelineLayoutDescriptor);

    // Check dynamic buffers exceed maximum in pipeline layout.
    const badDescriptor = clone(goodDescriptor);
    badDescriptor.entries[0].hasDynamicOffset = true;

    const badPipelineLayoutDescriptor = {
      bindGroupLayouts: [
        maxDynamicBufferBindGroupLayout,
        t.device.createBindGroupLayout(badDescriptor),
      ],
    };

    t.expectValidationError(() => {
      t.device.createPipelineLayout(badPipelineLayoutDescriptor);
    });
  });

g.test('visibility and dynamic offsets')
  .params(
    params()
      .combine(poptions('type', kBindingTypes))
      .combine(pbool('hasDynamicOffset'))
      .combine(poptions('visibility', kShaderStageCombinations))
  )
  .fn(t => {
    const { type, hasDynamicOffset, visibility } = t.params;
    const info = kBindingTypeInfo[type as GPUBindingType];

    const descriptor = {
      entries: [{ binding: 0, visibility, type, hasDynamicOffset }],
    };

    const supportsDynamicOffset = kBindingTypeInfo[type].perPipelineLimitClass.maxDynamic > 0;
    let success = true;
    if (!supportsDynamicOffset && hasDynamicOffset) success = false;
    if ((visibility & ~info.validStages) !== 0) success = false;

    t.expectValidationError(() => {
      t.device.createPipelineLayout({
        bindGroupLayouts: [t.device.createBindGroupLayout(descriptor)],
      });
    }, !success);
  });

g.test('number of bind group layouts exceeds the maximum value').fn(async t => {
  const bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
    entries: [],
  };

  // 4 is the maximum number of bind group layouts.
  const maxBindGroupLayouts = [1, 2, 3, 4].map(() =>
    t.device.createBindGroupLayout(bindGroupLayoutDescriptor)
  );

  const goodPipelineLayoutDescriptor = {
    bindGroupLayouts: maxBindGroupLayouts,
  };

  // Control case
  t.device.createPipelineLayout(goodPipelineLayoutDescriptor);

  // Check bind group layouts exceed maximum in pipeline layout.
  const badPipelineLayoutDescriptor = {
    bindGroupLayouts: [
      ...maxBindGroupLayouts,
      t.device.createBindGroupLayout(bindGroupLayoutDescriptor),
    ],
  };

  t.expectValidationError(() => {
    t.device.createPipelineLayout(badPipelineLayoutDescriptor);
  });
});
