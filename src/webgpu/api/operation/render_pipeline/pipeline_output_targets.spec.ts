export const description = `
- Test pipeline outputs with different color target formats.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { unreachable } from '../../../../common/util/util.js';
import { kRenderableColorTextureFormats, kTextureFormatInfo } from '../../../capability_info.js';
import { GPUTest } from '../../../gpu_test.js';

class F extends GPUTest {
  getExpectedTypeAndComponentCount(
    format: GPUTextureFormat
  ): { expectedType: GPUTextureSampleType; expectedComponentCount: number } {
    let expectedType: GPUTextureSampleType;
    if (format.endsWith('sint')) {
      expectedType = 'sint';
    } else if (format.endsWith('uint')) {
      expectedType = 'uint';
    } else {
      expectedType = 'float';
    }
    // Only used for renderable color formats
    let expectedComponentCount: number = 1;
    if (format.startsWith('rgba') || format.startsWith('bgra') || format.startsWith('rgb10a2')) {
      expectedComponentCount = 4;
    } else if (format.startsWith('rg')) {
      expectedComponentCount = 2;
    } else if (format.startsWith('r')) {
      expectedComponentCount = 1;
    } else {
      unreachable();
    }

    return { expectedType, expectedComponentCount };
  }

  getFragmentShaderCode(
    v: string[],
    sampleType: GPUTextureSampleType,
    componentCount: number
  ): string {
    console.log(v);
    let fragColorType;
    let suffix;
    switch (sampleType) {
      case 'sint':
        fragColorType = 'i32';
        suffix = '';
        break;
      case 'uint':
        fragColorType = 'u32';
        suffix = 'u';
        break;
      default:
        fragColorType = 'f32';
        suffix = '.0';
        break;
    }

    let outputType;
    let result;
    switch (componentCount) {
      case 1:
        outputType = fragColorType;
        result = `${v[0]}${suffix}`;
        break;
      case 2:
        outputType = `vec2<${fragColorType}>`;
        result = `${outputType}(${v[0]}${suffix}, ${v[1]}${suffix})`;
        break;
      case 3:
        outputType = `vec3<${fragColorType}>`;
        result = `${outputType}(${v[0]}${suffix}, ${v[1]}${suffix}, ${v[2]}${suffix})`;
        break;
      case 4:
        outputType = `vec4<${fragColorType}>`;
        result = `${outputType}(${v[0]}${suffix}, ${v[1]}${suffix}, ${v[2]}${suffix}, ${v[3]}${suffix})`;
        break;
      default:
        unreachable();
    }

    return `
    [[stage(fragment)]] fn main() -> [[location(0)]] ${outputType} {
        return ${result};
    }`;
  }
}

export const g = makeTestGroup(F);

g.test('color,component_count')
  .desc(
    `Test that extra components of the output (e.g. f32, vec2<f32>, vec3<f32>, vec4<f32>) are discarded.`
  )
  .params(u =>
    u
      .combine('format', kRenderableColorTextureFormats)
      .beginSubcases()
      .combine('componentCount', [1, 2, 3, 4])
  )
  .fn(async t => {
    const { format, componentCount } = t.params;
    const info = kTextureFormatInfo[format];
    await t.selectDeviceOrSkipTestCase(info.feature);
    const { expectedType, expectedComponentCount } = t.getExpectedTypeAndComponentCount(format);

    // expected RGBA values
    // extra channels are discarded
    const v = [0, 1, 0, 1];
    if (componentCount < expectedComponentCount) {
      t.skip('componentCount of pipeline output must not be fewer than that of target format');
    }

    const renderTarget = t.device.createTexture({
      format,
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const pipeline = t.device.createRenderPipeline({
      vertex: {
        module: t.device.createShaderModule({
          code: `
            [[stage(vertex)]] fn main(
              [[builtin(vertex_index)]] VertexIndex : u32
              ) -> [[builtin(position)]] vec4<f32> {
                var pos : array<vec2<f32>, 3> = array<vec2<f32>, 3>(
                    vec2<f32>(-1.0, -3.0),
                    vec2<f32>(3.0, 1.0),
                    vec2<f32>(-1.0, 1.0));
                return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
              }
              `,
        }),
        entryPoint: 'main',
      },
      fragment: {
        module: t.device.createShaderModule({
          code: t.getFragmentShaderCode(
            v.map(n => n.toString()),
            expectedType,
            componentCount
          ),
        }),
        entryPoint: 'main',
        targets: [{ format }],
      },
      primitive: { topology: 'triangle-list' },
    });

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: renderTarget.createView(),
          storeOp: 'store',
          loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.draw(3);
    pass.endPass();
    t.device.queue.submit([encoder.finish()]);

    t.expectSingleColor(renderTarget, format, {
      size: [1, 1, 1],
      exp: { R: v[0], G: v[1], B: v[2], A: v[3] },
    });
  });
