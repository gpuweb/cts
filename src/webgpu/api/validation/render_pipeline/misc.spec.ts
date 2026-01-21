export const description = `
misc createRenderPipeline and createRenderPipelineAsync validation tests.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { getGPU } from '../../../../common/util/navigator_gpu.js';
import { assert, supportsImmediateData } from '../../../../common/util/util.js';
import {
  isTextureFormatUsableWithStorageAccessMode,
  kPossibleStorageTextureFormats,
} from '../../../format_info.js';
import { kDefaultVertexShaderCode, kDefaultFragmentShaderCode } from '../../../util/shader.js';
import * as vtu from '../validation_test_utils.js';

import { CreateRenderPipelineValidationTest } from './common.js';

export const g = makeTestGroup(CreateRenderPipelineValidationTest);

g.test('basic')
  .desc(`Test basic usage of createRenderPipeline.`)
  .params(u => u.combine('isAsync', [false, true]))
  .fn(t => {
    const { isAsync } = t.params;
    const descriptor = t.getDescriptor();

    vtu.doCreateRenderPipelineTest(t, isAsync, true, descriptor);
  });

g.test('no_attachment')
  .desc(`Test that createRenderPipeline fails without any attachment.`)
  .params(u => u.combine('isAsync', [false, true]))
  .fn(t => {
    const { isAsync } = t.params;

    const descriptor = t.getDescriptor({
      noFragment: true,
      depthStencil: undefined,
    });

    vtu.doCreateRenderPipelineTest(t, isAsync, false, descriptor);
  });

g.test('vertex_state_only')
  .desc(
    `Tests creating vertex-state-only render pipeline. A vertex-only render pipeline has no fragment
state (and thus has no color state), and must have a depth-stencil state as an attachment is required.`
  )
  .params(u =>
    u
      .combine('isAsync', [false, true])
      .beginSubcases()
      .combine('depthStencilFormat', [
        'depth24plus',
        'depth24plus-stencil8',
        'depth32float',
        '',
      ] as const)
      .combine('hasColor', [false, true])
      .unless(({ depthStencilFormat, hasColor }) => {
        // Render pipeline needs at least one attachement
        return hasColor === false && depthStencilFormat === '';
      })
  )
  .fn(t => {
    const { isAsync, depthStencilFormat, hasColor } = t.params;

    let depthStencilState: GPUDepthStencilState | undefined;
    if (depthStencilFormat === '') {
      depthStencilState = undefined;
    } else {
      depthStencilState = {
        format: depthStencilFormat,
        depthWriteEnabled: false,
        depthCompare: 'always',
      };
    }

    // Having targets or not should have no effect in result, since it will not appear in the
    // descriptor in vertex-only render pipeline
    const descriptor = t.getDescriptor({
      noFragment: true,
      depthStencil: depthStencilState,
      targets: hasColor ? [{ format: 'rgba8unorm' }] : [],
    });

    vtu.doCreateRenderPipelineTest(t, isAsync, depthStencilState !== undefined, descriptor);
  });

g.test('pipeline_layout,device_mismatch')
  .desc(
    'Tests createRenderPipeline(Async) cannot be called with a pipeline layout created from another device'
  )
  .paramsSubcasesOnly(u => u.combine('isAsync', [true, false]).combine('mismatched', [true, false]))
  .beforeAllSubcases(t => t.usesMismatchedDevice())
  .fn(t => {
    const { isAsync, mismatched } = t.params;

    const sourceDevice = mismatched ? t.mismatchedDevice : t.device;

    const layout = sourceDevice.createPipelineLayout({ bindGroupLayouts: [] });

    const format = 'rgba8unorm';
    const descriptor = {
      layout,
      vertex: {
        module: t.device.createShaderModule({
          code: kDefaultVertexShaderCode,
        }),
        entryPoint: 'main',
      },
      fragment: {
        module: t.device.createShaderModule({
          code: kDefaultFragmentShaderCode,
        }),
        entryPoint: 'main',
        targets: [{ format }] as const,
      },
    };

    vtu.doCreateRenderPipelineTest(t, isAsync, !mismatched, descriptor);
  });

g.test('external_texture')
  .desc('Tests createRenderPipeline(Async) with an external_texture')
  .params(u => u.combine('isAsync', [false, true]))
  .fn(t => {
    const { isAsync } = t.params;
    const shader = t.device.createShaderModule({
      code: `
        @vertex
        fn vertexMain() -> @builtin(position) vec4f {
          return vec4f(1);
        }

        @group(0) @binding(0) var myTexture: texture_external;

        @fragment
        fn fragmentMain() -> @location(0) vec4f {
          let result = textureLoad(myTexture, vec2u(1, 1));
          return vec4f(1);
        }
      `,
    });

    const descriptor: GPURenderPipelineDescriptor = {
      layout: 'auto',
      vertex: {
        module: shader,
      },
      fragment: {
        module: shader,
        targets: [{ format: 'rgba8unorm' }],
      },
    };

    vtu.doCreateRenderPipelineTest(t, isAsync, true, descriptor);
  });

g.test('storage_texture,format')
  .desc(
    `
Test that a pipeline with auto layout and storage texture access combo that is not supported
generates a validation error at createComputePipeline(Async)
  `
  )
  .params(u =>
    u //
      .combine('format', kPossibleStorageTextureFormats)
      .beginSubcases()
      .combine('isAsync', [true, false] as const)
      .combine('access', ['read', 'write', 'read_write'] as const)
      .combine('dimension', ['1d', '2d', '3d'] as const)
  )
  .fn(t => {
    const { format, isAsync, access, dimension } = t.params;
    t.skipIfTextureFormatNotSupported(format);

    const code = `
      @group(0) @binding(0) var tex: texture_storage_${dimension}<${format}, ${access}>;
      @vertex fn vs() -> @builtin(position) vec4f {
        return vec4f(0);
      }

      @fragment fn fs() -> @location(0) vec4f {
        _ = tex;
        return vec4f(0);
      }
    `;
    const module = t.device.createShaderModule({ code });

    const success = isTextureFormatUsableWithStorageAccessMode(t.device.features, format, access);
    const descriptor: GPURenderPipelineDescriptor = {
      layout: 'auto',
      vertex: { module },
      fragment: { module, targets: [{ format: 'rgba8unorm' }] },
    };
    vtu.doCreateRenderPipelineTest(t, isAsync, success, descriptor);
  });

g.test('pipeline_creation_immediate_size_mismatch')
  .desc(
    `
    Validate that creating a pipeline fails if the shader uses immediate data
    larger than the immediateSize specified in the pipeline layout, or larger than
    maxImmediateSize if layout is 'auto'.
    Also validates that using less or equal size is allowed.
    `
  )
  .params(u => {
    const kNumericCases = [
      { vertexSize: 16, fragmentSize: 16, layoutSize: 16 }, // Equal
      { vertexSize: 12, fragmentSize: 12, layoutSize: 16 }, // Shader smaller
      { vertexSize: 20, fragmentSize: 20, layoutSize: 16 }, // Shader larger (small diff)
      { vertexSize: 32, fragmentSize: 32, layoutSize: 16 }, // Shader larger
    ] as const;
    const kMaxLimitsCases = [
      { vertexSize: 'max', fragmentSize: 0, layoutSize: 'auto' }, // Vertex = Limit (Control)
      { vertexSize: 0, fragmentSize: 'max', layoutSize: 'auto' }, // Fragment = Limit (Control)
      { vertexSize: 'max', fragmentSize: 'max', layoutSize: 'auto' }, // Both at Limit (Control)
      { vertexSize: 'exceedLimits', fragmentSize: 0, layoutSize: 'auto' }, // Vertex > Limit
      { vertexSize: 0, fragmentSize: 'exceedLimits', layoutSize: 'auto' }, // Fragment > Limit
    ] as const;
    return u
      .combine('isAsync', [true, false])
      .combineWithParams([...kNumericCases, ...kMaxLimitsCases] as const);
  })
  .fn(t => {
    t.skipIf(!supportsImmediateData(getGPU(t.rec)), 'Immediate data not supported');

    const { isAsync, vertexSize, fragmentSize, layoutSize } = t.params;

    assert(t.device.limits.maxImmediateSize !== undefined);
    const maxImmediateSize = t.device.limits.maxImmediateSize;

    const resolveSize = (sizeDescriptor: number | string) => {
      if (typeof sizeDescriptor === 'number') return sizeDescriptor;
      if (sizeDescriptor === 'max') return maxImmediateSize;
      if (sizeDescriptor === 'exceedLimits') return maxImmediateSize + 4;
      return 0;
    };

    const resolvedVertexImmediateSize = resolveSize(vertexSize);
    const resolvedFragmentImmediateSize = resolveSize(fragmentSize);

    // Helper to generate a stage-specific shader module with the given immediate data size.
    const makeShaderCode = (size: number, stage: 'vertex' | 'fragment') => {
      if (size === 0) {
        if (stage === 'vertex') {
          return `@vertex fn main_vertex() -> @builtin(position) vec4<f32> { return vec4<f32>(0.0, 0.0, 0.0, 1.0); }`;
        }
        return `@fragment fn main_fragment() -> @location(0) vec4<f32> { return vec4<f32>(0.0, 1.0, 0.0, 1.0); }`;
      }
      const numFields = size / 4;
      const fields = Array.from({ length: numFields }, (_, i) => `m${i}: u32`).join(', ');
      if (stage === 'vertex') {
        return `
          struct Immediates { ${fields} }
          var<immediate> data: Immediates;
          @vertex fn main_vertex() -> @builtin(position) vec4<f32> { _ = data.m0; return vec4<f32>(0.0, 0.0, 0.0, 1.0); }
        `;
      }
      return `
        struct Immediates { ${fields} }
        var<immediate> data: Immediates;
        @fragment fn main_fragment() -> @location(0) vec4<f32> { _ = data.m0; return vec4<f32>(0.0, 1.0, 0.0, 1.0); }
      `;
    };

    let layout: GPUPipelineLayout | 'auto';
    let validSize: number;

    if (layoutSize === 'auto') {
      layout = 'auto';
      validSize = maxImmediateSize;
    } else {
      layout = t.device.createPipelineLayout({
        bindGroupLayouts: [],
        immediateSize: layoutSize as number,
      });
      validSize = layoutSize as number;
    }

    const vertexExceedsLimit = resolvedVertexImmediateSize > validSize;
    const fragmentExceedsLimit = resolvedFragmentImmediateSize > validSize;
    const shouldError = vertexExceedsLimit || fragmentExceedsLimit;

    // When the shader exceeds the device's maxImmediateSize, the error occurs
    // at shader module creation time, not pipeline creation time.
    // Create each shader module separately so the correct one gets the error.
    const vertexCode = makeShaderCode(resolvedVertexImmediateSize, 'vertex');
    const fragmentCode = makeShaderCode(resolvedFragmentImmediateSize, 'fragment');

    if (layoutSize === 'auto' && vertexExceedsLimit) {
      t.expectValidationError(() => {
        t.device.createShaderModule({ code: vertexCode });
      });
    }
    if (layoutSize === 'auto' && fragmentExceedsLimit) {
      t.expectValidationError(() => {
        t.device.createShaderModule({ code: fragmentCode });
      });
    }
    if (layoutSize === 'auto' && shouldError) {
      return;
    }

    vtu.doCreateRenderPipelineTest(t, isAsync, !shouldError, {
      layout,
      vertex: {
        module: t.device.createShaderModule({ code: vertexCode }),
      },
      fragment: {
        module: t.device.createShaderModule({ code: fragmentCode }),
        targets: [{ format: 'rgba8unorm' }],
      },
    });
  });
