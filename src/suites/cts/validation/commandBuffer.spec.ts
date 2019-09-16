export const description = `
commandBuffer validation tests.
`;

import { TestGroup, poptions } from '../../../framework/index.js';

import { ValidationTest } from './validation_test.js';

class F extends ValidationTest {
  beginPass(
    type: string,
    commandEncoder: GPUCommandEncoder
  ): GPURenderPassEncoder | GPUComputePassEncoder {
    if (type === 'render') {
      return this.beginRenderPass(commandEncoder);
    } else if (type === 'compute') {
      return this.beginComputePass(commandEncoder);
    } else {
      throw new Error('Unexpected pass encoder type');
    }
  }

  beginRenderPass(commandEncoder: GPUCommandEncoder): GPURenderPassEncoder {
    const attachmentTexture = this.device.createTexture({
      format: 'rgba8unorm',
      size: { width: 16, height: 16, depth: 1 },
      usage: GPUTextureUsage.OUTPUT_ATTACHMENT,
    });

    return commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          attachment: attachmentTexture.createView(),
          loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
        },
      ],
    });
  }

  beginComputePass(commandEncoder: GPUCommandEncoder): GPUComputePassEncoder {
    return commandEncoder.beginComputePass();
  }
}

export const g = new TestGroup(F);

g.test('basic', async t => {
  const commandEncoder = t.device.createCommandEncoder();
  commandEncoder.finish();
});

g.test('command buffer can be ended after pass ends', async t => {
  const { type } = t.params;

  const commandEncoder = t.device.createCommandEncoder();
  const pass = t.beginPass(type, commandEncoder);
  pass.endPass();
  commandEncoder.finish();
}).params(poptions('type', ['render', 'compute']));

g.test('command buffer cannot be ended mid pass', async t => {
  const { type } = t.params;

  const commandEncoder = t.device.createCommandEncoder();
  t.beginPass(type, commandEncoder);

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
}).params(poptions('type', ['render', 'compute']));

g.test('pass cannot be used after command buffer ends', async t => {
  const { type } = t.params;

  const commandEncoder = t.device.createCommandEncoder();
  const pass = t.beginPass(type, commandEncoder);

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });

  await t.expectValidationError(() => {
    pass.endPass();
  });
}).params(poptions('type', ['render', 'compute']));

g.test('pass cannot be ended twice', async t => {
  const { type } = t.params;

  {
    // Control case
    const commandEncoder = t.device.createCommandEncoder();
    const pass = t.beginPass(type, commandEncoder);
    pass.endPass();
    commandEncoder.finish();
  }
  {
    // Pass ended twice
    await t.expectValidationError(() => {
      const commandEncoder = t.device.createCommandEncoder();
      const pass = t.beginPass(type, commandEncoder);
      pass.endPass();
      pass.endPass();
      commandEncoder.finish();
    });
  }
}).params(poptions('type', ['render', 'compute']));

g.test('beginning a pass before ending a previous pass causes an error', async t => {
  const { type } = t.params;

  {
    // Beginning a pass before ending another type of pass causes an error
    const commandEncoder = t.device.createCommandEncoder();
    const pass1 = t.beginPass(type, commandEncoder);
    const anotherType = type === 'render' ? 'compute' : 'render';
    const pass2 = t.beginPass(anotherType, commandEncoder);
    pass1.endPass();
    pass2.endPass();

    await t.expectValidationError(() => {
      commandEncoder.finish();
    });
  }
  {
    // Beginning a pass before ending another pass of same type causes an error
    const commandEncoder = t.device.createCommandEncoder();
    const pass1 = t.beginPass(type, commandEncoder);
    const pass2 = t.beginPass(type, commandEncoder);
    pass1.endPass();
    pass2.endPass();

    await t.expectValidationError(() => {
      commandEncoder.finish();
    });
  }
}).params(poptions('type', ['render', 'compute']));

g.test('encoding command after a successful finish produces an error', async t => {
  const copyBuffer = t.device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  // Successful finish() is called before encoding command
  const commandEncoder = t.device.createCommandEncoder();
  commandEncoder.finish();

  await t.expectValidationError(() => {
    commandEncoder.copyBufferToBuffer(copyBuffer, 0, copyBuffer, 0, 16);
  });
});

g.test('encoding command after a failed finish produces an error', async t => {
  const copyBuffer = t.device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  const errorBuffer = await t.getErrorBuffer();

  // Failed finish() is called before encoding command
  const commandEncoder = t.device.createCommandEncoder();
  commandEncoder.copyBufferToBuffer(errorBuffer, 0, errorBuffer, 0, 16);

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });

  await t.expectValidationError(() => {
    commandEncoder.copyBufferToBuffer(copyBuffer, 0, copyBuffer, 0, 16);
  });
});

g.test('using a single buffer in multiple read usages in the same pass is allowed', async t => {
  const buffer = t.device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.INDEX,
  });

  // Use the buffer as both index and vertex in the same pass
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  renderPass.setIndexBuffer(buffer, 0);
  renderPass.setVertexBuffers(0, [buffer], [0]);
  renderPass.endPass();
  commandEncoder.finish();
});

g.test('using same buffer as both readable and writable in same pass is disallowed', async t => {
  const buffer = t.device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDEX,
  });

  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        type: 'storage-buffer',
      },
    ],
  });

  const bindGroup = t.device.createBindGroup({
    bindings: [
      {
        binding: 0,
        resource: { buffer },
      },
    ],
    layout: bindGroupLayout,
  });

  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  renderPass.setIndexBuffer(buffer, 0);
  renderPass.setBindGroup(0, bindGroup);
  renderPass.endPass();

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
});

g.test('using same texture as both readable and writable in same pass is disallowed', async t => {
  const texture = t.device.createTexture({
    format: 'rgba8unorm',
    size: { width: 1, height: 1, depth: 1 },
    usage: GPUTextureUsage.SAMPLED | GPUTextureUsage.OUTPUT_ATTACHMENT,
  });

  const textureView = texture.createView();

  const bindGroupLayout = t.device.createBindGroupLayout({
    bindings: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        type: 'sampled-texture',
      },
    ],
  });

  // Bind group will use the texture as sampled
  const bindGroup = t.device.createBindGroup({
    bindings: [
      {
        binding: 0,
        resource: textureView,
      },
    ],
    layout: bindGroupLayout,
  });

  // Render pass will use the texture as an output attachment
  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      {
        attachment: textureView,
        loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
      },
    ],
  };

  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
  renderPass.setBindGroup(0, bindGroup);
  renderPass.endPass();

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
});
