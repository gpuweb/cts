export const description = `
createBindGroupLayout validation tests.
`;

import { TestGroup } from '../../../framework/index.js';

import { ValidationTest } from './validation_test.js';

function clone(descriptor: GPUBindGroupLayoutDescriptor): GPUBindGroupLayoutDescriptor {
  return JSON.parse(JSON.stringify(descriptor));
}

export const g = new TestGroup(ValidationTest);

g.test('some binding index was specified more than once', async t => {
  const goodDescriptor: GPUBindGroupLayoutDescriptor = {
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        type: 'storage-buffer',
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        type: 'storage-buffer',
      },
    ],
  };

  const badDescriptor = clone(goodDescriptor);
  badDescriptor.bindings![1].binding = 0;

  // Control case
  t.device.createBindGroupLayout(goodDescriptor);

  // Binding index 0 can't be specified twice.
  await t.expectValidationError(() => {
    t.device.createBindGroupLayout(badDescriptor);
  });
});

g.test('some binding index exceeds the maximum value', async t => {
  const goodDescriptor: GPUBindGroupLayoutDescriptor = {
    bindings: [
      {
        binding: 15,
        visibility: GPUShaderStage.COMPUTE,
        type: 'storage-buffer',
      },
    ],
  };

  const badDescriptor = clone(goodDescriptor);
  badDescriptor.bindings![0].binding = 16;

  // Control case
  t.device.createBindGroupLayout(goodDescriptor);

  // Binding index 16 can't be specified.
  await t.expectValidationError(() => {
    t.device.createBindGroupLayout(badDescriptor);
  });
});

// TODO: Update once https://github.com/gpuweb/gpuweb/issues/405 is decided.
g.test('Visibility of bindings cannot be None', async t => {
  const goodDescriptor: GPUBindGroupLayoutDescriptor = {
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        type: 'storage-buffer',
      },
    ],
  };

  const badDescriptor = clone(goodDescriptor);
  badDescriptor.bindings![0].visibility = GPUShaderStage.NONE;

  // Control case
  t.device.createBindGroupLayout(goodDescriptor);

  // Binding visibility set to None can't be specified.
  await t.expectValidationError(() => {
    t.device.createBindGroupLayout(badDescriptor);
  });
});

g.test('number of dynamic buffers exceeds the maximum value', async t => {
  const { type, maxDynamicBufferCount } = t.params;

  const maxDynamicBufferBindings: GPUBindGroupLayoutBinding[] = [];
  for (let i = 0; i < maxDynamicBufferCount; i++) {
    maxDynamicBufferBindings.push({
      binding: i,
      visibility: GPUShaderStage.COMPUTE,
      type,
      dynamic: true,
    });
  }

  const goodDescriptor: GPUBindGroupLayoutDescriptor = {
    bindings: [
      ...maxDynamicBufferBindings,
      {
        binding: maxDynamicBufferBindings.length,
        visibility: GPUShaderStage.COMPUTE,
        type,
        dynamic: false,
      },
    ],
  };

  const badDescriptor = clone(goodDescriptor);
  badDescriptor.bindings![maxDynamicBufferCount].dynamic = true;

  // Control case
  t.device.createBindGroupLayout(goodDescriptor);

  // Dynamic buffers exceed maximum in a bind group layout.
  await t.expectValidationError(() => {
    t.device.createBindGroupLayout(badDescriptor);
  });
}).params([
  { type: 'storage-buffer', maxDynamicBufferCount: 4 },
  { type: 'uniform-buffer', maxDynamicBufferCount: 8 },
]);
