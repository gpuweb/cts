export const description = `
createRenderPipeline and createRenderPipelineAsync validation tests.

- TODO: interface matching between vertex and fragment shader
    - superset, subset, etc.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { assert, unreachable, range } from '../../../../common/util/util.js';
import {
  kTextureFormats,
  kRenderableColorTextureFormats,
  kTextureFormatInfo,
  kDepthStencilFormats,
  kCompareFunctions,
  kStencilOperations,
  kBlendFactors,
  kBlendOperations,
  kPrimitiveTopology,
  kIndexFormat,
} from '../../../capability_info.js';
import {
  getFragmentShaderCodeWithOutput,
  getPlainTypeInfo,
  getShaderWithEntryPoint,
} from '../../../util/shader.js';
import { kTexelRepresentationInfo } from '../../../util/texture/texel_data.js';
import { ValidationTest } from '../validation_test.js';

const kDefaultVertexShaderCode = `
@vertex fn main() -> @builtin(position) vec4<f32> {
  return vec4<f32>(0.0, 0.0, 0.0, 1.0);
}
`;

const kDefaultFragmentShadercode = `
@fragment fn main() -> @location(0) vec4<f32>  {
  return vec4<f32>(1.0, 1.0, 1.0, 1.0);
}`;

const values = [0, 1, 0, 1];
class F extends ValidationTest {
  getDescriptor(
    options: {
      primitive?: GPUPrimitiveState;
      targets?: GPUColorTargetState[];
      multisample?: GPUMultisampleState;
      depthStencil?: GPUDepthStencilState;
      fragmentShaderCode?: string;
      noFragment?: boolean;
    } = {}
  ): GPURenderPipelineDescriptor {
    const defaultTargets: GPUColorTargetState[] = [{ format: 'rgba8unorm' }];
    const {
      primitive = {},
      targets = defaultTargets,
      multisample = {},
      depthStencil,
      fragmentShaderCode = getFragmentShaderCodeWithOutput([
        {
          values,
          plainType: getPlainTypeInfo(
            kTextureFormatInfo[targets[0] ? targets[0].format : 'rgba8unorm'].sampleType
          ),
          componentCount: 4,
        },
      ]),
      noFragment = false,
    } = options;

    return {
      vertex: {
        module: this.device.createShaderModule({
          code: kDefaultVertexShaderCode,
        }),
        entryPoint: 'main',
      },
      fragment: noFragment
        ? undefined
        : {
            module: this.device.createShaderModule({
              code: fragmentShaderCode,
            }),
            entryPoint: 'main',
            targets,
          },
      layout: this.getPipelineLayout(),
      primitive,
      multisample,
      depthStencil,
    };
  }

  getPipelineLayout(): GPUPipelineLayout {
    return this.device.createPipelineLayout({ bindGroupLayouts: [] });
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
      this.expectValidationError(() => {
        this.device.createRenderPipeline(descriptor);
      }, !_success);
    }
  }
}

export const g = makeTestGroup(F);

g.test('basic')
  .desc(`Test basic usage of createRenderPipeline.`)
  .params(u => u.combine('isAsync', [false, true]))
  .fn(async t => {
    const { isAsync } = t.params;
    const descriptor = t.getDescriptor();

    t.doCreateRenderPipelineTest(isAsync, true, descriptor);
  });

g.test('vertex_state_only')
  .desc(
    `Tests creating vertex-state-only render pipeline. A vertex-only render pipeline has no fragment
state (and thus has no color state), and can be created with or without depth stencil state.`
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
  )
  .fn(async t => {
    const { isAsync, depthStencilFormat, hasColor } = t.params;

    let depthStencilState: GPUDepthStencilState | undefined;
    if (depthStencilFormat === '') {
      depthStencilState = undefined;
    } else {
      depthStencilState = { format: depthStencilFormat };
    }

    // Having targets or not should have no effect in result, since it will not appear in the
    // descriptor in vertex-only render pipeline
    const descriptor = t.getDescriptor({
      noFragment: true,
      depthStencil: depthStencilState,
      targets: hasColor ? [{ format: 'rgba8unorm' }] : [],
    });

    t.doCreateRenderPipelineTest(isAsync, true, descriptor);
  });

g.test('fragment_state,color_target_exists')
  .desc(`Tests creating a complete render pipeline requires at least one color target state.`)
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

g.test('fragment_state,max_color_attachments_limit')
  .desc(
    `Tests that color state targets length must not be larger than device.limits.maxColorAttachments.`
  )
  .params(u => u.combine('isAsync', [false, true]).combine('targetsLength', [8, 9]))
  .fn(async t => {
    const { isAsync, targetsLength } = t.params;

    const descriptor = t.getDescriptor({
      targets: range(targetsLength, () => {
        return { format: 'rgba8unorm' };
      }),
    });

    t.doCreateRenderPipelineTest(
      isAsync,
      targetsLength <= t.device.limits.maxColorAttachments,
      descriptor
    );
  });

g.test('fragment_state,targets_format_renderable')
  .desc(`Tests that color target state format must have RENDER_ATTACHMENT capability.`)
  .params(u => u.combine('isAsync', [false, true]).combine('format', kTextureFormats))
  .beforeAllSubcases(t => {
    const { format } = t.params;
    const info = kTextureFormatInfo[format];
    t.selectDeviceOrSkipTestCase(info.feature);
  })
  .fn(async t => {
    const { isAsync, format } = t.params;
    const info = kTextureFormatInfo[format];

    const descriptor = t.getDescriptor({ targets: [{ format }] });

    t.doCreateRenderPipelineTest(isAsync, info.renderable && info.color, descriptor);
  });

g.test('fragment_state,targets_format_filterable')
  .desc(`Tests that color target state format must be filterable if blend is not undefined.`)
  .params(u =>
    u
      .combine('isAsync', [false, true])
      .combine('format', kRenderableColorTextureFormats)
      .beginSubcases()
      .combine('hasBlend', [false, true])
  )
  .beforeAllSubcases(t => {
    const { format } = t.params;
    const info = kTextureFormatInfo[format];
    t.selectDeviceOrSkipTestCase(info.feature);
  })
  .fn(async t => {
    const { isAsync, format, hasBlend } = t.params;
    const info = kTextureFormatInfo[format];

    const descriptor = t.getDescriptor({
      targets: [
        {
          format,
          blend: hasBlend ? { color: {}, alpha: {} } : undefined,
        },
      ],
    });

    t.doCreateRenderPipelineTest(isAsync, !hasBlend || info.sampleType === 'float', descriptor);
  });

g.test('fragment_state,targets_blend')
  .desc(
    `
  For the blend components on either GPUBlendState.color or GPUBlendState.alpha:
  - Tests if the combination of 'srcFactor', 'dstFactor' and 'operation' is valid (if the blend
    operation is "min" or "max", srcFactor and dstFactor must be "one").
  `
  )
  .params(u =>
    u
      .combine('isAsync', [false, true])
      .combine('component', ['color', 'alpha'] as const)
      .beginSubcases()
      .combine('srcFactor', kBlendFactors)
      .combine('dstFactor', kBlendFactors)
      .combine('operation', kBlendOperations)
  )
  .fn(async t => {
    const { isAsync, component, srcFactor, dstFactor, operation } = t.params;

    const defaultBlendComponent: GPUBlendComponent = {
      srcFactor: 'src-alpha',
      dstFactor: 'dst-alpha',
      operation: 'add',
    };
    const blendComponentToTest: GPUBlendComponent = {
      srcFactor,
      dstFactor,
      operation,
    };
    const format = 'rgba8unorm';

    const descriptor = t.getDescriptor({
      targets: [
        {
          format,
          blend: {
            color: component === 'color' ? blendComponentToTest : defaultBlendComponent,
            alpha: component === 'alpha' ? blendComponentToTest : defaultBlendComponent,
          },
        },
      ],
    });

    if (operation === 'min' || operation === 'max') {
      const _success = srcFactor === 'one' && dstFactor === 'one';
      t.doCreateRenderPipelineTest(isAsync, _success, descriptor);
    } else {
      t.doCreateRenderPipelineTest(isAsync, true, descriptor);
    }
  });

g.test('fragment_state,targets_write_mask')
  .desc(`Tests that color target state write mask must be < 16.`)
  .params(u => u.combine('isAsync', [false, true]).combine('writeMask', [0, 0xf, 0x10, 0x80000001]))
  .fn(async t => {
    const { isAsync, writeMask } = t.params;

    const descriptor = t.getDescriptor({
      targets: [
        {
          format: 'rgba8unorm',
          writeMask,
        },
      ],
    });

    t.doCreateRenderPipelineTest(isAsync, writeMask < 16, descriptor);
  });

g.test('primitive_state,strip_index_format')
  .desc(
    `If primitive.topology is not "line-strip" or "triangle-strip", primitive.stripIndexFormat must be undefined.`
  )
  .params(u =>
    u
      .combine('isAsync', [false, true])
      .combine('topology', [undefined, ...kPrimitiveTopology] as const)
      .combine('stripIndexFormat', [undefined, ...kIndexFormat] as const)
  )
  .fn(async t => {
    const { isAsync, topology, stripIndexFormat } = t.params;

    const descriptor = t.getDescriptor({ primitive: { topology, stripIndexFormat } });

    const _success =
      topology === 'line-strip' || topology === 'triangle-strip' || stripIndexFormat === undefined;
    t.doCreateRenderPipelineTest(isAsync, _success, descriptor);
  });

g.test('primitive_state,unclipped_depth')
  .desc(`If primitive.unclippedDepth is true, features must contain "depth-clip-control".`)
  .params(u => u.combine('isAsync', [false, true]).combine('unclippedDepth', [false, true]))
  .fn(async t => {
    const { isAsync, unclippedDepth } = t.params;

    const descriptor = t.getDescriptor({ primitive: { unclippedDepth } });

    const _success = !unclippedDepth || t.device.features.has('depth-clip-control');
    t.doCreateRenderPipelineTest(isAsync, _success, descriptor);
  });

g.test('multisample_state,count')
  .desc(`If multisample.count must either be 1 or 4.`)
  .params(u =>
    u
      .combine('isAsync', [false, true])
      .beginSubcases()
      .combine('count', [0, 1, 2, 3, 4, 8, 16, 1024])
  )
  .fn(async t => {
    const { isAsync, count } = t.params;

    const descriptor = t.getDescriptor({ multisample: { count, alphaToCoverageEnabled: false } });

    const _success = count === 1 || count === 4;
    t.doCreateRenderPipelineTest(isAsync, _success, descriptor);
  });

g.test('multisample_state,alpha_to_coverage,count')
  .desc(
    `If multisample.alphaToCoverageEnabled is true, multisample.count must be greater than 1, e.g. it can only be 4.`
  )
  .params(u =>
    u
      .combine('isAsync', [false, true])
      .combine('alphaToCoverageEnabled', [false, true])
      .beginSubcases()
      .combine('count', [1, 4])
  )
  .fn(async t => {
    const { isAsync, alphaToCoverageEnabled, count } = t.params;

    const descriptor = t.getDescriptor({ multisample: { count, alphaToCoverageEnabled } });

    const _success = alphaToCoverageEnabled ? count === 4 : count === 1 || count === 4;
    t.doCreateRenderPipelineTest(isAsync, _success, descriptor);
  });

g.test('multisample_state,alpha_to_coverage,sample_mask')
  .desc(
    `If sample_mask builtin is a pipeline output of fragment or if multisample.mask is not 0xFFFFFFFF, multisample.alphaToCoverageEnabled should be false.`
  )
  .params(u =>
    u
      .combine('isAsync', [false, true])
      .combine('alphaToCoverageEnabled', [false, true])
      .beginSubcases()
      .combine('hasSampleMaskOutput', [false, true])
      .combine('mask', [0, 0x1, 0x2, 0xffffffff])
  )
  .fn(async t => {
    const { isAsync, alphaToCoverageEnabled, mask, hasSampleMaskOutput } = t.params;

    const descriptor = t.getDescriptor({
      multisample: { mask, alphaToCoverageEnabled, count: 4 },
      fragmentShaderCode: hasSampleMaskOutput
        ? `
      struct Output {
        @builtin(sample_mask) mask_out: u32,
        @location(0) color : vec4<f32>,
      }
      @fragment fn main() -> Output {
        var o: Output;
        // We need to make sure this sample_mask isn't optimized out even its value equals "no op".
        o.mask_out = 0xFFFFFFFFu;
        o.color = vec4<f32>(1.0, 1.0, 1.0, 1.0);
        return o;
      }`
        : kDefaultFragmentShadercode,
    });

    const _success =
      !(hasSampleMaskOutput || mask !== 0xffffffff) || alphaToCoverageEnabled === false;
    t.doCreateRenderPipelineTest(isAsync, _success, descriptor);
  });

g.test('depth_stencil_state,format')
  .desc(`The texture format in depthStencilState must be a depth/stencil format.`)
  .params(u => u.combine('isAsync', [false, true]).combine('format', kTextureFormats))
  .beforeAllSubcases(t => {
    const { format } = t.params;
    const info = kTextureFormatInfo[format];
    t.selectDeviceOrSkipTestCase(info.feature);
  })
  .fn(async t => {
    const { isAsync, format } = t.params;
    const info = kTextureFormatInfo[format];

    const descriptor = t.getDescriptor({ depthStencil: { format } });

    t.doCreateRenderPipelineTest(isAsync, info.depth || info.stencil, descriptor);
  });

g.test('depth_stencil_state,depth_test')
  .desc(
    `Depth aspect must be contained in the format if depth test is enabled in depthStencilState.`
  )
  .params(u =>
    u
      .combine('isAsync', [false, true])
      .combine('format', kDepthStencilFormats)
      .combine('depthCompare', [undefined, ...kCompareFunctions])
  )
  .beforeAllSubcases(t => {
    const { format } = t.params;
    const info = kTextureFormatInfo[format];
    t.selectDeviceOrSkipTestCase(info.feature);
  })
  .fn(async t => {
    const { isAsync, format, depthCompare } = t.params;
    const info = kTextureFormatInfo[format];

    const descriptor = t.getDescriptor({
      depthStencil: { format, depthCompare },
    });

    const depthTestEnabled = depthCompare !== undefined && depthCompare !== 'always';
    t.doCreateRenderPipelineTest(isAsync, !depthTestEnabled || info.depth, descriptor);
  });

g.test('depth_stencil_state,depth_write')
  .desc(
    `Depth aspect must be contained in the format if depth write is enabled in depthStencilState.`
  )
  .params(u =>
    u
      .combine('isAsync', [false, true])
      .combine('format', kDepthStencilFormats)
      .combine('depthWriteEnabled', [false, true])
  )
  .beforeAllSubcases(t => {
    const { format } = t.params;
    const info = kTextureFormatInfo[format];
    t.selectDeviceOrSkipTestCase(info.feature);
  })
  .fn(async t => {
    const { isAsync, format, depthWriteEnabled } = t.params;
    const info = kTextureFormatInfo[format];

    const descriptor = t.getDescriptor({
      depthStencil: { format, depthWriteEnabled },
    });
    t.doCreateRenderPipelineTest(isAsync, !depthWriteEnabled || info.depth, descriptor);
  });

g.test('depth_stencil_state,stencil_test')
  .desc(
    `Stencil aspect must be contained in the format if stencil test is enabled in depthStencilState.`
  )
  .params(u =>
    u
      .combine('isAsync', [false, true])
      .combine('format', kDepthStencilFormats)
      .combine('face', ['front', 'back'] as const)
      .combine('compare', [undefined, ...kCompareFunctions])
  )
  .beforeAllSubcases(t => {
    const { format } = t.params;
    const info = kTextureFormatInfo[format];
    t.selectDeviceOrSkipTestCase(info.feature);
  })
  .fn(async t => {
    const { isAsync, format, face, compare } = t.params;
    const info = kTextureFormatInfo[format];

    let descriptor: GPURenderPipelineDescriptor;
    if (face === 'front') {
      descriptor = t.getDescriptor({ depthStencil: { format, stencilFront: { compare } } });
    } else {
      descriptor = t.getDescriptor({ depthStencil: { format, stencilBack: { compare } } });
    }

    const stencilTestEnabled = compare !== undefined && compare !== 'always';
    t.doCreateRenderPipelineTest(isAsync, !stencilTestEnabled || info.stencil, descriptor);
  });

g.test('depth_stencil_state,stencil_write')
  .desc(
    `Stencil aspect must be contained in the format if stencil write is enabled in depthStencilState.`
  )
  .params(u =>
    u
      .combine('isAsync', [false, true])
      .combine('format', kDepthStencilFormats)
      .combine('faceAndOpType', [
        'frontFailOp',
        'frontDepthFailOp',
        'frontPassOp',
        'backFailOp',
        'backDepthFailOp',
        'backPassOp',
      ] as const)
      .combine('op', [undefined, ...kStencilOperations])
  )
  .beforeAllSubcases(t => {
    const { format } = t.params;
    const info = kTextureFormatInfo[format];
    t.selectDeviceOrSkipTestCase(info.feature);
  })
  .fn(async t => {
    const { isAsync, format, faceAndOpType, op } = t.params;
    const info = kTextureFormatInfo[format];

    let depthStencil: GPUDepthStencilState;
    switch (faceAndOpType) {
      case 'frontFailOp':
        depthStencil = { format, stencilFront: { failOp: op } };
        break;
      case 'frontDepthFailOp':
        depthStencil = { format, stencilFront: { depthFailOp: op } };
        break;
      case 'frontPassOp':
        depthStencil = { format, stencilFront: { passOp: op } };
        break;
      case 'backFailOp':
        depthStencil = { format, stencilBack: { failOp: op } };
        break;
      case 'backDepthFailOp':
        depthStencil = { format, stencilBack: { depthFailOp: op } };
        break;
      case 'backPassOp':
        depthStencil = { format, stencilBack: { passOp: op } };
        break;
      default:
        unreachable();
    }
    const descriptor = t.getDescriptor({ depthStencil });

    const stencilWriteEnabled = op !== undefined && op !== 'keep';
    t.doCreateRenderPipelineTest(isAsync, !stencilWriteEnabled || info.stencil, descriptor);
  });

g.test('fragment_state,pipeline_output_targets')
  .desc(
    `Pipeline fragment output types must be compatible with target color state format
  - The scalar type (f32, i32, or u32) must match the sample type of the format.
  - The componentCount of the fragment output (e.g. f32, vec2, vec3, vec4) must not have fewer
    channels than that of the color attachment texture formats. Extra components are allowed and are discarded.

  Otherwise, color state write mask must be 0.

  MAINTENANCE_TODO: update this test after the WebGPU SPEC ISSUE 50 "define what 'compatible' means
  for render target formats" is resolved.`
  )
  .params(u =>
    u
      .combine('isAsync', [false, true])
      .combine('writeMask', [0, 0x1, 0x2, 0x4, 0x8, 0xf])
      .combine('format', [undefined, ...kRenderableColorTextureFormats] as const)
      .beginSubcases()
      .combine('hasShaderOutput', [false, true])
      .filter(p => p.format === undefined || p.hasShaderOutput === true)
      .combine('sampleType', ['float', 'uint', 'sint'] as const)
      .combine('componentCount', [1, 2, 3, 4])
  )
  .beforeAllSubcases(t => {
    const { format } = t.params;
    if (format) {
      const info = kTextureFormatInfo[format];
      t.selectDeviceOrSkipTestCase(info.feature);
    }
  })
  .fn(async t => {
    const { isAsync, writeMask, format, hasShaderOutput, sampleType, componentCount } = t.params;
    const info = format ? kTextureFormatInfo[format] : null;

    const descriptor = t.getDescriptor({
      targets: format ? [{ format, writeMask }] : [],
      // To have a dummy depthStencil attachment to avoid having no attachment at all which is invalid
      depthStencil: { format: 'depth24plus' },
      fragmentShaderCode: getFragmentShaderCodeWithOutput(
        hasShaderOutput ? [{ values, plainType: getPlainTypeInfo(sampleType), componentCount }] : []
      ),
    });

    let _success = true;
    if (hasShaderOutput && info) {
      // there is a target correspond to the pipeline output
      assert(format !== undefined);
      const sampleTypeSuccess =
        info.sampleType === 'float' || info.sampleType === 'unfilterable-float'
          ? sampleType === 'float'
          : info.sampleType === sampleType;
      _success =
        sampleTypeSuccess &&
        componentCount >= kTexelRepresentationInfo[format].componentOrder.length;
    }

    t.doCreateRenderPipelineTest(isAsync, _success, descriptor);
  });

g.test('fragment_state,pipeline_output_targets,blend')
  .desc(
    `On top of requirements from pipeline_output_targets, when blending is enabled and alpha channel is read indicated by any blend factor, an extra requirement is added:
  - fragment output must be vec4.
  `
  )
  .params(u =>
    u
      .combine('isAsync', [false, true])
      .combine('format', ['r8unorm', 'rg8unorm', 'rgba8unorm', 'bgra8unorm'] as const)
      .beginSubcases()
      .combine('componentCount', [1, 2, 3, 4])
      .combineWithParams([
        // extra requirement does not apply
        {
          colorSrcFactor: 'one',
          colorDstFactor: 'zero',
          alphaSrcFactor: 'zero',
          alphaDstFactor: 'zero',
        },
        {
          colorSrcFactor: 'dst-alpha',
          colorDstFactor: 'zero',
          alphaSrcFactor: 'zero',
          alphaDstFactor: 'zero',
        },
        // extra requirement applies, fragment output must be vec4 (contain alpha channel)
        {
          colorSrcFactor: 'src-alpha',
          colorDstFactor: 'one',
          alphaSrcFactor: 'zero',
          alphaDstFactor: 'zero',
        },
        {
          colorSrcFactor: 'one',
          colorDstFactor: 'one-minus-src-alpha',
          alphaSrcFactor: 'zero',
          alphaDstFactor: 'zero',
        },
        {
          colorSrcFactor: 'src-alpha-saturated',
          colorDstFactor: 'one',
          alphaSrcFactor: 'zero',
          alphaDstFactor: 'zero',
        },
        {
          colorSrcFactor: 'one',
          colorDstFactor: 'zero',
          alphaSrcFactor: 'one',
          alphaDstFactor: 'zero',
        },
        {
          colorSrcFactor: 'one',
          colorDstFactor: 'zero',
          alphaSrcFactor: 'zero',
          alphaDstFactor: 'src',
        },
        {
          colorSrcFactor: 'one',
          colorDstFactor: 'zero',
          alphaSrcFactor: 'zero',
          alphaDstFactor: 'src-alpha',
        },
      ] as const)
  )
  .beforeAllSubcases(t => {
    const { format } = t.params;
    const info = kTextureFormatInfo[format];
    t.selectDeviceOrSkipTestCase(info.feature);
  })
  .fn(async t => {
    const sampleType = 'float';
    const {
      isAsync,
      format,
      componentCount,
      colorSrcFactor,
      colorDstFactor,
      alphaSrcFactor,
      alphaDstFactor,
    } = t.params;
    const info = kTextureFormatInfo[format];

    const descriptor = t.getDescriptor({
      targets: [
        {
          format,
          blend: {
            color: {
              srcFactor: colorSrcFactor,
              dstFactor: colorDstFactor,
              operation: 'add',
            },
            alpha: {
              srcFactor: alphaSrcFactor,
              dstFactor: alphaDstFactor,
              operation: 'add',
            },
          },
        },
      ],
      fragmentShaderCode: getFragmentShaderCodeWithOutput([
        { values, plainType: getPlainTypeInfo(sampleType), componentCount },
      ]),
    });

    const colorBlendReadsSrcAlpha =
      colorSrcFactor.includes('src-alpha') || colorDstFactor.includes('src-alpha');
    const meetsExtraBlendingRequirement = !colorBlendReadsSrcAlpha || componentCount === 4;
    const _success =
      info.sampleType === sampleType &&
      componentCount >= kTexelRepresentationInfo[format].componentOrder.length &&
      meetsExtraBlendingRequirement;
    t.doCreateRenderPipelineTest(isAsync, _success, descriptor);
  });

g.test('pipeline_layout,device_mismatch')
  .desc(
    'Tests createRenderPipeline(Async) cannot be called with a pipeline layout created from another device'
  )
  .paramsSubcasesOnly(u => u.combine('isAsync', [true, false]).combine('mismatched', [true, false]))
  .beforeAllSubcases(t => {
    t.selectMismatchedDeviceOrSkipTestCase(undefined);
  })
  .fn(async t => {
    const { isAsync, mismatched } = t.params;

    const device = mismatched ? t.mismatchedDevice : t.device;

    const layout = device.createPipelineLayout({ bindGroupLayouts: [] });

    const format = 'rgba8unorm';
    const descriptor = {
      layout,
      vertex: {
        module: t.device.createShaderModule({
          code: `
        @vertex fn main() -> @builtin(position) vec4<f32> {
          return vec4<f32>(0.0, 0.0, 0.0, 1.0);
        }
      `,
        }),
        entryPoint: 'main',
      },
      fragment: {
        module: t.device.createShaderModule({
          code: getFragmentShaderCodeWithOutput([{ values, plainType: 'f32', componentCount: 4 }]),
        }),
        entryPoint: 'main',
        targets: [{ format }] as const,
      },
    };

    t.doCreateRenderPipelineTest(isAsync, !mismatched, descriptor);
  });

g.test('shader_module,device_mismatch')
  .desc(
    'Tests createRenderPipeline(Async) cannot be called with a shader module created from another device'
  )
  .paramsSubcasesOnly(u =>
    u.combine('isAsync', [true, false]).combineWithParams([
      { vertex_mismatched: false, fragment_mismatched: false, _success: true },
      { vertex_mismatched: true, fragment_mismatched: false, _success: false },
      { vertex_mismatched: false, fragment_mismatched: true, _success: false },
    ])
  )
  .beforeAllSubcases(t => {
    t.selectMismatchedDeviceOrSkipTestCase(undefined);
  })
  .fn(async t => {
    const { isAsync, vertex_mismatched, fragment_mismatched, _success } = t.params;

    const code = `
      @vertex fn main() -> @builtin(position) vec4<f32> {
        return vec4<f32>(0.0, 0.0, 0.0, 1.0);
      }
    `;

    const descriptor = {
      vertex: {
        module: vertex_mismatched
          ? t.mismatchedDevice.createShaderModule({ code })
          : t.device.createShaderModule({ code }),
        entryPoint: 'main',
      },
      fragment: {
        module: fragment_mismatched
          ? t.mismatchedDevice.createShaderModule({
              code: getFragmentShaderCodeWithOutput([
                { values, plainType: 'f32', componentCount: 4 },
              ]),
            })
          : t.device.createShaderModule({
              code: getFragmentShaderCodeWithOutput([
                { values, plainType: 'f32', componentCount: 4 },
              ]),
            }),
        entryPoint: 'main',
        targets: [{ format: 'rgba8unorm' }] as const,
      },
      layout: t.getPipelineLayout(),
    };

    t.doCreateRenderPipelineTest(isAsync, _success, descriptor);
  });

g.test('shader_module,invalid,vertex')
  .desc(`Tests shader module must be valid.`)
  .params(u => u.combine('isAsync', [true, false]).combine('isVertexShaderValid', [true, false]))
  .fn(async t => {
    const { isAsync, isVertexShaderValid } = t.params;
    t.doCreateRenderPipelineTest(isAsync, isVertexShaderValid, {
      layout: 'auto',
      vertex: {
        module: isVertexShaderValid
          ? t.device.createShaderModule({
              code: kDefaultVertexShaderCode,
            })
          : t.createInvalidShaderModule(),
        entryPoint: 'main',
      },
    });
  });

g.test('shader_module,invalid,fragment')
  .desc(`Tests shader module must be valid.`)
  .params(u => u.combine('isAsync', [true, false]).combine('isFragmentShaderValid', [true, false]))
  .fn(async t => {
    const { isAsync, isFragmentShaderValid } = t.params;
    t.doCreateRenderPipelineTest(isAsync, isFragmentShaderValid, {
      layout: 'auto',
      vertex: {
        module: t.device.createShaderModule({
          code: kDefaultVertexShaderCode,
        }),
        entryPoint: 'main',
      },
      fragment: {
        module: isFragmentShaderValid
          ? t.device.createShaderModule({
              code: kDefaultFragmentShadercode,
            })
          : t.createInvalidShaderModule(),
        entryPoint: 'main',
        targets: [{ format: 'rgba8unorm' }],
      },
    });
  });

const kEntryPointTestCases = [
  { shaderModuleEntryPoint: 'main', stageEntryPoint: 'main' },
  { shaderModuleEntryPoint: 'main', stageEntryPoint: '' },
  { shaderModuleEntryPoint: 'main', stageEntryPoint: 'main\0' },
  { shaderModuleEntryPoint: 'main', stageEntryPoint: 'main\0a' },
  { shaderModuleEntryPoint: 'main', stageEntryPoint: 'mian' },
  { shaderModuleEntryPoint: 'main', stageEntryPoint: 'main ' },
  { shaderModuleEntryPoint: 'main', stageEntryPoint: 'ma in' },
  { shaderModuleEntryPoint: 'main', stageEntryPoint: 'main\n' },
  { shaderModuleEntryPoint: 'mian', stageEntryPoint: 'mian' },
  { shaderModuleEntryPoint: 'mian', stageEntryPoint: 'main' },
  { shaderModuleEntryPoint: 'mainmain', stageEntryPoint: 'mainmain' },
  { shaderModuleEntryPoint: 'mainmain', stageEntryPoint: 'foo' },
  { shaderModuleEntryPoint: 'main_t12V3', stageEntryPoint: 'main_t12V3' },
  { shaderModuleEntryPoint: 'main_t12V3', stageEntryPoint: 'main_t12V5' },
  { shaderModuleEntryPoint: 'main_t12V3', stageEntryPoint: '_main_t12V3' },
  { shaderModuleEntryPoint: 'séquençage', stageEntryPoint: 'séquençage' },
  { shaderModuleEntryPoint: 'séquençage', stageEntryPoint: 'sequencage' },
];

g.test('shader_module,entry_point,vertex')
  .desc(
    `
Tests calling createRenderPipeline(Async) with valid vertex stage shader and different entryPoints,
and check that the APIs only accept matching entryPoint.

The entryPoint in shader module include standard "main" and others.
The entryPoint assigned in descriptor include:
- Matching case (control case)
- Empty string
- Mistyping
- Containing invalid char, including space and control codes (Null character)
- Unicode entrypoints and their ASCIIfied version

TODO:
- Test unicode normalization (gpuweb/gpuweb#1160)
- Fine-tune test cases to reduce number by removing trivially similiar cases
`
  )
  .params(u => u.combine('isAsync', [true, false]).combineWithParams(kEntryPointTestCases))
  .fn(async t => {
    const { isAsync, shaderModuleEntryPoint, stageEntryPoint } = t.params;
    const descriptor: GPURenderPipelineDescriptor = {
      layout: 'auto',
      vertex: {
        module: t.device.createShaderModule({
          code: getShaderWithEntryPoint('vertex', shaderModuleEntryPoint),
        }),
        entryPoint: stageEntryPoint,
      },
    };
    const _success = shaderModuleEntryPoint === stageEntryPoint;
    t.doCreateRenderPipelineTest(isAsync, _success, descriptor);
  });

g.test('shader_module,entry_point,fragment')
  .desc(
    `
Tests calling createRenderPipeline(Async) with valid fragment stage shader and different entryPoints,
and check that the APIs only accept matching entryPoint.
`
  )
  .params(u => u.combine('isAsync', [true, false]).combineWithParams(kEntryPointTestCases))
  .fn(async t => {
    const { isAsync, shaderModuleEntryPoint, stageEntryPoint } = t.params;
    const descriptor: GPURenderPipelineDescriptor = {
      layout: 'auto',
      vertex: {
        module: t.device.createShaderModule({
          code: kDefaultVertexShaderCode,
        }),
        entryPoint: 'main',
      },
      fragment: {
        module: t.device.createShaderModule({
          code: getShaderWithEntryPoint('fragment', shaderModuleEntryPoint),
        }),
        entryPoint: stageEntryPoint,
        targets: [{ format: 'rgba8unorm' }],
      },
    };
    const _success = shaderModuleEntryPoint === stageEntryPoint;
    t.doCreateRenderPipelineTest(isAsync, _success, descriptor);
  });

g.test('inter_stage').desc(``).unimplemented();
