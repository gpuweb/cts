export const description = `
Validation tests to all commands of GPUCommandEncoder, GPUComputePassEncoder, and
GPURenderPassEncoder when the encoder is not finished.

- TODO: Test all commands of GPUComputePassEncoder and GPURenderPassEncoder.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { keysOf } from '../../../../common/util/data_tables.js';
import { unreachable } from '../../../../common/util/util.js';
import { ValidationTest } from '../validation_test.js';

export const g = makeTestGroup(ValidationTest);

type EncoderCommands = keyof Omit<
  GPUCommandEncoder,
  '__brand' | 'label' | 'finish' | 'beginComputePass' | 'beginRenderPass'
>;
const kEncoderCommandInfo: {
  readonly [k in EncoderCommands]: {};
} = {
  clearBuffer: {},
  copyBufferToBuffer: {},
  copyBufferToTexture: {},
  copyTextureToBuffer: {},
  copyTextureToTexture: {},
  insertDebugMarker: {},
  popDebugGroup: {},
  pushDebugGroup: {},
  writeTimestamp: {},
  resolveQuerySet: {},
};
const kEncoderCommands = keysOf(kEncoderCommandInfo);

g.test('non_pass_commands')
  .params(u =>
    u
      .combine('command', kEncoderCommands)
      .beginSubcases()
      .combine('finishBeforeCommand', [false, true])
  )
  .beforeAllSubcases(t => {
    switch (t.params.command) {
      case 'writeTimestamp':
        t.selectDeviceOrSkipTestCase('timestamp-query');
        break;
    }
  })
  .fn(t => {
    const { command, finishBeforeCommand } = t.params;

    const srcBuffer = t.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });
    const dstBuffer = t.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.QUERY_RESOLVE,
    });

    const textureSize = { width: 1, height: 1 };
    const textureFormat = 'rgba8unorm';
    const srcTexture = t.device.createTexture({
      size: textureSize,
      format: textureFormat,
      usage: GPUTextureUsage.COPY_SRC,
    });
    const dstTexture = t.device.createTexture({
      size: textureSize,
      format: textureFormat,
      usage: GPUTextureUsage.COPY_DST,
    });

    const encoder = t.device.createCommandEncoder();

    if (finishBeforeCommand) encoder.finish();

    t.expectValidationError(() => {
      switch (command) {
        case 'clearBuffer':
          {
            encoder.clearBuffer(dstBuffer, 0, 16);
          }
          break;
        case 'copyBufferToBuffer':
          {
            encoder.copyBufferToBuffer(srcBuffer, 0, dstBuffer, 0, 0);
          }
          break;
        case 'copyBufferToTexture':
          {
            encoder.copyBufferToTexture(
              { buffer: srcBuffer },
              { texture: dstTexture },
              textureSize
            );
          }
          break;
        case 'copyTextureToBuffer':
          {
            encoder.copyTextureToBuffer(
              { texture: srcTexture },
              { buffer: dstBuffer },
              textureSize
            );
          }
          break;
        case 'copyTextureToTexture':
          {
            encoder.copyTextureToTexture(
              { texture: srcTexture },
              { texture: dstTexture },
              textureSize
            );
          }
          break;
        case 'insertDebugMarker':
          {
            encoder.insertDebugMarker('marker');
          }
          break;
        case 'pushDebugGroup':
        case 'popDebugGroup':
          {
            encoder.pushDebugGroup('initializeWithStoreOp');
            encoder.popDebugGroup();
          }
          break;
        case 'writeTimestamp':
          {
            const querySet = t.device.createQuerySet({ type: 'timestamp', count: 1 });
            encoder.writeTimestamp(querySet, 0);
          }
          break;
        case 'resolveQuerySet':
          {
            const querySet = t.device.createQuerySet({ type: 'occlusion', count: 1 });
            encoder.resolveQuerySet(querySet, 0, 1, dstBuffer, 0);
          }
          break;
        default:
          unreachable();
      }
    }, finishBeforeCommand);

    if (!finishBeforeCommand) encoder.finish();
  });
