export const description = `
Test texture views can reinterpret the format of the original texture.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import {
  EncodableTextureFormat,
  kTextureFormatInfo,
  kRenderableColorTextureFormats,
  kRegularTextureFormats,
} from '../../../capability_info.js';
import { GPUTest } from '../../../gpu_test.js';
import { TexelView } from '../../../util/texture/texel_view.js';
import { textureContentIsOKByT2B } from '../../../util/texture/texture_ok.js';

export const g = makeTestGroup(GPUTest);

const kColors = [
  { R: 1.0, G: 0.0, B: 0.0, A: 0.8 },
  { R: 0.0, G: 1.0, B: 0.0, A: 0.7 },
  { R: 0.0, G: 0.0, B: 0.0, A: 0.6 },
  { R: 0.0, G: 0.0, B: 0.0, A: 0.5 },
  { R: 1.0, G: 1.0, B: 1.0, A: 0.4 },
  { R: 0.7, G: 0.0, B: 0.0, A: 0.3 },
  { R: 0.0, G: 0.8, B: 0.0, A: 0.2 },
  { R: 0.0, G: 0.0, B: 0.9, A: 0.1 },
  { R: 0.1, G: 0.2, B: 0.0, A: 0.3 },
  { R: 0.4, G: 0.3, B: 0.6, A: 0.8 },
];

const kTextureSize = 16;

function supportsReinterpretation(a: GPUTextureFormat, b: GPUTextureFormat) {
  return a + '-srgb' === b || b + '-srgb' === a;
}

function makeInputTexelView(format: EncodableTextureFormat) {
  return TexelView.fromTexelsAsColors(
    format,
    coords => {
      const pixelPos = coords.y * kTextureSize + coords.x;
      return kColors[pixelPos % kColors.length];
    },
    { clampToFormatRange: true }
  );
}

function makeBlitPipeline(
  device: GPUDevice,
  format: GPUTextureFormat,
  multisample: { sample: number; render: number }
) {
  return device.createRenderPipeline({
    vertex: {
      module: device.createShaderModule({
        code: `
          @stage(vertex) fn main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
            var pos = array<vec2<f32>, 6>(
                                        vec2<f32>(-1.0, -1.0),
                                        vec2<f32>(-1.0,  1.0),
                                        vec2<f32>( 1.0, -1.0),
                                        vec2<f32>(-1.0,  1.0),
                                        vec2<f32>( 1.0, -1.0),
                                        vec2<f32>( 1.0,  1.0));
            return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
          }`,
      }),
      entryPoint: 'main',
    },
    fragment: {
      module:
        multisample.sample > 1
          ? device.createShaderModule({
              code: `
            @group(0) @binding(0) var src: texture_multisampled_2d<f32>;
            @stage(fragment) fn main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
              var result : vec4<f32>;
              for (var i = 0; i < ${multisample.sample}; i = i + 1) {
                result = result + textureLoad(src, vec2<i32>(coord.xy), i);
              }
              return result * ${1 / multisample.sample};
            }`,
            })
          : device.createShaderModule({
              code: `
            @group(0) @binding(0) var src: texture_2d<f32>;
            @stage(fragment) fn main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
              return textureLoad(src, vec2<i32>(coord.xy), 0);
            }`,
            }),
      entryPoint: 'main',
      targets: [{ format }],
    },
    multisample: {
      count: multisample.render,
    },
  });
}

g.test('texture_binding')
  .desc(`Test that a regular texture allocated as 'format' may be sampled as 'viewFormat'.`)
  .params(u =>
    u //
      .combine('format', kRegularTextureFormats)
      .combine('viewFormat', kRegularTextureFormats)
      .filter(({ format, viewFormat }) => supportsReinterpretation(format, viewFormat))
  )
  .fn(async t => {
    const { format, viewFormat } = t.params;

    // Make an input texel view.
    const inputTexelView = makeInputTexelView(format);

    // Write data out to bytes.
    const texelSize = kTextureFormatInfo[format].bytesPerBlock;
    const textureData = new Uint8ClampedArray(texelSize * kTextureSize * kTextureSize);
    inputTexelView.writeTextureData(textureData, {
      bytesPerRow: texelSize * kTextureSize,
      rowsPerImage: kTextureSize,
      subrectOrigin: [0, 0],
      subrectSize: [kTextureSize, kTextureSize],
    });

    // Create and upload data to the texture.
    const texture = t.device.createTexture({
      format,
      size: [kTextureSize, kTextureSize],
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
      viewFormats: [viewFormat],
    });

    t.device.queue.writeTexture(
      { texture },
      textureData,
      {
        bytesPerRow: texelSize * kTextureSize,
      },
      [kTextureSize, kTextureSize]
    );

    // Reinterepret the texture as the view format.
    // Make a texel view of the format that also reinterprets the data.
    const reinterpretedView = texture.createView({ format: viewFormat });
    const reinterpretedTexelView = TexelView.fromTexelsAsBytes(viewFormat, inputTexelView.bytes);

    // Create a pipeline to write data out to rgba8unorm.
    const pipeline = t.device.createComputePipeline({
      compute: {
        module: t.device.createShaderModule({
          code: `
          @group(0) @binding(0) var src: texture_2d<f32>;
          @group(0) @binding(1) var dst: texture_storage_2d<rgba8unorm, write>;
          @stage(compute) @workgroup_size(1, 1) fn main(
            @builtin(global_invocation_id) global_id: vec3<u32>,
          ) {
            var coord = vec2<i32>(global_id.xy);
            textureStore(dst, coord, textureLoad(src, coord, 0));
          }`,
        }),
        entryPoint: 'main',
      },
    });

    // Create an rgba8unorm output texture.
    const outputTexture = t.device.createTexture({
      format: 'rgba8unorm',
      size: [kTextureSize, kTextureSize],
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
    });

    // Execute a compute pass to load data from the reinterpreted view and
    // write out to the rgba8unorm texture.
    const commandEncoder = t.device.createCommandEncoder();
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(
      0,
      t.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: reinterpretedView,
          },
          {
            binding: 1,
            resource: outputTexture.createView(),
          },
        ],
      })
    );
    pass.dispatch(kTextureSize, kTextureSize);
    pass.end();
    t.device.queue.submit([commandEncoder.finish()]);

    const result = await textureContentIsOKByT2B(
      t,
      { texture: outputTexture },
      [kTextureSize, kTextureSize],
      {
        expTexelView: TexelView.fromTexelsAsColors('rgba8unorm', reinterpretedTexelView.color, {
          clampToFormatRange: true,
        }),
      },
      { maxDiffULPsForNormFormat: 1 }
    );
    t.expectOK(result);
  });

g.test('render_or_resolve_attachment')
  .desc(
    `Test that a color render attachment allocated as 'renderFormat' may be rendered to as 'renderViewFormat',
and resolved to an attachment allocated as 'resolveFormat' viewed as 'resolveViewFormat'.`
  )
  .params(u =>
    u //
      .combine('renderFormat', kRenderableColorTextureFormats)
      .combine('renderViewFormat', kRenderableColorTextureFormats)
      .filter(
        ({ renderFormat, renderViewFormat }) =>
          // Allow formats to be the same since reinterpretation may instead occur for the resolve format.
          renderFormat === renderViewFormat ||
          supportsReinterpretation(renderFormat, renderViewFormat)
      )
      .combine('resolveFormat', [undefined, ...kRenderableColorTextureFormats])
      .combine('resolveViewFormat', [undefined, ...kRenderableColorTextureFormats])
      .filter(
        ({ renderFormat, renderViewFormat, resolveFormat, resolveViewFormat }) =>
          (renderViewFormat === resolveViewFormat || resolveViewFormat === undefined) && // Required by validation to match.
          // At least one of the views should be reinterpreted.
          (renderFormat !== renderViewFormat || resolveFormat !== resolveViewFormat) &&
          // Allow formats to be the same since reinterpretation may occur for the render format.
          (resolveFormat === resolveViewFormat ||
            supportsReinterpretation(resolveFormat!, resolveViewFormat!))
      )
  )
  .fn(async t => {
    const { renderFormat, renderViewFormat, resolveFormat, resolveViewFormat } = t.params;

    // Make an input texel view.
    const inputTexelView = makeInputTexelView(renderFormat);

    const sampleCount = resolveFormat !== undefined ? 4 : 1;

    // Create the renderTexture as |renderFormat|.
    const renderTexture = t.device.createTexture({
      format: renderFormat,
      size: [kTextureSize, kTextureSize],
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT |
        (sampleCount > 1 ? GPUTextureUsage.TEXTURE_BINDING : GPUTextureUsage.COPY_SRC),
      viewFormats: [renderViewFormat],
      sampleCount,
    });

    const resolveTexture =
      resolveFormat &&
      t.device.createTexture({
        format: resolveFormat,
        size: [kTextureSize, kTextureSize],
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
        viewFormats: [resolveViewFormat!],
      });

    // Also create the sample source as |renderFormat|. We will sample this texture
    // into |renderTexture|. Using the same format keeps the same number of bits of precision.
    const sampleSource = t.device.createTexture({
      format: renderFormat,
      size: [kTextureSize, kTextureSize],
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    });

    // Write data out to bytes.
    const inputTexelSize = kTextureFormatInfo[renderFormat].bytesPerBlock;
    const inputTextureData = new Uint8ClampedArray(inputTexelSize * kTextureSize * kTextureSize);
    inputTexelView.writeTextureData(inputTextureData, {
      bytesPerRow: inputTexelSize * kTextureSize,
      rowsPerImage: kTextureSize,
      subrectOrigin: [0, 0],
      subrectSize: [kTextureSize, kTextureSize],
    });

    // Upload into the sample source.
    t.device.queue.writeTexture(
      { texture: sampleSource },
      inputTextureData,
      {
        bytesPerRow: inputTexelSize * kTextureSize,
      },
      [kTextureSize, kTextureSize]
    );

    // Reinterpret the renderTexture as |renderViewFormat|.
    const reinterpretedRenderView = renderTexture.createView({ format: renderViewFormat });
    const reinterpretedResolveView =
      resolveTexture && resolveTexture.createView({ format: resolveViewFormat });

    // Create a pipeline to blit a src texture to the render attachment.
    const pipeline = makeBlitPipeline(t.device, renderViewFormat, {
      sample: 1,
      render: sampleCount,
    });

    // Execute a render pass to sample |sampleSource| into |texture| viewed as |viewFormat|.
    const commandEncoder = t.device.createCommandEncoder();
    const pass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: reinterpretedRenderView,
          resolveTarget: reinterpretedResolveView,
          loadOp: 'load',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(
      0,
      t.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: sampleSource.createView(),
          },
        ],
      })
    );
    pass.draw(6);
    pass.end();

    // If the render target is multisampled, we'll manually resolve it to check
    // the contents.
    const singleSampleRenderTexture = resolveTexture
      ? t.device.createTexture({
          format: renderFormat,
          size: [kTextureSize, kTextureSize],
          usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
        })
      : renderTexture;

    if (resolveTexture) {
      // Create a pipeline to blit the multisampled render texture to a non-multisample texture.
      // We are basically performing a manual resolve step to the same format as the original
      // render texture to check its contents.
      const pipeline = makeBlitPipeline(t.device, renderFormat, { sample: sampleCount, render: 1 });
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: singleSampleRenderTexture.createView(),
            loadOp: 'load',
            storeOp: 'store',
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(
        0,
        t.device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            {
              binding: 0,
              resource: renderTexture.createView(),
            },
          ],
        })
      );
      pass.draw(6);
      pass.end();
    }

    // Submit the commands.
    t.device.queue.submit([commandEncoder.finish()]);

    // Check the rendered contents.
    const renderViewTexels = TexelView.fromTexelsAsColors(renderViewFormat, inputTexelView.color, {
      clampToFormatRange: true,
    });
    t.expectOK(
      await textureContentIsOKByT2B(
        t,
        { texture: singleSampleRenderTexture },
        [kTextureSize, kTextureSize],
        { expTexelView: renderViewTexels },
        { maxDiffULPsForNormFormat: 2 }
      )
    );

    // Check the resolved contents.
    if (resolveTexture) {
      // Vulkan behavior:
      // const renderView = TexelView.fromTexelsAsBytes(renderFormat, renderViewTexels.bytes);
      // const expTexelView = TexelView.fromTexelsAsColors(resolveFormat!, renderTexels.color, {
      //   clampToFormatRange: true,
      // });

      // Metal behavior:
      const resolveView = TexelView.fromTexelsAsColors(resolveViewFormat!, renderViewTexels.color, {
        clampToFormatRange: true,
      });
      const expTexelView = TexelView.fromTexelsAsBytes(resolveFormat!, resolveView.bytes);

      const result = await textureContentIsOKByT2B(
        t,
        { texture: resolveTexture },
        [kTextureSize, kTextureSize],
        { expTexelView },
        { maxDiffULPsForNormFormat: 2 }
      );
      t.expectOK(result);
    }
  });
