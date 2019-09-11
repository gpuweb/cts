export const description = `
createBindGroup validation tests.
`;

import { TestGroup } from '../../../framework/index.js';

import { ValidationTest } from './validation_test.js';

function clone(descriptor: GPUTextureDescriptor): GPUTextureDescriptor {
  return JSON.parse(JSON.stringify(descriptor));
}

export class F extends ValidationTest {
  getStorageBuffer(): GPUBuffer {
    return this.device.createBuffer({
      size: 1024,
      usage: GPUBufferUsage.STORAGE,
    });
  }

  getUniformBuffer(): GPUBuffer {
    return this.device.createBuffer({
      size: 1024,
      usage: GPUBufferUsage.UNIFORM,
    });
  }

  getSampler(): GPUSampler {
    return this.device.createSampler();
  }

  getSampledTexture(): GPUTexture {
    return this.device.createTexture({
      size: { width: 16, height: 16, depth: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.SAMPLED,
    });
  }

  getStorageTexture(): GPUTexture {
    return this.device.createTexture({
      size: { width: 16, height: 16, depth: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE,
    });
  }

  async getErrorBuffer(): Promise<GPUBuffer> {
    this.device.pushErrorScope('validation');
    const errorBuffer = this.device.createBuffer({
      size: 1024,
      usage: 0xffff, // Invalid GPUBufferUsage
    });
    await this.device.popErrorScope();
    return errorBuffer;
  }
}

export const g = new TestGroup(F);

g.test('binding count mismatch', async t => {
  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        type: 'storage-buffer',
      },
    ],
  });

  const goodDescriptor: GPUBindGroupDescriptor = {
    bindings: [
      {
        binding: 0,
        resource: {
          buffer: t.getStorageBuffer(),
        },
      },
    ],
    layout: bindGroupLayout,
  };

  const badDescriptor: GPUBindGroupDescriptor = {
    bindings: [
      {
        binding: 0,
        resource: {
          buffer: t.getStorageBuffer(),
        },
      },
      // Another binding is added.
      {
        binding: 1,
        resource: {
          buffer: t.getStorageBuffer(),
        },
      },
    ],
    layout: bindGroupLayout,
  };

  // Control case
  t.device.createBindGroup(goodDescriptor);

  // Another binding is not expected.
  await t.expectValidationError(() => {
    t.device.createBindGroup(badDescriptor);
  });
});

g.test('binding must be present in layout', async t => {
  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        type: 'storage-buffer',
      },
    ],
  });

  const goodDescriptor: GPUBindGroupDescriptor = {
    bindings: [
      {
        binding: 0,
        resource: {
          buffer: t.getStorageBuffer(),
        },
      },
    ],
    layout: bindGroupLayout,
  };

  const badDescriptor: GPUBindGroupDescriptor = {
    bindings: [
      {
        binding: 1, // binding index becomes 1.
        resource: {
          buffer: t.getStorageBuffer(),
        },
      },
    ],
    layout: bindGroupLayout,
  };

  // Control case
  t.device.createBindGroup(goodDescriptor);

  // Binding index 0 must be present.
  await t.expectValidationError(() => {
    t.device.createBindGroup(badDescriptor);
  });
});

g.test('buffer binding must contain exactly one buffer of its type', async t => {
  const { type } = t.params;

  let matchedResource: GPUBindingResource;
  if (type === 'uniform-buffer') {
    matchedResource = { buffer: t.getUniformBuffer() };
  } else if (type === 'storage-buffer' || type === 'readonly-storage-buffer') {
    matchedResource = { buffer: t.getStorageBuffer() };
  } else if (type === 'sampler') {
    matchedResource = t.getSampler();
  } else if (type === 'sampled-texture') {
    matchedResource = t.getSampledTexture().createView();
  } else if (type === 'storage-texture') {
    matchedResource = t.getStorageTexture();
  } else {
    throw new Error('Unexpected binding type');
  }

  async function* mismatchedResources(): AsyncIterable<GPUBindingResource> {
    const errorBuffer = await t.getErrorBuffer();
    yield { buffer: errorBuffer };
    if (type !== 'uniform-buffer') {
      yield { buffer: t.getUniformBuffer() };
    }
    if (type !== 'storage-buffer' && type !== 'readonly-storage-buffer') {
      yield { buffer: t.getStorageBuffer() };
    }
    if (type !== 'sampler') {
      yield t.getSampler();
    }
    if (type !== 'sampled-texture') {
      yield t.getSampledTexture().createView();
    }
    if (type !== 'storage-texture') {
      yield t.getStorageTexture().createView();
    }
  }

  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        type,
      },
    ],
  });

  // Control case
  t.device.createBindGroup({
    bindings: [
      {
        binding: 0,
        resource: matchedResource,
      },
    ],
    layout: bindGroupLayout,
  });

  // Mismatched resources are not valid.
  for await (const mismatchedResource of mismatchedResources()) {
    const mismatchedDescriptor: GPUBindGroupDescriptor = {
      bindings: [
        {
          binding: 0,
          resource: mismatchedResource,
        },
      ],
      layout: bindGroupLayout,
    };
    await t.expectValidationError(() => {
      t.device.createBindGroup(mismatchedDescriptor);
    });
  }
}).params([
  { type: 'uniform-buffer' },
  { type: 'storage-buffer' },
  { type: 'readonly-storage-buffer' },
  { type: 'sampler' },
  { type: 'sampled-texture' },
  { type: 'storage-texture' },
]);

g.test('texture binding must have correct usage', async t => {
  const { type } = t.params;

  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        type,
      },
    ],
  });

  let usage: GPUTextureUsage;
  if (type === 'sampled-texture') {
    usage = GPUTextureUsage.SAMPLED;
  } else if (type === 'storage-texture') {
    usage = GPUTextureUsage.STORAGE;
  } else {
    throw new Error('Unexpected binding type');
  }

  function* mismatchedTextureUsages(): Iterable<GPUTextureUsage> {
    yield GPUTextureUsage.NONE;
    yield GPUTextureUsage.COPY_SRC;
    yield GPUTextureUsage.COPY_DST;
    if (type !== 'sampled-texture') {
      yield GPUTextureUsage.SAMPLED;
    }
    if (type !== 'storage-texture') {
      yield GPUTextureUsage.STORAGE;
    }
    yield GPUTextureUsage.OUTPUT_ATTACHMENT;
  }

  const goodDescriptor: GPUTextureDescriptor = {
    size: { width: 16, height: 16, depth: 1 },
    format: 'r8unorm',
    usage,
  };

  // Control case
  t.device.createBindGroup({
    bindings: [
      {
        binding: 0,
        resource: t.device.createTexture(goodDescriptor).createView(),
      },
    ],
    layout: bindGroupLayout,
  });

  for (const mismatchedTextureUsage of mismatchedTextureUsages()) {
    const badDescriptor = clone(goodDescriptor);
    badDescriptor.usage = mismatchedTextureUsage;

    // Mismatched texture binding usages are not valid.
    await t.expectValidationError(() => {
      t.device.createBindGroup({
        bindings: [
          {
            binding: 0,
            resource: t.device.createTexture(badDescriptor).createView(),
          },
        ],
        layout: bindGroupLayout,
      });
    });
  }
}).params([
  { type: 'sampled-texture' }, // (blank comment to enforce newlines on autoformat)
  { type: 'storage-texture' },
]);

g.test('texture must have correct component type', async t => {
  const { textureComponentType } = t.params;

  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        type: 'sampled-texture',
        textureComponentType,
      },
    ],
  });

  // TODO: Test more texture component types.
  let format: GPUTextureFormat;
  if (textureComponentType === 'float') {
    format = 'r8unorm';
  } else if (textureComponentType === 'sint') {
    format = 'r8sint';
  } else if (textureComponentType === 'uint') {
    format = 'r8uint';
  } else {
    throw new Error('Unexpected texture component type');
  }

  function* mismatchedTextureFormats(): Iterable<GPUTextureFormat> {
    if (textureComponentType !== 'float') {
      yield 'r8unorm';
    }
    if (textureComponentType !== 'sint') {
      yield 'r8sint';
    }
    if (textureComponentType !== 'uint') {
      yield 'r8uint';
    }
  }

  const goodDescriptor: GPUTextureDescriptor = {
    size: { width: 16, height: 16, depth: 1 },
    format,
    usage: GPUTextureUsage.SAMPLED,
  };

  // Control case
  t.device.createBindGroup({
    bindings: [
      {
        binding: 0,
        resource: t.device.createTexture(goodDescriptor).createView(),
      },
    ],
    layout: bindGroupLayout,
  });

  for (const mismatchedTextureFormat of mismatchedTextureFormats()) {
    const badDescriptor = clone(goodDescriptor);
    badDescriptor.format = mismatchedTextureFormat;

    // Mismatched texture binding formats are not valid.
    await t.expectValidationError(() => {
      t.device.createBindGroup({
        bindings: [
          {
            binding: 0,
            resource: t.device.createTexture(badDescriptor).createView(),
          },
        ],
        layout: bindGroupLayout,
      });
    });
  }
}).params([
  { textureComponentType: 'float' },
  { textureComponentType: 'sint' },
  { textureComponentType: 'uint' },
]);

// TODO: Write test for all dimensions.
g.test('texture must have correct dimension', async t => {
  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        type: 'sampled-texture',
        textureDimension: '2d',
      },
    ],
  });

  const goodDescriptor: GPUTextureDescriptor = {
    size: { width: 16, height: 16, depth: 1 },
    arrayLayerCount: 1,
    format: 'rgba8unorm',
    usage: GPUTextureUsage.SAMPLED,
  };

  // Control case
  t.device.createBindGroup({
    bindings: [
      {
        binding: 0,
        resource: t.device.createTexture(goodDescriptor).createView(),
      },
    ],
    layout: bindGroupLayout,
  });

  const badDescriptor = clone(goodDescriptor);
  badDescriptor.arrayLayerCount = 2;

  // Mismatched texture binding formats are not valid.
  await t.expectValidationError(() => {
    t.device.createBindGroup({
      bindings: [
        {
          binding: 0,
          resource: t.device.createTexture(badDescriptor).createView(),
        },
      ],
      layout: bindGroupLayout,
    });
  });
});

g.test('buffer offset and size for bind groups match', async t => {
  const { offset, size, success } = t.params;

  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        type: 'storage-buffer',
      },
    ],
  });

  const buffer = t.device.createBuffer({
    size: 1024,
    usage: GPUBufferUsage.STORAGE,
  });

  const descriptor: GPUBindGroupDescriptor = {
    bindings: [
      {
        binding: 0,
        resource: { buffer, offset, size },
      },
    ],
    layout: bindGroupLayout,
  };

  // Control case
  if (success) {
    t.device.createBindGroup(descriptor);
  } else {
    await t.expectValidationError(() => {
      t.device.createBindGroup(descriptor);
    });
  }
}).params([
  { offset: 0, size: 512, success: true }, // offset 0 is valid
  { offset: 256, size: 256, success: true }, // offset 256 (aligned) is valid
  { offset: 1, size: 256, success: false }, // unaligned buffer offset is invalid
  { offset: 128, size: 256, success: false }, // unaligned buffer offset is invalid
  { offset: 255, size: 256, success: false }, // unaligned buffer offset is invalid
  { offset: 0, size: 256, success: true }, // touching the start of the buffer works
  { offset: 256 * 3, size: 256, success: true }, // touching the end of the buffer works
  { offset: 1024, size: 0, success: true }, // touching the start of the buffer works
  { offset: 0, size: 1024, success: true }, // touching the full buffer works
  { offset: 0, success: true }, // touching the full buffer works
  { offset: 256 * 5, size: 0, success: false }, // offset is OOB
  { offset: 0, size: 256 * 5, success: false }, // size is OOB
  { offset: 1024, size: 1, success: false }, // offset+size is OOB
  { offset: 1, success: false }, // offset+size is OOB
  { offset: 256, size: -256, success: false }, // offset+size overflows to be 0
]);
