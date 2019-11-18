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

  // Control case
  t.device.createBindGroupLayout(goodDescriptor);

  const badDescriptor = clone(goodDescriptor);
  badDescriptor.bindings![1].binding = 0;

  // Binding index 0 can't be specified twice.
  t.expectValidationError(() => {
    t.device.createBindGroupLayout(badDescriptor);
  });
});

g.test('negative binding index', async t => {
  const goodDescriptor: GPUBindGroupLayoutDescriptor = {
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        type: 'storage-buffer',
      },
    ],
  };

  // Control case
  t.device.createBindGroupLayout(goodDescriptor);

  // Negative binding index can't be specified.
  const badDescriptor = clone(goodDescriptor);
  badDescriptor.bindings![0].binding = -1;

  t.expectValidationError(() => {
    t.device.createBindGroupLayout(badDescriptor);
  });
});

g.test('Visibility of bindings can be 0', async t => {
  const descriptor: GPUBindGroupLayoutDescriptor = {
    bindings: [
      {
        binding: 0,
        visibility: 0,
        type: 'storage-buffer',
      },
    ],
  };

  t.device.createBindGroupLayout(descriptor);
});

g.test('number of dynamic buffers exceeds the maximum value', async t => {
  const { type, maxDynamicBufferCount } = t.params;

  const maxDynamicBufferBindings: GPUBindGroupLayoutBinding[] = [];
  for (let i = 0; i < maxDynamicBufferCount; i++) {
    maxDynamicBufferBindings.push({
      binding: i,
      visibility: GPUShaderStage.COMPUTE,
      type,
      hasDynamicOffset: true,
    });
  }

  const goodDescriptor: GPUBindGroupLayoutDescriptor = {
    bindings: [
      ...maxDynamicBufferBindings,
      {
        binding: maxDynamicBufferBindings.length,
        visibility: GPUShaderStage.COMPUTE,
        type,
        hasDynamicOffset: false,
      },
    ],
  };

  // Control case
  t.device.createBindGroupLayout(goodDescriptor);

  // Dynamic buffers exceed maximum in a bind group layout.
  const badDescriptor = clone(goodDescriptor);
  badDescriptor.bindings![maxDynamicBufferCount].hasDynamicOffset = true;

  t.expectValidationError(() => {
    t.device.createBindGroupLayout(badDescriptor);
  });
}).params([
  { type: 'storage-buffer', maxDynamicBufferCount: 4 },
  { type: 'uniform-buffer', maxDynamicBufferCount: 8 },
]);

g.test('dynamic set to true is allowed only for buffers', async t => {
  const { type, _success } = t.params;

  const descriptor = {
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        type,
        hasDynamicOffset: true,
      },
    ],
  };

  if (_success) {
    // Control case
    t.device.createBindGroupLayout(descriptor);
  } else {
    // Dynamic set to true is not allowed in some cases.
    t.expectValidationError(() => {
      t.device.createBindGroupLayout(descriptor);
    });
  }
}).params([
  { type: 'uniform-buffer', _success: true },
  { type: 'storage-buffer', _success: true },
  { type: 'readonly-storage-buffer', _success: true },
  { type: 'sampler', _success: false },
  { type: 'sampled-texture', _success: false },
  { type: 'storage-texture', _success: false },
]);

g.test('number of resources per stage exceeds maximum value for resource type', async t => {
  const { type, maximumCount } = t.params;

  const maxResourceBindings: GPUBindGroupLayoutBinding[] = [];
  for (let i = 0; i < maximumCount; i++) {
    maxResourceBindings.push({
      binding: i,
      visibility: GPUShaderStage.FRAGMENT,
      type
    });
  }

  const goodDescriptor: GPUBindGroupLayoutDescriptor = { bindings: maxResourceBindings };

  // Control
  t.device.createBindGroupLayout(goodDescriptor);

  const badDescriptor = clone(goodDescriptor);
  badDescriptor.bindings.push({
    binding: maximumCount,
    visibility: GPUShaderStage.FRAGMENT,
    type
  });

  t.expectValidationError(() => {
    t.device.createBindGroupLayout(badDescriptor);
  });
}).params([
  { type: 'uniform-buffer', maximumCount: 12 },
  { type: 'storage-buffer', maximumCount: 4 },
  { type: 'readonly-storage-buffer', maximumCount: 4 },
  { type: 'sampler', maximumCount: 16 },
  { type: 'sampled-texture', maximumCount: 16 },
  { type: 'storage-texture', maximumCount: 4 },
]);

// storage-buffer and readonly-storage-buffer types share the same limit.
g.test('number of normal and readonly storage-buffers exceeds maximum value', async t => {
  const normalCount = Math.trunc(t.params.maximumCount / 2);

  const maxResourceBindings: GPUBindGroupLayoutBinding[] = [];
  let i = 0;
  for (; i < normalCount; ++i) {
    maxResourceBindings.push({
      binding: i,
      visibility: GPUShaderStage.FRAGMENT,
      type: 'storage-buffer'
    });
  }

  for (; i < t.params.maximumCount; ++i) {
    maxResourceBindings.push({
      binding: i,
      visibility: GPUShaderStage.FRAGMENT,
      type: 'readonly-storage-buffer'
    });
  }

  const goodDescriptor: GPUBindGroupLayoutDescriptor = { bindings: maxResourceBindings };

  // Control
  t.device.createBindGroupLayout(goodDescriptor);

  const tooManyStorageBuffersDescriptor = clone(goodDescriptor);
  tooManyStorageBuffersDescriptor.bindings.push({
    binding: t.params.maximumCount,
    visibility: GPUShaderStage.FRAGMENT,
    type: 'storage-buffer'
  });

  t.expectValidationError(() => {
    t.device.createBindGroupLayout(tooManyStorageBuffersDescriptor);
  });

  const tooManyReadonlyStorageBuffersDescriptor = clone(goodDescriptor);
  tooManyReadonlyStorageBuffersDescriptor.bindings.push({
    binding: t.params.maximumCount,
    visibility: GPUShaderStage.FRAGMENT,
    type: 'readonly-storage-buffer'
  });

  t.expectValidationError(() => {
    t.device.createBindGroupLayout(tooManyReadonlyStorageBuffersDescriptor);
  });
}).params([
  { maximumCount: 4 }
]);
