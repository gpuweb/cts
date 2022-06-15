export const description = `
This test dedicatedly tests validation of GPUDepthStencilState of createRenderPipeline.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { unreachable } from '../../../../common/util/util.js';
import {
  kTextureFormats,
  kTextureFormatInfo,
  kDepthStencilFormats,
  kCompareFunctions,
  kStencilOperations,
} from '../../../capability_info.js';

import { CreateRenderPipelineValidationTest } from './common.js';

export const g = makeTestGroup(CreateRenderPipelineValidationTest);

g.test('format')
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

g.test('depth_test')
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

g.test('depth_write')
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

g.test('stencil_test')
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

g.test('stencil_write')
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
