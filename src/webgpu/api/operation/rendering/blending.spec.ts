/* eslint-disable prettier/prettier */
export const description = `
Test blending results.

TODO:
- Test result for all combinations of args (make sure each case is distinguishable from others
- Test underflow/overflow has consistent behavior
- ?
`;

import { params, poptions } from '../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

const kBlendFactors: GPUBlendFactor[] = [
  'zero',
  'one',
  'src-color',
  'one-minus-src-color',
  'src-alpha',
  'one-minus-src-alpha',
  'dst-color',
  'one-minus-dst-color',
  'dst-alpha',
  'one-minus-dst-alpha',
  'src-alpha-saturated',
  'blend-color',
  'one-minus-blend-color',
];

const kBlendOperations: GPUBlendOperation[] = [
  'add', //
  'subtract',
  'reverse-subtract',
  'min',
  'max',
];

function mapColor(
  col: GPUColorDict,
  f: (v: number, k: keyof GPUColorDict) => number
): GPUColorDict {
  return {
    r: f(col.r, 'r'),
    g: f(col.g, 'g'),
    b: f(col.b, 'b'),
    a: f(col.a, 'a'),
  };
}

function computeBlendFactor(
  src: GPUColorDict,
  dst: GPUColorDict,
  col: GPUColorDict,
  factor: GPUBlendFactor
): GPUColorDict {
  switch (factor) {
    case 'zero':
      return { r: 0, g: 0, b: 0, a: 0 };
    case 'one':
      return { r: 1, g: 1, b: 1, a: 1 };
    case 'src-color':
      return { ...src };
    case 'one-minus-src-color':
      return mapColor(src, v => 1 - v);
    case 'src-alpha':
      return mapColor(src, () => src.a);
    case 'one-minus-src-alpha':
      return mapColor(src, () => 1 - src.a);
    case 'dst-color':
      return { ...dst };
    case 'one-minus-dst-color':
      return mapColor(dst, v => 1 - v);
    case 'dst-alpha':
      return mapColor(dst, () => dst.a);
    case 'one-minus-dst-alpha':
      return mapColor(dst, () => 1 - dst.a);
    case 'src-alpha-saturated': {
      const f = Math.min(src.a, 1 - src.a);
      return { r: f, g: f, b: f, a: 1 };
    }
    case 'blend-color':
      return { ...col };
    case 'one-minus-blend-color':
      return mapColor(col, v => 1 - v);
  }
}

function computeBlendOperation(src: GPUColorDict, dst: GPUColorDict, operation: GPUBlendOperation) {
  switch (operation) {
    case 'add':
      return mapColor(src, (v, k) => v + dst[k]);
    case 'max':
      return mapColor(src, (v, k) => Math.max(v, dst[k]));
    case 'min':
      return mapColor(src, (v, k) => Math.min(v, dst[k]));
    case 'reverse-subtract':
      return mapColor(src, (v, k) => dst[k] - v);
    case 'subtract':
      return mapColor(src, (v, k) => v - dst[k]);
  }
}

g.test('GPUBlendComponent')
  .desc(
    `Test all combinations of parameters for GPUBlendComponent.

  Tests that parameters are correctly passed to the backend API and blend computations
  are done correctly by blending a single pixel. The test uses rgba32float as the format
  to avoid checking clamping behavior (tested in api,operation,rendering,blending:clamp,*).

  Params:
    - component= {color, alpha} - whether to test blending the color or the alpha component.
    - srcFactor= {...all GPUBlendFactors}
    - dstFactor= {...all GPUBlendFactors}
    - operation= {...all GPUBlendOperations}
  `)
  .cases(
    params() //
      .combine(poptions('component', ['color', 'alpha'] as const))
      .combine(poptions('srcFactor', kBlendFactors))
      .combine(poptions('dstFactor', kBlendFactors))
      .combine(poptions('operation', kBlendOperations))
  )
  .fn(t => {
    const textureFormat: GPUTextureFormat = 'rgba32float';
    const srcColor: GPUColorDict = { r: 0.11, g: 0.61, b: 0.81, a: 0.44 };
    const dstColor: GPUColorDict = { r: 0.51, g: 0.22, b: 0.71, a: 0.33 };
    const varColor: GPUColorDict = { r: 0.91, g: 0.82, b: 0.73, a: 0.64 };

    const srcFactor = computeBlendFactor(srcColor, dstColor, varColor, t.params.srcFactor);
    const dstFactor = computeBlendFactor(srcColor, dstColor, varColor, t.params.dstFactor);

    const expectedColor =
      t.params.operation === 'min' || t.params.operation === 'max'
        ? computeBlendOperation(
          srcColor, dstColor,
          t.params.operation
        ) : computeBlendOperation(
          mapColor(srcColor, (v, k) => srcFactor[k] * v),
          mapColor(dstColor, (v, k) => dstFactor[k] * v),
          t.params.operation
        );

    switch (t.params.component) {
      case 'color':
        expectedColor.a = srcColor.a;
        break;
      case 'alpha':
        expectedColor.r = srcColor.r;
        expectedColor.g = srcColor.g;
        expectedColor.b = srcColor.b;
        break;
    }

    const pipeline = t.device.createRenderPipeline({
      fragment: {
        targets: [
          {
            format: textureFormat,
            blend: {
              // Set both color/alpha to not do blending.
              color: {
                srcFactor: 'one',
                dstFactor: 'zero',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'zero',
                operation: 'add',
              },
              // And then override the component we're testing.
              [t.params.component]: {
                srcFactor: t.params.srcFactor,
                dstFactor: t.params.dstFactor,
                operation: t.params.operation,
              },
            },
          },
        ],
        module: t.device.createShaderModule({
          code: `
[[block]] struct Uniform {
  color: vec4<f32>;
};
[[group(0), binding(0)]] var<uniform> u : Uniform;

[[location(0)]] var<out> output : vec4<f32>;
[[stage(fragment)]] fn main() -> void {
  output = u.color;
}
          `,
        }),
        entryPoint: 'main',
      },
      vertex: {
        module: t.device.createShaderModule({
          code: `
[[builtin(position)]] var<out> Position : vec4<f32>;
[[stage(vertex)]] fn main() -> void {
    Position = vec4<f32>(0.0, 0.0, 0.0, 1.0);
}
          `,
        }),
        entryPoint: 'main',
      },
      primitive: {
        topology: 'point-list',
      },
    });

    const renderTarget = t.device.createTexture({
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      size: [1, 1, 1],
      format: textureFormat,
    });

    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          attachment: renderTarget.createView(),
          loadValue: dstColor,
        },
      ],
    });
    renderPass.setPipeline(pipeline);
    renderPass.setBlendColor(varColor);
    renderPass.setBindGroup(
      0,
      t.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: {
              buffer: t.makeBufferWithContents(
                new Float32Array([srcColor.r, srcColor.g, srcColor.b, srcColor.a]),
                GPUBufferUsage.UNIFORM
              ),
            },
          },
        ],
      })
    );
    renderPass.draw(1);
    renderPass.endPass();

    t.device.queue.submit([commandEncoder.finish()]);

    const tolerance = 0.0001;
    const expectedLow = mapColor(expectedColor, v => v - tolerance);
    const expectedHigh = mapColor(expectedColor, v => v + tolerance);

    t.expectSinglePixelBetweenTwoValuesIn2DTexture(renderTarget, textureFormat, { x: 0, y: 0}, {
      exp: [
        new Float32Array([expectedLow.r, expectedLow.g, expectedLow.b, expectedLow.a]),
        new Float32Array([expectedHigh.r, expectedHigh.g, expectedHigh.b, expectedHigh.a]),
      ]
    });
  });

g.test('clamp,blend_factor')
  .desc('For fixed-point formats, test that the blend factor is clamped in the blend equation.')
  .unimplemented();

g.test('clamp,blend_color')
  .desc('For fixed-point formats, test that the blend color is clamped in the blend equation.')
  .unimplemented();

g.test('clamp,blend_result')
  .desc('For fixed-point formats, test that the blend result is clamped in the blend equation.')
  .unimplemented();
