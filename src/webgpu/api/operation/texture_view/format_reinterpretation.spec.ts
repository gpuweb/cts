export const description = `
Test texture views can reinterpret the format of the original texture.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import {
  kRenderableColorTextureFormats,
  kRegularTextureFormats,
} from '../../../capability_info.js';
import { GPUTest } from '../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

function supportsReinterpretation(a: GPUTextureFormat, b: GPUTextureFormat) {
  return a + '-srgb' === b || b + '-srgb' === a;
}

g.test('texture_binding')
  .desc(`Test that a regular texture allocated as 'format' may be sampled as 'viewFormat'.`)
  .params(u =>
    u //
      .combine('format', kRegularTextureFormats)
      .combine('viewFormat', kRegularTextureFormats)
      .filter(({ format, viewFormat }) => supportsReinterpretation(format, viewFormat))
  )
  .unimplemented();

g.test('render_attachment')
  .desc(
    `Test that a renderable color texture allocated as 'format' may be rendered to as 'viewFormat'.`
  )
  .params(u =>
    u //
      .combine('format', kRenderableColorTextureFormats)
      .combine('viewFormat', kRenderableColorTextureFormats)
      .filter(({ format, viewFormat }) => supportsReinterpretation(format, viewFormat))
  )
  .unimplemented();

g.test('resolve_attachment')
  .desc(
    `
Test that a color render attachment allocated as 'renderFormat' may be rendered to as 'renderViewFormat',
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
      .combine('resolveFormat', kRenderableColorTextureFormats)
      .combine('resolveViewFormat', kRenderableColorTextureFormats)
      .filter(
        ({ renderFormat, renderViewFormat, resolveFormat, resolveViewFormat }) =>
          renderViewFormat === resolveViewFormat && // Required by validation to match.
          // At least one of the views should be reinterpreted.
          (renderFormat !== renderViewFormat || resolveFormat !== resolveViewFormat) &&
          // Allow formats to be the same since reinterpretation may occur for the render format.
          (resolveFormat === resolveViewFormat ||
            supportsReinterpretation(resolveFormat, resolveViewFormat))
      )
  )
  .unimplemented();
