export const description = `
createRenderPipeline and createRenderPipelineAsync validation tests.

TODO: review existing tests, write descriptions, and make sure tests are complete.
      Make sure the following is covered. Consider splitting the file if too large/disjointed.
> - various attachment problems
>
> - interface matching between vertex and fragment shader
>     - superset, subset, etc.
>
> - vertex stage {valid, invalid}
> - fragment stage {valid, invalid}
> - primitive topology all possible values
> - rasterizationState various values
> - multisample count {0, 1, 3, 4, 8, 16, 1024}
> - multisample mask {0, 0xFFFFFFFF}
> - alphaToCoverage:
>     - alphaToCoverageEnabled is { true, false } and sampleCount { = 1, = 4 }.
>       The only failing case is (true, 1).
>     - output SV_Coverage semantics is statically used by fragmentStage and
>       alphaToCoverageEnabled is { true (fails), false (passes) }.
>     - sampleMask is being used and alphaToCoverageEnabled is { true (fails), false (passes) }.

`;

import { makeTestGroup } from '../../../common/framework/test_group.js';
import { kTextureFormats, kTextureFormatInfo } from '../../capability_info.js';

import { ValidationTest } from './validation_test.js';

class F extends ValidationTest {
  getDescriptor(
    options: {
      topology?: GPUPrimitiveTopology;
      targets?: GPUColorTargetState[];
      sampleCount?: number;
      depthStencil?: GPUDepthStencilState;
    } = {}
  ): GPURenderPipelineDescriptor {
    const defaultTargets: GPUColorTargetState[] = [{ format: 'rgba8unorm' }];
    const {
      topology = 'triangle-list',
      targets = defaultTargets,
      sampleCount = 1,
      depthStencil,
    } = options;

    const format = targets.length ? targets[0].format : 'rgba8unorm';

    let fragColorType;
    let suffix;
    if (format.endsWith('sint')) {
      fragColorType = 'i32';
      suffix = '';
    } else if (format.endsWith('uint')) {
      fragColorType = 'u32';
      suffix = 'u';
    } else {
      fragColorType = 'f32';
      suffix = '.0';
    }

    return {
      vertex: {
        module: this.device.createShaderModule({
          code: `
            [[stage(vertex)]] fn main() -> [[builtin(position)]] vec4<f32> {
              return vec4<f32>(0.0, 0.0, 0.0, 1.0);
            }`,
        }),
        entryPoint: 'main',
      },
      fragment: {
        module: this.device.createShaderModule({
          code: `
            [[stage(fragment)]] fn main() -> [[location(0)]] vec4<${fragColorType}> {
              return vec4<${fragColorType}>(0${suffix}, 1${suffix}, 0${suffix}, 1${suffix});
            }`,
        }),
        entryPoint: 'main',
        targets,
      },
      layout: this.getPipelineLayout(),
      primitive: { topology },
      multisample: { count: sampleCount },
      depthStencil,
    };
  }

  getPipelineLayout(): GPUPipelineLayout {
    return this.device.createPipelineLayout({ bindGroupLayouts: [] });
  }

  createTexture(params: { format: GPUTextureFormat; sampleCount: number }): GPUTexture {
    const { format, sampleCount } = params;

    return this.device.createTexture({
      size: { width: 4, height: 4, depthOrArrayLayers: 1 },
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      format,
      sampleCount,
    });
  }

  doCreateRenderPipelineTest(
    isAsync: boolean,
    _success: boolean,
    descriptor: GPURenderPipelineDescriptor
  ) {
    if (isAsync) {
      if (_success) {
        this.shouldResolve(this.device.createRenderPipelineAsync(descriptor));
      } else {
        this.shouldReject('OperationError', this.device.createRenderPipelineAsync(descriptor));
      }
    } else {
      if (_success) {
        this.device.createRenderPipeline(descriptor);
      } else {
        this.expectValidationError(() => {
          this.device.createRenderPipeline(descriptor);
        });
      }
    }
  }
}

export const g = makeTestGroup(F);

g.test('basic_use_of_createRenderPipeline')
  .params(u => u.combine('isAsync', [false, true]))
  .fn(async t => {
    const { isAsync } = t.params;
    const descriptor = t.getDescriptor();

    t.doCreateRenderPipelineTest(isAsync, true, descriptor);
  });

g.test('at_least_one_color_state_is_required')
  .params(u => u.combine('isAsync', [false, true]))
  .fn(async t => {
    const { isAsync } = t.params;

    const goodDescriptor = t.getDescriptor({
      targets: [{ format: 'rgba8unorm' }],
    });

    // Control case
    t.doCreateRenderPipelineTest(isAsync, true, goodDescriptor);

    // Fail because lack of color states
    const badDescriptor = t.getDescriptor({
      targets: [],
    });

    t.doCreateRenderPipelineTest(isAsync, false, badDescriptor);
  });

g.test('color_formats_must_be_renderable')
  .params(u => u.combine('isAsync', [false, true]).combine('format', kTextureFormats))
  .fn(async t => {
    const { isAsync, format } = t.params;
    const info = kTextureFormatInfo[format];
    await t.selectDeviceOrSkipTestCase(info.feature);

    const descriptor = t.getDescriptor({ targets: [{ format }] });

    t.doCreateRenderPipelineTest(isAsync, info.renderable && info.color, descriptor);
  });

g.test('sample_count_must_be_valid')
  .params(u =>
    u.combine('isAsync', [false, true]).combineWithParams([
      { sampleCount: 0, _success: false },
      { sampleCount: 1, _success: true },
      { sampleCount: 2, _success: false },
      { sampleCount: 3, _success: false },
      { sampleCount: 4, _success: true },
      { sampleCount: 8, _success: false },
      { sampleCount: 16, _success: false },
    ])
  )
  .fn(async t => {
    const { isAsync, sampleCount, _success } = t.params;

    const descriptor = t.getDescriptor({ sampleCount });

    t.doCreateRenderPipelineTest(isAsync, _success, descriptor);
  });

g.test('vertex_buffer_layout_must_be_valid')
  .desc(
    `
In this test we test the vertex buffer layuouts validation within creating render pipeline.
    - Test aspect: arrayStrideValue, attributeOffset, attributeCount, wgslTypeCompatible,
      bufferCount, indistinctLocation
    - When testing the arrayStrideValue aspect, we test the following validation in GPUVertexBufferLayout:
      - descriptor.arrayStride no larger than device.[[device]].[[limits]].maxVertexBufferArrayStride.
      - descriptor.arrayStride is a multiple of 4.
    - When testing the attributeOffset aspect, we test the following validation in GPUVertexBufferLayout:
      - For each attribute attrib in the list descriptor.attributes:
        - If descriptor.arrayStride is zero:
          - attrib.offset + sizeof(attrib.format) no larger than device.[[device]].[[limits]].maxVertexBufferArrayStride.
        - Otherwise:
          - attrib.offset + sizeof(attrib.format) no larger than descriptor.arrayStride.
        - attrib.offset is a multiple of the minimum of 4 and sizeof(attrib.format).
    - When testing the attributeCount aspect, we test the following validation:
      - In GPUVertexBufferLayout, for each attribute attrib in the list descriptor.attributes:
        - attrib.shaderLocation is less than device.[[device]].[[limits]].maxVertexAttributes.
      - In GPUVertexState, The sum of vertexBuffer.attributes.length, over every vertexBuffer in
        descriptor.buffers, is less than or equal to device.[[device]].[[limits]].maxVertexAttributes.
    - When testing the wgslTypeCompatible aspect, we test the following validation in GPUVertexBufferLayout:
      - For each vertex attribute that serve as a input of the vertex shader entry point, the corresponding
        attrib element of descriptor.attributes with matched shader location satisfying that:
        - The format in shader must be compatible with attrbi.format
    - When testing the bufferCount aspect, we test the following validation in GPUVertexState:
      - descriptor.buffers.length is less than or equal to device.[[device]].[[limits]].maxVertexBuffers.
        - By changing the number of buffers with attributes and adding buffer with no attribute
    - When testing the indistinctLocation aspect, we test the following validation in GPUVertexState:
      - Each attrib in the union of all GPUVertexAttribute across descriptor.buffers has a distinct
        attrib.shaderLocation value.
`
  )
  .unimplemented();
