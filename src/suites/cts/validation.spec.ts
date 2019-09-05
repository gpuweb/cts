export const description = `
Validation tests.
`;

import { TestGroup } from '../../framework/index.js';

import { ValidationTest } from './validation_test.js';

export const g = new TestGroup(ValidationTest);

g.test('validation/binding count mismatch', async t => {
  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        type: 'storage-buffer',
      },
    ],
  });

  t.device.createBindGroup({
    bindings: [],
    layout: bindGroupLayout,
  });

  await t.expectUncapturedError();
});

g.test('validation/binding must be present in layout', async t => {
  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        type: 'storage-buffer',
      },
    ],
  });

  t.device.createBindGroup({
    bindings: [
      {
        binding: 1,
        resource: {
          buffer: t.storageBuffer,
        },
      },
    ],
    layout: bindGroupLayout,
  });

  await t.expectUncapturedError();
});

g.test('validation/binding index too high in bind group', async t => {
  const bindingIndexTooHigh = 16;

  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        type: 'storage-buffer',
      },
    ],
  });

  t.device.createBindGroup({
    bindings: [
      {
        binding: bindingIndexTooHigh,
        resource: {
          buffer: t.storageBuffer,
        },
      },
    ],
    layout: bindGroupLayout,
  });

  await t.expectUncapturedError();
});

g.test('validation/same binding cannot be set twice', async t => {
  const bindGroupLayout = t.device.createBindGroupLayout({
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
  });

  t.device.createBindGroup({
    bindings: [
      {
        binding: 0,
        resource: {
          buffer: t.storageBuffer,
        },
      },
      {
        binding: 0,
        resource: {
          buffer: t.storageBuffer,
        },
      },
    ],
    layout: bindGroupLayout,
  });

  await t.expectUncapturedError();
});

g.test('validation/storage buffer binding must contain exactly one storage buffer', async t => {
  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        type: 'storage-buffer',
      },
    ],
  });

  const mismatchedResources = [
    {
      buffer: t.uniformBuffer,
    },
    {
      buffer: t.getErrorBuffer(),
    },
    t.sampler,
    t.sampledTexture.createView(),
  ];

  await t.expectBindGroupValidationErrors(bindGroupLayout, mismatchedResources);
});

g.test('validation/uniform buffer binding must contain exactly one uniform buffer', async t => {
  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        type: 'uniform-buffer',
      },
    ],
  });

  const mismatchedResources = [
    {
      buffer: t.storageBuffer,
    },
    {
      buffer: t.getErrorBuffer(),
    },
    t.sampler,
    t.sampledTexture.createView(),
  ];

  await t.expectBindGroupValidationErrors(bindGroupLayout, mismatchedResources);
});

g.test('validation/sampler binding must contain exactly one sampler', async t => {
  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        type: 'sampler',
      },
    ],
  });

  const mismatchedResources = [
    {
      buffer: t.uniformBuffer,
    },
    {
      buffer: t.storageBuffer,
    },
    {
      buffer: t.getErrorBuffer(),
    },
    t.sampledTexture.createView(),
  ];

  await t.expectBindGroupValidationErrors(bindGroupLayout, mismatchedResources);
});

g.test('validation/texture view binding must contain exactly one texture view', async t => {
  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        type: 'sampled-texture',
      },
    ],
  });

  const mismatchedResources = [
    {
      buffer: t.uniformBuffer,
    },
    {
      buffer: t.storageBuffer,
    },
    {
      buffer: t.getErrorBuffer(),
    },
    t.sampler,
  ];

  await t.expectBindGroupValidationErrors(bindGroupLayout, mismatchedResources);
});

g.test('validation/texture must have correct usage', async t => {
  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        type: 'sampled-texture',
      },
    ],
  });

  const outputTexture = t.device.createTexture({
    size: { width: 16, height: 16, depth: 1 },
    format: 'r8unorm',
    usage: GPUTextureUsage.OUTPUT_ATTACHMENT,
  });

  t.device.createBindGroup({
    bindings: [
      {
        binding: 0,
        resource: outputTexture.createView(),
      },
    ],
    layout: bindGroupLayout,
  });

  await t.expectUncapturedError();
});

g.test('validation/texture must have correct component type', async t => {
  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        type: 'sampled-texture',
      },
    ],
  });

  const uintTexture = t.device.createTexture({
    size: { width: 16, height: 16, depth: 1 },
    format: 'rgba8uint',
    usage: GPUTextureUsage.SAMPLED,
  });

  t.device.createBindGroup({
    bindings: [
      {
        binding: 0,
        resource: uintTexture.createView(),
      },
    ],
    layout: bindGroupLayout,
  });

  await t.expectUncapturedError();
});

g.test('validation/buffer offset for bind groups match', async t => {
  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        type: 'storage-buffer',
      },
    ],
  });

  const invalidBufferConstraints = [
    {
      offset: 1,
      size: 256,
    },
    {
      offset: 128,
      size: 256,
    },
    {
      offset: 255,
      size: 256,
    },
  ];

  for (const bufferConstraint of invalidBufferConstraints) {
    t.device.createBindGroup({
      bindings: [
        {
          binding: 0,
          resource: {
            buffer: t.storageBuffer,
            offset: bufferConstraint.offset,
            size: bufferConstraint.size,
          },
        },
      ],
      layout: bindGroupLayout,
    });

    await t.expectUncapturedError();
  }
});

g.test('validation/buffer binding fits in the buffer', async t => {
  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        type: 'storage-buffer',
      },
    ],
  });

  const invalidBufferConstraints = [
    {
      offset: 256 * 5,
      size: 0,
    },
    {
      offset: 0,
      size: 256 * 5,
    },
    {
      offset: 1024,
      size: 1,
    },
    {
      offset: 1,
      size: undefined /* Whole size */,
    },
    {
      offset: 256,
      size: -256,
    },
  ];

  for (const bufferConstraint of invalidBufferConstraints) {
    t.device.createBindGroup({
      bindings: [
        {
          binding: 0,
          resource: {
            buffer: t.storageBuffer,
            offset: bufferConstraint.offset,
            size: bufferConstraint.size,
          },
        },
      ],
      layout: bindGroupLayout,
    });

    await t.expectUncapturedError();
  }
});

g.test('validation/layout is an error', async t => {
  const errorBindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        type: 'storage-buffer',
      },
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        type: 'storage-buffer',
      },
    ],
  });

  t.device.createBindGroup({
    bindings: [
      {
        binding: 0,
        resource: {
          buffer: t.storageBuffer,
        },
      },
    ],
    layout: errorBindGroupLayout,
  });

  await t.expectUncapturedError();
});

g.test('validation/binding index too high in bind group layout', async t => {
  const bindingIndexTooHigh = 16;

  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: bindingIndexTooHigh,
        visibility: GPUShaderStage.COMPUTE,
        type: 'storage-buffer',
      },
    ],
  });

  t.device.createBindGroup({
    bindings: [
      {
        binding: 0,
        resource: {
          buffer: t.storageBuffer,
        },
      },
    ],
    layout: bindGroupLayout,
  });

  await t.expectUncapturedError();
});

g.test('validation/dynamic set to true is not allowed for sampled texture', async t => {
  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        type: 'sampled-texture',
        dynamic: true,
      },
    ],
  });

  t.device.createBindGroup({
    bindings: [
      {
        binding: 0,
        resource: t.sampledTexture.createView(),
      },
    ],
    layout: bindGroupLayout,
  });

  await t.expectUncapturedError();
});

g.test('validation/dynamic set to true is not allowed for sampler', async t => {
  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        type: 'sampler',
        dynamic: true,
      },
    ],
  });

  t.device.createBindGroup({
    bindings: [
      {
        binding: 0,
        resource: t.sampler,
      },
    ],
    layout: bindGroupLayout,
  });

  await t.expectUncapturedError();
});

g.test(
  'validation/visibility of bindings in bind group layout is not allowed to be none',
  async t => {
    const bindGroupLayout = t.device.createBindGroupLayout({
      bindings: [
        {
          binding: 0,
          visibility: GPUShaderStage.NONE,
          type: 'storage-buffer',
        },
      ],
    });

    t.device.createBindGroup({
      bindings: [
        {
          binding: 0,
          resource: {
            buffer: t.storageBuffer,
          },
        },
      ],
      layout: bindGroupLayout,
    });

    await t.expectUncapturedError();
  }
);

g.test('validation/number of dynamic storage buffer exceeds the maximum value', async t => {
  const maxDynamicUniformBufferCount = 8; // Max numbers of dynamic uniform buffers
  const maxDynamicStorageBufferCount = 4; // Max numbers of dynamic storage buffers

  const uniformBufferBindings: GPUBindGroupLayoutBinding[] = [];
  for (let i = 0; i < maxDynamicUniformBufferCount; i++) {
    uniformBufferBindings.push({
      binding: i,
      visibility: GPUShaderStage.COMPUTE,
      type: 'uniform-buffer',
      dynamic: true,
    });
  }

  const storageBufferBindings: GPUBindGroupLayoutBinding[] = [];
  for (let i = 0; i < maxDynamicStorageBufferCount; i++) {
    storageBufferBindings.push({
      binding: i,
      visibility: GPUShaderStage.COMPUTE,
      type: 'storage-buffer',
      dynamic: true,
    });
  }

  const maxUniformBufferBindGroupLayout = t.device.createBindGroupLayout({
    bindings: uniformBufferBindings,
  });

  const maxStorageBufferBindGroupLayout = t.device.createBindGroupLayout({
    bindings: storageBufferBindings,
  });

  {
    // Check dynamic uniform buffers excedd maximum in pipeline layout.
    const uniformBufferBindGroupLayout = t.device.createBindGroupLayout({
      bindings: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          type: 'uniform-buffer',
          dynamic: true,
        },
      ],
    });

    t.device.createPipelineLayout({
      bindGroupLayouts: [maxUniformBufferBindGroupLayout, uniformBufferBindGroupLayout],
    });

    await t.expectUncapturedError();
  }
  {
    // Check dynamic storage buffers exceed maximum in pipeline layout
    const storageBufferBindGroupLayout = t.device.createBindGroupLayout({
      bindings: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          type: 'storage-buffer',
          dynamic: true,
        },
      ],
    });

    t.device.createPipelineLayout({
      bindGroupLayouts: [maxStorageBufferBindGroupLayout, storageBufferBindGroupLayout],
    });

    await t.expectUncapturedError();
  }
  {
    // Check dynamic uniform buffers exceed maximum in bind group layout.
    const uniformBufferBindGroupLayout = t.device.createBindGroupLayout({
      bindings: [
        ...uniformBufferBindings,
        {
          binding: uniformBufferBindings.length,
          visibility: GPUShaderStage.COMPUTE,
          type: 'uniform-buffer',
          dynamic: true,
        },
      ],
    });

    t.device.createPipelineLayout({
      bindGroupLayouts: [uniformBufferBindGroupLayout],
    });

    await t.expectUncapturedError();
  }
  {
    // Check dynamic storage buffers exceed maximum in bind group layout.
    const storageBufferBindGroupLayout = t.device.createBindGroupLayout({
      bindings: [
        ...storageBufferBindings,
        {
          binding: storageBufferBindings.length,
          visibility: GPUShaderStage.COMPUTE,
          type: 'storage-buffer',
          dynamic: true,
        },
      ],
    });

    t.device.createPipelineLayout({
      bindGroupLayouts: [storageBufferBindGroupLayout],
    });

    await t.expectUncapturedError();
  }
});

g.test('validation/dynamic offsets are not aligned', async t => {
  // Dynamic offsets are not aligned.
  const notAlignedDynamicOffsets = [1, 2];

  await t.expectUncapturedErrorInComputePass(notAlignedDynamicOffsets);
  await t.expectUncapturedErrorInRenderPass(notAlignedDynamicOffsets);
});

g.test('validation/dynamic uniform buffer out of bounds', async t => {
  // Dynamic offset + offset is larger than buffer size.
  const overflowDynamicOffsets = [1024, 0];

  await t.expectUncapturedErrorInComputePass(overflowDynamicOffsets);
  await t.expectUncapturedErrorInRenderPass(overflowDynamicOffsets);
});

g.test('validation/dynamic storage buffer out of bounds', async t => {
  // Dynamic offset + offset is larger than buffer size.
  const overflowDynamicOffsets = [1024, 0];

  await t.expectUncapturedErrorInComputePass(overflowDynamicOffsets);
  await t.expectUncapturedErrorInRenderPass(overflowDynamicOffsets);
});

g.test('validation/dynamic uniform buffer out of bounds because of binding size', async t => {
  // Dynamic offset + offset isn't larger than buffer size.
  // But with binding size, it will trigger OOB error.
  const offsets = [512, 0];

  await t.expectUncapturedErrorInComputePass(offsets);
  await t.expectUncapturedErrorInRenderPass(offsets);
});

g.test('validation/dynamic storage buffer out of bounds because of binding size', async t => {
  // Dynamic offset + offset isn't larger than buffer size.
  // But with binding size, it will trigger OOB error.
  const offsets = [0, 512];

  await t.expectUncapturedErrorInComputePass(offsets);
  await t.expectUncapturedErrorInRenderPass(offsets);
});
