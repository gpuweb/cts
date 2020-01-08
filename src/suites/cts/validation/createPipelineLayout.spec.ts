export const description = `
createPipelineLayout validation tests.
`;

import { TestGroup, pcombine, poptions } from '../../../framework/index.js';
import { bindingTypeInfo, bindingTypes, shaderStageCombinations } from '../format_info.js';

import { ValidationTest } from './validation_test.js';

function clone<T extends GPUBindGroupLayoutDescriptor>(descriptor: T): T {
  return JSON.parse(JSON.stringify(descriptor));
}

export const g = new TestGroup(ValidationTest);

g.test('number of dynamic buffers exceeds the maximum value', async t => {
  const { type, visibility } = t.params;
  const maxDynamicCount = bindingTypeInfo[type as GPUBindingType].maxDynamicCount;

  const maxDynamicBufferBindings: GPUBindGroupLayoutBinding[] = [];
  for (let binding = 0; binding < maxDynamicCount; binding++) {
    maxDynamicBufferBindings.push({ binding, visibility, type, hasDynamicOffset: true });
  }

  const maxDynamicBufferBindGroupLayout = t.device.createBindGroupLayout({
    bindings: maxDynamicBufferBindings,
  });

  const goodDescriptor = {
    bindings: [{ binding: 0, visibility, type, hasDynamicOffset: false }],
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
  badDescriptor.bindings[0].hasDynamicOffset = true;

  const badPipelineLayoutDescriptor = {
    bindGroupLayouts: [
      maxDynamicBufferBindGroupLayout,
      t.device.createBindGroupLayout(badDescriptor),
    ],
  };

  t.expectValidationError(() => {
    t.device.createPipelineLayout(badPipelineLayoutDescriptor);
  });
}).params(
  pcombine(
    poptions('visibility', [0, 2, 4, 6]), //
    poptions('type', ['uniform-buffer', 'storage-buffer', 'readonly-storage-buffer'])
  )
);

g.test('dynamic offsets are only allowed on buffers', t => {
  const { type, visibility } = t.params;
  const info = bindingTypeInfo[type as GPUBindingType];

  const goodDescriptor = {
    bindings: [{ binding: 0, visibility, type, hasDynamicOffset: false }],
  };

  t.device.createPipelineLayout({
    bindGroupLayouts: [t.device.createBindGroupLayout(goodDescriptor)],
  });

  const badDescriptor = clone(goodDescriptor);
  badDescriptor.bindings[0].hasDynamicOffset = true;

  const success = info.type === 'buffer';
  t.expectValidationError(() => {
    t.device.createPipelineLayout({
      bindGroupLayouts: [t.device.createBindGroupLayout(badDescriptor)],
    });
  }, !success);
}).params(
  pcombine(
    poptions('visibility', shaderStageCombinations), //
    poptions('type', bindingTypes)
  )
);

g.test('number of bind group layouts exceeds the maximum value', async t => {
  const { visibility, type } = t.params;

  const bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
    bindings: [{ binding: 0, visibility, type }],
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
}).params(
  pcombine(poptions('visibility', shaderStageCombinations), poptions('type', bindingTypes))
);
