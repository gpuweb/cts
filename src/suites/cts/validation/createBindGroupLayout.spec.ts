export const description = `
createBindGroupLayout validation tests.
`;

import { TestGroup, pcombine, poptions } from '../../../framework/index.js';

import { ValidationTest } from './validation_test.js';

// TODO: Move this somewhere central?
const kMaxBindingsPerBindGroup = 16;

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

// One bind group layout can have a maximum number of each type of binding (which is different
// for each type). Test that works, then add one more binding of *the same or different* type.
// The first type has visibility ALL, and the extra type has only a single visibility.
g.test('max number of resources of one type plus one of any type', async t => {
  const { maxedType, maxedCount, extraType, visibility } = t.params;

  const maxResourceBindings: GPUBindGroupLayoutBinding[] = [];
  for (let i = 0; i < maxedCount; i++) {
    maxResourceBindings.push({
      binding: i,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
      type: maxedType,
    });
  }

  const goodDescriptor: GPUBindGroupLayoutDescriptor = { bindings: maxResourceBindings };

  // Control
  t.device.createBindGroupLayout(goodDescriptor);

  const vis = visibility === 0 ? 0 : GPUShaderStage[visibility as keyof typeof GPUShaderStage];
  const newDescriptor = clone(goodDescriptor);
  newDescriptor.bindings!.push({
    binding: maxedCount,
    visibility: vis,
    type: maxedType,
  });

  const shouldError =
    maxedCount >= kMaxBindingsPerBindGroup ||
    maxedType === extraType ||
    (maxedType === 'storage-buffer' && extraType === 'readonly-storage-buffer') ||
    (maxedType === 'readonly-storage-buffer' && extraType === 'storage-buffer');

  t.expectValidationError(() => {
    t.device.createBindGroupLayout(newDescriptor);
  }, shouldError);
}).params(
  pcombine(
    [
      { maxedType: 'uniform-buffer', maxedCount: 12 },
      { maxedType: 'storage-buffer', maxedCount: 4 },
      { maxedType: 'readonly-storage-buffer', maxedCount: 4 },
      { maxedType: 'sampler', maxedCount: 16 },
      { maxedType: 'sampled-texture', maxedCount: 16 },
      { maxedType: 'storage-texture', maxedCount: 4 },
    ],
    poptions('extraType', [
      'uniform-buffer',
      'storage-buffer',
      'readonly-storage-buffer',
      'sampler',
      'sampled-texture',
      'storage-texture',
    ]),
    poptions('visibility', [0, 'VERTEX', 'FRAGMENT', 'COMPUTE'])
  )
);

// storage-buffer and readonly-storage-buffer types share the same limit.
g.test('number of normal and readonly storage buffers exceeds maximum value', async t => {
  const normalCount = Math.trunc(t.params.maximumCount / 2);

  const maxResourceBindings: GPUBindGroupLayoutBinding[] = [];
  let i = 0;
  for (; i < normalCount; ++i) {
    maxResourceBindings.push({
      binding: i,
      visibility: GPUShaderStage.FRAGMENT,
      type: 'storage-buffer',
    });
  }

  for (; i < t.params.maximumCount; ++i) {
    maxResourceBindings.push({
      binding: i,
      visibility: GPUShaderStage.FRAGMENT,
      type: 'readonly-storage-buffer',
    });
  }

  const goodDescriptor: GPUBindGroupLayoutDescriptor = { bindings: maxResourceBindings };

  // Control
  t.device.createBindGroupLayout(goodDescriptor);

  const tooManyStorageBuffersDescriptor = clone(goodDescriptor);
  tooManyStorageBuffersDescriptor.bindings!.push({
    binding: t.params.maximumCount,
    visibility: GPUShaderStage.FRAGMENT,
    type: 'storage-buffer',
  });

  t.expectValidationError(() => {
    t.device.createBindGroupLayout(tooManyStorageBuffersDescriptor);
  });

  const tooManyReadonlyStorageBuffersDescriptor = clone(goodDescriptor);
  tooManyReadonlyStorageBuffersDescriptor.bindings!.push({
    binding: t.params.maximumCount,
    visibility: GPUShaderStage.FRAGMENT,
    type: 'readonly-storage-buffer',
  });

  t.expectValidationError(() => {
    t.device.createBindGroupLayout(tooManyReadonlyStorageBuffersDescriptor);
  });
}).params([{ maximumCount: 4 }]);
