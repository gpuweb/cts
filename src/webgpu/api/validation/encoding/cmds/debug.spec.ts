export const description = `
API validation test for debug groups and markers

Test Coverage:
  - For each encoder type (GPUCommandEncoder, GPUComputeEncoder, GPURenderPassEncoder,
  GPURenderBundleEncoder):
    - Test that all pushDebugGroup must have a corresponding popDebugGroup
      - Push and pop counts of 0, 1, and 2 will be used.
      - An error must be generated for non matching counts.
    - Test calling pushDebugGroup with empty and non-empty strings.
    - Test inserting a debug marker with empty and non-empty strings.
`;

import { poptions, params } from '../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { assert } from '../../../../../common/framework/util/util.js';

import { ValidationTest } from './../../validation_test.js';

type Encoder = GPUCommandEncoder | GPUProgrammablePassEncoder;
const kEncoderTypes = ['non-pass', 'compute pass', 'render pass', 'render bundle'] as const;
type EncoderType = typeof kEncoderTypes[number];

class F extends ValidationTest {
  private commandEncoder: GPUCommandEncoder | undefined = undefined;

  makeAttachmentTexture(): GPUTexture {
    return this.device.createTexture({
      format: 'rgba8unorm',
      size: { width: 16, height: 16, depth: 1 },
      usage: GPUTextureUsage.OUTPUT_ATTACHMENT,
    });
  }

  createEncoder(encoderType: EncoderType): Encoder {
    assert(this.commandEncoder === undefined);
    switch (encoderType) {
      case 'non-pass':
        return this.device.createCommandEncoder({});
      case 'render bundle':
        return this.device.createRenderBundleEncoder({ colorFormats: ['rgba8unorm'] });
      case 'compute pass':
        this.commandEncoder = this.device.createCommandEncoder({});
        return this.commandEncoder.beginComputePass({});
      case 'render pass':
        this.commandEncoder = this.device.createCommandEncoder({});
        return this.commandEncoder.beginRenderPass({
          colorAttachments: [
            {
              attachment: this.makeAttachmentTexture().createView(),
              loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
            },
          ],
        });
    }
  }

  finishEncoder(encoder: Encoder, encoderType: EncoderType) {
    let commandBuffer: GPUCommandBuffer | undefined = undefined;
    switch (encoderType) {
      case 'non-pass': {
        commandBuffer = (encoder as GPUCommandEncoder).finish({});
        break;
      }
      case 'render bundle': {
        const bundle = (encoder as GPURenderBundleEncoder).finish({});
        const commandEncoder = this.device.createCommandEncoder({});
        const pass = commandEncoder.beginRenderPass({
          colorAttachments: [
            {
              attachment: this.makeAttachmentTexture().createView(),
              loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
            },
          ],
        });
        pass.executeBundles([bundle]);
        pass.endPass();
        commandBuffer = commandEncoder.finish({});
        break;
      }
      case 'compute pass':
      case 'render pass': {
        assert(this.commandEncoder !== undefined);
        (encoder as GPUComputePassEncoder | GPURenderPassEncoder).endPass();
        commandBuffer = this.commandEncoder?.finish();
        this.commandEncoder = undefined;
        break;
      }
    }
    if (commandBuffer !== undefined) {
      this.queue.submit([commandBuffer]);
    }
  }
}

export const g = makeTestGroup(F);

g.test('debug_group_balanced')
  .params(
    params()
      .combine(poptions('encoderType', kEncoderTypes))
      .combine(poptions('pushCount', [0, 1, 2]))
      .combine(poptions('popCount', [0, 1, 2]))
  )
  .fn(t => {
    const encoder = t.createEncoder(t.params.encoderType);
    for (let i = 0; i < t.params.pushCount; ++i) {
      encoder.pushDebugGroup(`${i}`);
    }
    for (let i = 0; i < t.params.popCount; ++i) {
      encoder.popDebugGroup();
    }
    const shouldError = t.params.popCount !== t.params.pushCount;
    t.expectValidationError(() => {
      t.finishEncoder(encoder, t.params.encoderType);
    }, shouldError);
  });

g.test('debug_group')
  .params(
    params()
      .combine(poptions('encoderType', kEncoderTypes))
      .combine(poptions('label', ['', 'group']))
  )
  .fn(t => {
    const encoder = t.createEncoder(t.params.encoderType);
    encoder.pushDebugGroup(t.params.label);
    encoder.popDebugGroup();
    t.finishEncoder(encoder, t.params.encoderType);
  });

g.test('debug_marker')
  .params(
    params()
      .combine(poptions('encoderType', kEncoderTypes))
      .combine(poptions('label', ['', 'marker']))
  )
  .fn(t => {
    const encoder = t.createEncoder(t.params.encoderType);
    encoder.insertDebugMarker(t.params.label);
    t.finishEncoder(encoder, t.params.encoderType);
  });
