export const description = `
Test rendering to 3d texture slices.
- Render to same slice on different render pass, different textures, or texture [1, 1, N]'s different mip levels
- Render to different slices at mip levels on same texture in render pass
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { kBytesPerRowAlignment } from '../../../util/texture/layout.js';

const kSize = 4;

class F extends GPUTest {
  create3DTexture(
    options: {
      format?: GPUTextureFormat;
      width?: number;
      height?: number;
      depthOrArrayLayers?: number;
      mipLevelCount?: number;
      usage?: GPUTextureUsageFlags;
    } = {}
  ): GPUTexture {
    const {
      format = 'rgba8unorm',
      width = kSize,
      height = kSize,
      depthOrArrayLayers = 1,
      mipLevelCount = 1,
      usage = GPUTextureUsage.RENDER_ATTACHMENT,
    } = options;

    return this.device.createTexture({
      size: [width, height, depthOrArrayLayers],
      dimension: '3d',
      format,
      mipLevelCount,
      usage,
    });
  }

  getColorAttachment(
    texture: GPUTexture,
    textureViewDescriptor?: GPUTextureViewDescriptor
  ): GPURenderPassColorAttachment {
    return {
      view: texture.createView(textureViewDescriptor),
      clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
      loadOp: 'clear',
      storeOp: 'store',
    };
  }

  createRenderPipeline(
    options: {
      format?: GPUTextureFormat;
      attachmentCount?: number;
    } = {}
  ): GPURenderPipeline {
    const { format = 'rgba8unorm', attachmentCount = 1 } = options;

    let locations = '';
    let outputs = '';
    const targets: GPUColorTargetState[] | null = [];
    for (let i = 0; i < attachmentCount; i++) {
      locations = locations + `@location(${i}) color${i} : vec4f, \n`;
      outputs = outputs + `output.color${i} = vec4f(0.0, 1.0, 0.0, 1.0);\n`;
      targets.push({ format } as GPUColorTargetState);
    }

    return this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: this.device.createShaderModule({
          code: `
          @vertex fn main(
            @builtin(vertex_index) VertexIndex : u32
            ) -> @builtin(position) vec4<f32> {
              var pos : array<vec2<f32>, 3> = array<vec2<f32>, 3>(
                  vec2<f32>(-1.0, 1.0),
                  vec2<f32>(1.0, -1.0),
                  vec2<f32>(-1.0, -1.0));
              return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
            }
            `,
        }),
        entryPoint: 'main',
      },
      fragment: {
        module: this.device.createShaderModule({
          code: `
            struct Output {
              ${locations}
            }
            @fragment fn main() -> Output {
              var output : Output;
              ${outputs}
              return output;
            }
            `,
        }),
        entryPoint: 'main',
        targets,
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  getBufferSizeAndOffset(
    attachmentWidth: number,
    attachmentHeight: number,
    attachmentCount: number
  ): { bufferSize: number; bufferOffset: number } {
    const bufferSize =
      (attachmentCount * attachmentHeight - 1) * kBytesPerRowAlignment + attachmentWidth * 4;
    const bufferOffset = attachmentCount > 1 ? attachmentHeight * kBytesPerRowAlignment : 0;
    return { bufferSize, bufferOffset };
  }

  checkAttachmentResult(
    attachmentWidth: number,
    attachmentHeight: number,
    attachmentCount: number,
    buffer: GPUBuffer
  ) {
    const { bufferSize, bufferOffset } = this.getBufferSizeAndOffset(
      attachmentWidth,
      attachmentHeight,
      attachmentCount
    );
    const expectedData = new Uint8Array(bufferSize);
    for (let i = 0; i < attachmentCount; i++) {
      for (let j = 0; j < attachmentHeight; j++) {
        for (let k = 0; k < attachmentWidth; k++) {
          expectedData[i * bufferOffset + j * 256 + k * 4] = k < j ? 0x00 : 0xff;
          expectedData[i * bufferOffset + j * 256 + k * 4 + 1] = k < j ? 0xff : 0x00;
          expectedData[i * bufferOffset + j * 256 + k * 4 + 2] = 0x00;
          expectedData[i * bufferOffset + j * 256 + k * 4 + 3] = 0xff;
        }
      }
    }

    this.expectGPUBufferValuesEqual(buffer, expectedData);
  }
}

export const g = makeTestGroup(F);

g.test('one_color_attachment,mip_levels')
  .desc(
    `
  Render to a 3d texture slice with mip levels.
  `
  )
  .params(u => u.combine('mipLevel', [0, 1, 2]).combine('depthSlice', [0, 1]))
  .fn(t => {
    const { mipLevel, depthSlice } = t.params;

    const texture = t.create3DTexture({
      width: kSize << mipLevel,
      height: kSize << mipLevel,
      depthOrArrayLayers: 2 << mipLevel,
      mipLevelCount: mipLevel + 1,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    const { bufferSize } = t.getBufferSizeAndOffset(kSize, kSize, 1);

    const buffer = t.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    const pipeline = t.createRenderPipeline();

    const colorAttachment = t.getColorAttachment(texture, {
      baseMipLevel: mipLevel,
      mipLevelCount: 1,
    });
    colorAttachment.depthSlice = depthSlice;

    const encoder = t.createEncoder('non-pass');
    const pass = encoder.encoder.beginRenderPass({ colorAttachments: [colorAttachment] });
    pass.setPipeline(pipeline);
    pass.draw(3);
    pass.end();
    encoder.encoder.copyTextureToBuffer(
      { texture, mipLevel, origin: { x: 0, y: 0, z: depthSlice } },
      { buffer, bytesPerRow: 256 },
      { width: kSize, height: kSize, depthOrArrayLayers: 1 }
    );
    t.device.queue.submit([encoder.finish()]);

    t.checkAttachmentResult(kSize, kSize, 1, buffer);
  });

g.test('multiple_color_attachments,same_mip_level')
  .desc(
    `
  Render to the different slices of 3d texture in multiple color attachments.
  - Same 3d texture with different slices at same mip level
  - Different 3d textures with same slice at same mip level
  `
  )
  .params(u =>
    u
      .combine('sameTexture', [true, false])
      .beginSubcases()
      .combine('samePass', [true, false])
      .combine('mipLevel', [0, 1])
  )
  .fn(t => {
    const { sameTexture, samePass, mipLevel } = t.params;

    const format = 'rgba8unorm' as GPUTextureFormat;
    const formatByteCost = 8;
    const maxAttachmentCountPerSample = Math.trunc(
      t.device.limits.maxColorAttachmentBytesPerSample / formatByteCost
    );
    const attachmentCount = Math.min(
      maxAttachmentCountPerSample,
      t.device.limits.maxColorAttachments
    );

    const descriptor = {
      format,
      width: kSize << mipLevel,
      height: kSize << mipLevel,
      depthOrArrayLayers: (1 << attachmentCount) << mipLevel,
      mipLevelCount: mipLevel + 1,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    };
    const texture = t.create3DTexture(descriptor);

    const textures: GPUTexture[] = [];
    const colorAttachments: GPURenderPassColorAttachment[] = [];
    for (let i = 0; i < attachmentCount; i++) {
      if (sameTexture) {
        textures.push(texture);
      } else {
        const diffTexture = t.create3DTexture(descriptor);
        textures.push(diffTexture);
      }

      const colorAttachment = t.getColorAttachment(textures[i], {
        baseMipLevel: mipLevel,
        mipLevelCount: 1,
      });
      colorAttachment.depthSlice = sameTexture ? i : 0;
      colorAttachments.push(colorAttachment);
    }

    const encoder = t.createEncoder('non-pass');

    if (samePass) {
      const pipeline = t.createRenderPipeline({ attachmentCount });

      const pass = encoder.encoder.beginRenderPass({ colorAttachments });
      pass.setPipeline(pipeline);
      pass.draw(3);
      pass.end();
    } else {
      for (let i = 0; i < attachmentCount; i++) {
        const pipeline = t.createRenderPipeline();

        const pass = encoder.encoder.beginRenderPass({ colorAttachments: [colorAttachments[i]] });
        pass.setPipeline(pipeline);
        pass.draw(3);
        pass.end();
      }
    }

    const { bufferSize, bufferOffset } = t.getBufferSizeAndOffset(kSize, kSize, attachmentCount);
    const buffer = t.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    for (let i = 0; i < attachmentCount; i++) {
      encoder.encoder.copyTextureToBuffer(
        {
          texture: textures[i],
          mipLevel,
          origin: { x: 0, y: 0, z: sameTexture ? i : 0 },
        },
        { buffer, bytesPerRow: 256, offset: bufferOffset * i },
        { width: kSize, height: kSize, depthOrArrayLayers: 1 }
      );
    }

    t.device.queue.submit([encoder.finish()]);

    t.checkAttachmentResult(kSize, kSize, attachmentCount, buffer);
  });

g.test('multiple_color_attachments,same_slice_with_diff_mip_levels')
  .desc(
    `
  Render to the same slice of a 3d texture at different mip levels in multiple color attachments.
  - For texture size with 1x1xN, the same depth slice of different mip levels can be rendered.
  `
  )
  .params(u => u.combine('depthSlice', [0, 1]))
  .fn(t => {
    const { depthSlice } = t.params;

    const kBaseSize = 1;

    const format = 'rgba8unorm' as GPUTextureFormat;
    const formatByteCost = 8;
    const maxAttachmentCountPerSample = Math.trunc(
      t.device.limits.maxColorAttachmentBytesPerSample / formatByteCost
    );
    const attachmentCount = Math.min(
      maxAttachmentCountPerSample,
      t.device.limits.maxColorAttachments
    );

    const descriptor = {
      format,
      width: kBaseSize,
      height: kBaseSize,
      depthOrArrayLayers: (depthSlice + 1) << attachmentCount,
      mipLevelCount: attachmentCount,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    };
    const texture = t.create3DTexture(descriptor);

    const colorAttachments: GPURenderPassColorAttachment[] = [];
    for (let i = 0; i < attachmentCount; i++) {
      const colorAttachment = t.getColorAttachment(texture, { baseMipLevel: i, mipLevelCount: 1 });
      colorAttachment.depthSlice = depthSlice;
      colorAttachments.push(colorAttachment);
    }

    const pipeline = t.createRenderPipeline({ attachmentCount });

    const encoder = t.createEncoder('non-pass');

    const pass = encoder.encoder.beginRenderPass({ colorAttachments });
    pass.setPipeline(pipeline);
    pass.draw(3);
    pass.end();

    const { bufferSize, bufferOffset } = t.getBufferSizeAndOffset(
      kBaseSize,
      kBaseSize,
      attachmentCount
    );
    const buffer = t.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    for (let i = 0; i < attachmentCount; i++) {
      encoder.encoder.copyTextureToBuffer(
        { texture, mipLevel: i, origin: { x: 0, y: 0, z: depthSlice } },
        { buffer, bytesPerRow: 256, offset: bufferOffset * i },
        { width: kBaseSize, height: kBaseSize, depthOrArrayLayers: 1 }
      );
    }

    t.device.queue.submit([encoder.finish()]);

    t.checkAttachmentResult(kBaseSize, kBaseSize, attachmentCount, buffer);
  });
