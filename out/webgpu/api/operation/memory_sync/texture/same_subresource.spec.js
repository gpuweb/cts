/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Memory Synchronization Tests for Texture: read before write, read after write, and write after write to the same subresource.

- TODO: Test synchronization between multiple queues.
- TODO: Test depth/stencil attachments.
- TODO: Use non-solid-color texture contents [2]
`;import { SkipTestCase } from '../../../../../common/framework/fixture.js';
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { assert, memcpy, unreachable } from '../../../../../common/util/util.js';

import { GPUTest } from '../../../../gpu_test.js';
import { align } from '../../../../util/math.js';
import { getTextureCopyLayout } from '../../../../util/texture/layout.js';
import {
kTexelRepresentationInfo } from

'../../../../util/texture/texel_data.js';

import {
kOperationBoundaries,
kBoundaryInfo,
kAllReadOps,
kAllWriteOps,
checkOpsValidForContext,



kOpInfo,
kOperationContexts } from
'./texture_sync_test.js';

export const g = makeTestGroup(GPUTest);

class TextureSyncTestHelper {
  // We start at the queue context which is top-level.
  currentContext = 'queue';

  // Set based on the current context.










  encodedCommands = [];

  kTextureSize = [4, 4];
  kTextureFormat = 'rgba8unorm';

  constructor(
  t,
  textureCreationParams)


  {
    this.t = t;
    this.device = t.device;
    this.queue = t.device.queue;
    this.texture = t.trackForCleanup(
    t.device.createTexture({
      size: this.kTextureSize,
      format: this.kTextureFormat,
      ...textureCreationParams }));


  }

  /**
     * Perform a read operation on the test texture.
     * @return GPUTexture copy containing the contents.
     */
  performReadOp({ op, in: context }) {
    this.ensureContext(context);
    switch (op) {
      case 't2t-copy':{
          const texture = this.t.trackForCleanup(
          this.device.createTexture({
            size: this.kTextureSize,
            format: this.kTextureFormat,
            usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST }));



          assert(this.commandEncoder !== undefined);
          this.commandEncoder.copyTextureToTexture(
          {
            texture: this.texture },

          { texture },
          this.kTextureSize);

          return texture;
        }
      case 't2b-copy':{
          const { byteLength, bytesPerRow } = getTextureCopyLayout(this.kTextureFormat, '2d', [
          ...this.kTextureSize,
          1]);

          const buffer = this.t.trackForCleanup(
          this.device.createBuffer({
            size: byteLength,
            usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST }));



          const texture = this.t.trackForCleanup(
          this.device.createTexture({
            size: this.kTextureSize,
            format: this.kTextureFormat,
            usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST }));



          assert(this.commandEncoder !== undefined);
          this.commandEncoder.copyTextureToBuffer(
          {
            texture: this.texture },

          { buffer, bytesPerRow },
          this.kTextureSize);

          this.commandEncoder.copyBufferToTexture(
          { buffer, bytesPerRow },
          { texture },
          this.kTextureSize);

          return texture;
        }
      case 'sample':
      case 'storage':
        // [1] Finish implementation
        throw new SkipTestCase('unimplemented');
        break;
      case 'b2t-copy':
      case 'attachment-resolve':
      case 'attachment-store':
        unreachable();}

    unreachable();
  }

  performWriteOp(
  { op, in: context },
  data)
  {
    this.ensureContext(context);
    switch (op) {
      case 'attachment-store':{
          assert(this.commandEncoder !== undefined);
          this.renderPassEncoder = this.commandEncoder.beginRenderPass({
            colorAttachments: [
            {
              view: this.texture.createView(),
              // [2] Use non-solid-color texture values
              loadValue: [data.R ?? 0, data.G ?? 0, data.B ?? 0, data.A ?? 0],
              storeOp: 'store' }] });



          this.currentContext = 'render-pass-encoder';
          break;
        }
      case 'write-texture':{
          // [2] Use non-solid-color texture values
          const rep = kTexelRepresentationInfo[this.kTextureFormat];
          const texelData = rep.pack(rep.encode(data));
          const numTexels = this.kTextureSize[0] * this.kTextureSize[1];
          const fullTexelData = new ArrayBuffer(texelData.byteLength * numTexels);
          for (let i = 0; i < numTexels; ++i) {
            memcpy({ src: texelData }, { dst: fullTexelData, start: i * texelData.byteLength });
          }

          this.queue.writeTexture(
          { texture: this.texture },
          fullTexelData,
          {
            bytesPerRow: texelData.byteLength * this.kTextureSize[0] },

          this.kTextureSize);

          break;
        }
      case 't2t-copy':{
          const texture = this.device.createTexture({
            size: this.kTextureSize,
            format: this.kTextureFormat,
            usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST });


          // [2] Use non-solid-color texture values
          const rep = kTexelRepresentationInfo[this.kTextureFormat];
          const texelData = rep.pack(rep.encode(data));
          const numTexels = this.kTextureSize[0] * this.kTextureSize[1];
          const fullTexelData = new ArrayBuffer(texelData.byteLength * numTexels);
          for (let i = 0; i < numTexels; ++i) {
            memcpy({ src: texelData }, { dst: fullTexelData, start: i * texelData.byteLength });
          }

          this.queue.writeTexture(
          { texture },
          fullTexelData,
          {
            bytesPerRow: texelData.byteLength * this.kTextureSize[0] },

          this.kTextureSize);


          assert(this.commandEncoder !== undefined);
          this.commandEncoder.copyTextureToTexture(
          { texture },
          { texture: this.texture },
          this.kTextureSize);

          break;
        }
      case 'b2t-copy':{
          // [2] Use non-solid-color texture values
          const rep = kTexelRepresentationInfo[this.kTextureFormat];
          const texelData = rep.pack(rep.encode(data));
          const bytesPerRow = align(texelData.byteLength, 256);
          const fullTexelData = new ArrayBuffer(bytesPerRow * this.kTextureSize[1]);
          for (let i = 0; i < this.kTextureSize[1]; ++i) {
            for (let j = 0; j < this.kTextureSize[0]; ++j) {
              memcpy(
              { src: texelData },
              {
                dst: fullTexelData,
                start: i * bytesPerRow + j * texelData.byteLength });


            }
          }

          const buffer = this.t.trackForCleanup(
          this.device.createBuffer({
            size: fullTexelData.byteLength,
            usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST }));



          this.queue.writeBuffer(buffer, 0, fullTexelData);

          assert(this.commandEncoder !== undefined);
          this.commandEncoder.copyBufferToTexture(
          { buffer, bytesPerRow },
          { texture: this.texture },
          this.kTextureSize);

          break;
        }
      case 'attachment-resolve':
      case 'storage':
        // [1] Finish implementation
        throw new SkipTestCase('unimplemented');
      case 't2b-copy':
      case 'sample':
        unreachable();}

  }

  // Ensure that all encoded commands are finished and subitted.
  ensureSubmit() {
    this.ensureContext('queue');
    this.flushEncodedCommands();
  }

  popContext() {
    switch (this.currentContext) {
      case 'queue':
        unreachable();
        break;
      case 'command-encoder':{
          assert(this.commandEncoder !== undefined);
          const commandBuffer = this.commandEncoder.finish();
          this.commandEncoder = undefined;
          this.currentContext = 'queue';
          return commandBuffer;
        }
      case 'compute-pass-encoder':
        assert(this.computePassEncoder !== undefined);
        this.computePassEncoder.endPass();
        this.computePassEncoder = undefined;
        this.currentContext = 'command-encoder';
        break;
      case 'render-pass-encoder':
        assert(this.renderPassEncoder !== undefined);
        this.renderPassEncoder.endPass();
        this.renderPassEncoder = undefined;
        this.currentContext = 'command-encoder';
        break;
      case 'render-bundle-encoder':{
          assert(this.renderBundleEncoder !== undefined);
          const renderBundle = this.renderBundleEncoder.finish();
          this.renderBundleEncoder = undefined;
          this.currentContext = 'render-pass-encoder';
          return renderBundle;
        }}

    return null;
  }

  makeDummyAttachment() {
    const texture = this.t.trackForCleanup(
    this.device.createTexture({
      format: this.kTextureFormat,
      size: this.kTextureSize,
      usage: GPUTextureUsage.RENDER_ATTACHMENT }));


    return {
      view: texture.createView(),
      loadValue: 'load',
      storeOp: 'store' };

  }

  ensureContext(context) {
    // Find the common ancestor. So we can transition from currentContext -> context.
    const ancestorContext =
    kOperationContexts[
    Math.min(
    kOperationContexts.indexOf(context),
    kOperationContexts.indexOf(this.currentContext))];



    // Pop the context until we're at the common ancestor.
    while (this.currentContext !== ancestorContext) {
      // About to pop the render pass encoder. Execute any outstanding render bundles.
      if (this.currentContext === 'render-pass-encoder') {
        this.flushEncodedCommands();
      }

      const result = this.popContext();
      if (result) {
        if (result instanceof GPURenderBundle) {
          assert(
          this.encodedCommands.length === 0 || this.encodedCommands[0] instanceof GPURenderBundle);

          this.encodedCommands.push(result);
        } else {
          assert(
          this.encodedCommands.length === 0 || this.encodedCommands[0] instanceof GPUCommandBuffer);

          this.encodedCommands.push(result);
        }
      }
    }

    if (this.currentContext === context) {
      return;
    }

    switch (context) {
      case 'queue':
        unreachable();
        break;
      case 'command-encoder':
        assert(this.currentContext === 'queue');
        this.commandEncoder = this.device.createCommandEncoder();
        break;
      case 'compute-pass-encoder':
        switch (this.currentContext) {
          case 'queue':
            this.commandEncoder = this.device.createCommandEncoder();
          // fallthrough
          case 'command-encoder':
            assert(this.commandEncoder !== undefined);
            this.computePassEncoder = this.commandEncoder.beginComputePass();
            break;
          case 'compute-pass-encoder':
          case 'render-bundle-encoder':
          case 'render-pass-encoder':
            unreachable();}

        break;
      case 'render-pass-encoder':
        switch (this.currentContext) {
          case 'queue':
            this.commandEncoder = this.device.createCommandEncoder();
          // fallthrough
          case 'command-encoder':
            assert(this.commandEncoder !== undefined);
            this.renderPassEncoder = this.commandEncoder.beginRenderPass({
              colorAttachments: [this.makeDummyAttachment()] });

            break;
          case 'render-pass-encoder':
          case 'render-bundle-encoder':
          case 'compute-pass-encoder':
            unreachable();}

        break;
      case 'render-bundle-encoder':
        switch (this.currentContext) {
          case 'queue':
            this.commandEncoder = this.device.createCommandEncoder();
          // fallthrough
          case 'command-encoder':
            assert(this.commandEncoder !== undefined);
            this.renderPassEncoder = this.commandEncoder.beginRenderPass({
              colorAttachments: [this.makeDummyAttachment()] });

          // fallthrough
          case 'render-pass-encoder':
            this.renderBundleEncoder = this.device.createRenderBundleEncoder({
              colorFormats: [this.kTextureFormat] });

            break;
          case 'render-bundle-encoder':
          case 'compute-pass-encoder':
            unreachable();}

        break;}

    this.currentContext = context;
  }

  /**
     * Execute/submit encoded GPURenderBundles or GPUCommandBuffers.
     */
  flushEncodedCommands() {
    if (this.encodedCommands.length > 0) {
      if (this.encodedCommands[0] instanceof GPURenderBundle) {
        assert(this.renderPassEncoder !== undefined);
        this.renderPassEncoder.executeBundles(this.encodedCommands);
      } else {
        this.queue.submit(this.encodedCommands);
      }
    }
    this.encodedCommands = [];
  }

  ensureBoundary(boundary) {
    switch (boundary) {
      case 'command-buffer':
        this.ensureContext('queue');
        break;
      case 'queue-op':
        this.ensureContext('queue');
        // Submit any GPUCommandBuffers so the next one is in a separate submit.
        this.flushEncodedCommands();
        break;
      case 'dispatch':
        // Nothing to do to separate dispatches.
        assert(this.currentContext === 'compute-pass-encoder');
        break;
      case 'draw':
        // Nothing to do to separate draws.
        assert(
        this.currentContext === 'render-pass-encoder' ||
        this.currentContext === 'render-bundle-encoder');

        break;
      case 'pass':
        this.ensureContext('command-encoder');
        break;
      case 'render-bundle':
        this.ensureContext('render-pass-encoder');
        break;
      case 'execute-bundles':
        this.ensureContext('render-pass-encoder');
        // Execute any GPURenderBundles so the next one is in a separate executeBundles.
        this.flushEncodedCommands();
        break;}

  }}


g.test('rw').
desc(
`
    Perform a 'read' operations on a texture subresource, followed by a 'write' operation.
    Operations are separated by a 'boundary' (pass, encoder, queue-op, etc.).
    Test that the results are synchronized.
    The read should not see the contents written by the subsequent write.`).

params((u) =>
u.
combine('boundary', kOperationBoundaries).
expand('_context', p => kBoundaryInfo[p.boundary].contexts).
expandWithParams(function* ({ _context }) {
  for (const read of kAllReadOps) {
    for (const write of kAllWriteOps) {
      if (checkOpsValidForContext([read, write], _context)) {
        yield {
          read: { op: read, in: _context[0] },
          write: { op: write, in: _context[1] } };

      }
    }
  }
})).

fn(t => {
  const helper = new TextureSyncTestHelper(t, {
    usage:
    GPUTextureUsage.COPY_DST |
    kOpInfo[t.params.read.op].readUsage |
    kOpInfo[t.params.write.op].writeUsage });

  // [2] Use non-solid-color texture value.
  const texelValue1 = { R: 0, G: 1, B: 0, A: 1 };
  const texelValue2 = { R: 1, G: 0, B: 0, A: 1 };

  // Initialize the texture with something.
  helper.performWriteOp({ op: 'write-texture', in: 'queue' }, texelValue1);
  const readbackTexture = helper.performReadOp(t.params.read);
  helper.ensureBoundary(t.params.boundary);
  helper.performWriteOp(t.params.write, texelValue2);
  helper.ensureSubmit();

  // Contents should be the first value written, not the second.
  t.expectSingleColor(readbackTexture, helper.kTextureFormat, {
    size: [...helper.kTextureSize, 1],
    exp: texelValue1 });

});

g.test('wr').
desc(
`
    Perform a 'write' operation on a texture subresource, followed by a 'read' operation.
    Operations are separated by a 'boundary' (pass, encoder, queue-op, etc.).
    Test that the results are synchronized.
    The read should see exactly the contents written by the previous write.

    - TODO: Finish implementation [1]
    - TODO: Use non-solid-color texture contents [2]`).

params((u) =>
u.
combine('boundary', kOperationBoundaries).
expand('_context', p => kBoundaryInfo[p.boundary].contexts).
expandWithParams(function* ({ _context }) {
  for (const read of kAllReadOps) {
    for (const write of kAllWriteOps) {
      if (checkOpsValidForContext([write, read], _context)) {
        yield {
          write: { op: write, in: _context[0] },
          read: { op: read, in: _context[1] } };

      }
    }
  }
})).

fn(t => {
  const helper = new TextureSyncTestHelper(t, {
    usage: kOpInfo[t.params.read.op].readUsage | kOpInfo[t.params.write.op].writeUsage });

  // [2] Use non-solid-color texture value.
  const texelValue = { R: 0, G: 1, B: 0, A: 1 };

  helper.performWriteOp(t.params.write, texelValue);
  helper.ensureBoundary(t.params.boundary);
  const readbackTexture = helper.performReadOp(t.params.read);
  helper.ensureSubmit();

  // Contents should be exactly the values written.
  t.expectSingleColor(readbackTexture, helper.kTextureFormat, {
    size: [...helper.kTextureSize, 1],
    exp: texelValue });

});

g.test('ww').
desc(
`
    Perform a 'first' write operation on a texture subresource, followed by a 'second' write operation.
    Operations are separated by a 'boundary' (pass, encoder, queue-op, etc.).
    Test that the results are synchronized.
    The second write should overwrite the contents of the first.`).

params((u) =>
u.
combine('boundary', kOperationBoundaries).
expand('_context', p => kBoundaryInfo[p.boundary].contexts).
expandWithParams(function* ({ _context }) {
  for (const first of kAllWriteOps) {
    for (const second of kAllWriteOps) {
      if (checkOpsValidForContext([first, second], _context)) {
        yield {
          first: { op: first, in: _context[0] },
          second: { op: second, in: _context[1] } };

      }
    }
  }
})).

fn(t => {
  const helper = new TextureSyncTestHelper(t, {
    usage:
    GPUTextureUsage.COPY_SRC |
    kOpInfo[t.params.first.op].writeUsage |
    kOpInfo[t.params.second.op].writeUsage });

  // [2] Use non-solid-color texture value.
  const texelValue1 = { R: 1, G: 0, B: 0, A: 1 };
  const texelValue2 = { R: 0, G: 1, B: 0, A: 1 };

  helper.performWriteOp(t.params.first, texelValue1);
  helper.ensureBoundary(t.params.boundary);
  helper.performWriteOp(t.params.second, texelValue2);
  helper.ensureSubmit();

  // Read back the contents so we can test the result.
  const readbackTexture = helper.performReadOp({ op: 't2t-copy', in: 'command-encoder' });
  helper.ensureSubmit();

  // Contents should be the second value written.
  t.expectSingleColor(readbackTexture, helper.kTextureFormat, {
    size: [...helper.kTextureSize, 1],
    exp: texelValue2 });

});

g.test('rw,single_pass,load_store').
desc(
`
    TODO: Test memory synchronization when loading from a texture subresource in a single pass and storing to it.`).

unimplemented();

g.test('rw,single_pass,load_resolve').
desc(
`
    TODO: Test memory synchronization when loading from a texture subresource in a single pass and resolving to it.`).

unimplemented();
//# sourceMappingURL=same_subresource.spec.js.map