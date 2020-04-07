export const description = `Test uninitialized textures are initialized to zero when used as a depth/stencil attachment.`;

import { C, TestGroup, unreachable } from '../../../../common/framework/index.js';
import { fillTextureDataRows, getTextureCopyLayout } from '../../../util/texture/layout.js';
import { SubresourceRange } from '../../../util/texture/subresource.js';
import { getTexelDataRepresentation } from '../../../util/texture/texelData.js';

import {
  InitializedState,
  ReadMethod,
  TextureZeroInitTest,
  initializedStateAsDepth,
  initializedStateAsStencil,
} from './texture_zero_init_test.js';

class DepthStencilAttachment extends TextureZeroInitTest {
  private depthTestPipelineCache: Map<string, GPURenderPipeline> = new Map();
  private getDepthTestReadbackPipeline(
    state: InitializedState,
    format: GPUTextureFormat,
    sampleCount: number
  ): GPURenderPipeline {
    const key = [state, format, sampleCount].join('_');
    if (this.depthTestPipelineCache.has(key)) {
      return this.depthTestPipelineCache.get(key)!;
    }

    this.depthTestPipelineCache.set(
      key,
      this.device.createRenderPipeline({
        // @ts-ignore
        layout: undefined,
        vertexStage: {
          entryPoint: 'main',
          module: this.makeShaderModuleFromGLSL(
            'vertex',
            `#version 310 es
          void main() {
            const vec2 pos[3] = vec2[3](
                vec2(-1.f, -3.f), vec2(3.f, 1.f), vec2(-1.f, 1.f));
            gl_Position = vec4(pos[gl_VertexIndex], 0.f, 1.f);
          }
          `
          ),
        },
        fragmentStage: {
          entryPoint: 'main',
          module: this.makeShaderModuleFromGLSL(
            'fragment',
            `#version 310 es
          precision highp float;
          layout(location = 0) out float outSuccess;

          void main() {
            gl_FragDepth = float(${initializedStateAsDepth(state)});
            outSuccess = 1.0;
          }
          `
          ),
        },
        colorStates: [
          {
            format: 'r8unorm',
          },
        ],
        depthStencilState: {
          format,
          depthCompare: 'equal',
        },
        primitiveTopology: 'triangle-list',
        sampleCount,
      })
    );

    return this.depthTestPipelineCache.get(key)!;
  }

  private stencilTestPipelineCache: Map<string, GPURenderPipeline> = new Map();
  private getStencilTestReadbackPipeline(
    format: GPUTextureFormat,
    sampleCount: number
  ): GPURenderPipeline {
    const key = [format, sampleCount].join('_');
    if (this.stencilTestPipelineCache.has(key)) {
      return this.stencilTestPipelineCache.get(key)!;
    }

    this.stencilTestPipelineCache.set(
      key,
      this.device.createRenderPipeline({
        // @ts-ignore
        layout: undefined,
        vertexStage: {
          entryPoint: 'main',
          module: this.makeShaderModuleFromGLSL(
            'vertex',
            `#version 310 es
          void main() {
            const vec2 pos[3] = vec2[3](
                vec2(-1.f, -3.f), vec2(3.f, 1.f), vec2(-1.f, 1.f));
            gl_Position = vec4(pos[gl_VertexIndex], 0.f, 1.f);
          }
          `
          ),
        },
        fragmentStage: {
          entryPoint: 'main',
          module: this.makeShaderModuleFromGLSL(
            'fragment',
            `#version 310 es
          precision highp float;
          layout(location = 0) out float outSuccess;

          void main() {
            outSuccess = 1.0;
          }
          `
          ),
        },
        colorStates: [
          {
            format: 'r8unorm',
          },
        ],
        depthStencilState: {
          format,
          stencilFront: {
            compare: 'equal',
          },
          stencilBack: {
            compare: 'equal',
          },
        },
        primitiveTopology: 'triangle-list',
        sampleCount,
      })
    );
    return this.stencilTestPipelineCache.get(key)!;
  }

  checkContents(
    texture: GPUTexture,
    state: InitializedState,
    subresourceRange: SubresourceRange
  ): void {
    for (const viewDescriptor of this.generateTextureViewDescriptorsForRendering(
      this.params.aspect,
      subresourceRange
    )) {
      const width = this.textureWidth >> viewDescriptor.baseMipLevel!;
      const height = this.textureHeight >> viewDescriptor.baseMipLevel!;

      const renderTexture = this.device.createTexture({
        size: { width, height, depth: 1 },
        format: 'r8unorm',
        usage: C.TextureUsage.OutputAttachment | C.TextureUsage.CopySrc,
        sampleCount: this.params.sampleCount,
      });

      let resolveTexture = undefined;
      let resolveTarget = undefined;
      if (this.params.sampleCount > 1) {
        resolveTexture = this.device.createTexture({
          size: { width, height, depth: 1 },
          format: 'r8unorm',
          usage: C.TextureUsage.OutputAttachment | C.TextureUsage.CopySrc,
        });
        resolveTarget = resolveTexture.createView();
      }

      const commandEncoder = this.device.createCommandEncoder();
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            attachment: renderTexture.createView(),
            resolveTarget,
            loadValue: [0, 0, 0, 0],
            storeOp: 'store',
          },
        ],
        depthStencilAttachment: {
          attachment: texture.createView(viewDescriptor),
          depthStoreOp: 'store',
          depthLoadValue: 'load',
          stencilStoreOp: 'store',
          stencilLoadValue: 'load',
        },
      });

      switch (this.params.readMethod) {
        case ReadMethod.DepthTest:
          pass.setPipeline(
            this.getDepthTestReadbackPipeline(state, this.params.format, this.params.sampleCount)
          );
          break;

        case ReadMethod.StencilTest:
          pass.setPipeline(
            this.getStencilTestReadbackPipeline(this.params.format, this.params.sampleCount)
          );
          pass.setStencilReference(initializedStateAsStencil(state));
          break;

        default:
          unreachable();
      }
      pass.draw(3, 1, 0, 0);
      pass.endPass();

      const { bytesPerRow, byteLength } = getTextureCopyLayout('r8unorm', {
        width,
        height,
        depth: 1,
      });
      const expectedTexelData = getTexelDataRepresentation('r8unorm').getBytes({ R: 1 });

      const buffer = this.device.createBuffer({
        size: byteLength,
        usage: C.BufferUsage.CopySrc | C.BufferUsage.CopyDst,
      });

      commandEncoder.copyTextureToBuffer(
        { texture: resolveTexture || renderTexture },
        {
          buffer,
          bytesPerRow,
          rowsPerImage: height,
          // @ts-ignore
          rowPitch: bytesPerRow,
          imageHeight: height,
        },
        { width, height, depth: 1 }
      );

      this.queue.submit([commandEncoder.finish()]);

      const arrayBuffer = new ArrayBuffer(byteLength);
      fillTextureDataRows(arrayBuffer, [width, height, 1], expectedTexelData);
      this.expectContents(buffer, new Uint8Array(arrayBuffer));
    }
  }
}

export const g = new TestGroup(DepthStencilAttachment);

g.test('uninitialized texture is zero', t => {
  t.run();
}).params(TextureZeroInitTest.generateParams([ReadMethod.DepthTest, ReadMethod.StencilTest]));
