/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
createPipelineLayout validation tests.

TODO: review existing tests, write descriptions, and make sure tests are complete.
`;import { makeTestGroup } from '../../../common/framework/test_group.js';
import { count } from '../../../common/util/util.js';
import { bufferBindingTypeInfo, kBufferBindingTypes } from '../../capability_info.js';
import { GPUConst } from '../../constants.js';

import { ValidationTest } from './validation_test.js';

function clone(descriptor) {
  return JSON.parse(JSON.stringify(descriptor));
}

export const g = makeTestGroup(ValidationTest);

g.test('number_of_dynamic_buffers_exceeds_the_maximum_value').
desc(
  `
    Test that creating a pipeline layout fails with a validation error if the number of dynamic
    buffers exceeds the maximum value in the pipeline layout.
    - Test that creation of a pipeline using the maximum number of dynamic buffers added a dynamic
      buffer fails.

    TODO(#230): Update to enforce per-stage and per-pipeline-layout limits on BGLs as well.
  `
).
paramsSubcasesOnly((u) =>
u //
.combine('visibility', [0, 2, 4, 6]).
combine('type', kBufferBindingTypes)
).
fn((t) => {
  const { type, visibility } = t.params;
  const info = bufferBindingTypeInfo({ type });
  const { maxDynamicLimit } = info.perPipelineLimitClass;
  const perStageLimit = t.getDefaultLimit(info.perStageLimitClass.maxLimit);
  const maxDynamic = Math.min(
    maxDynamicLimit ? t.getDefaultLimit(maxDynamicLimit) : 0,
    perStageLimit
  );

  const maxDynamicBufferBindings = [];
  for (let binding = 0; binding < maxDynamic; binding++) {
    maxDynamicBufferBindings.push({
      binding,
      visibility,
      buffer: { type, hasDynamicOffset: true }
    });
  }

  const maxDynamicBufferBindGroupLayout = t.device.createBindGroupLayout({
    entries: maxDynamicBufferBindings
  });

  const goodDescriptor = {
    entries: [{ binding: 0, visibility, buffer: { type, hasDynamicOffset: false } }]
  };

  if (perStageLimit > maxDynamic) {
    const goodPipelineLayoutDescriptor = {
      bindGroupLayouts: [
      maxDynamicBufferBindGroupLayout,
      t.device.createBindGroupLayout(goodDescriptor)]

    };

    // Control case
    t.device.createPipelineLayout(goodPipelineLayoutDescriptor);
  }

  // Check dynamic buffers exceed maximum in pipeline layout.
  const badDescriptor = clone(goodDescriptor);
  badDescriptor.entries[0].buffer.hasDynamicOffset = true;

  const badPipelineLayoutDescriptor = {
    bindGroupLayouts: [
    maxDynamicBufferBindGroupLayout,
    t.device.createBindGroupLayout(badDescriptor)]

  };

  t.expectValidationError(() => {
    t.device.createPipelineLayout(badPipelineLayoutDescriptor);
  });
});

g.test('number_of_bind_group_layouts_exceeds_the_maximum_value').
desc(
  `
    Test that creating a pipeline layout fails with a validation error if the number of bind group
    layouts exceeds the maximum value in the pipeline layout.
    - Test that creation of a pipeline using the maximum number of bind groups added a bind group
      fails.
  `
).
fn((t) => {
  const bindGroupLayoutDescriptor = {
    entries: []
  };

  // 4 is the maximum number of bind group layouts.
  const maxBindGroupLayouts = [1, 2, 3, 4].map(() =>
  t.device.createBindGroupLayout(bindGroupLayoutDescriptor)
  );

  const goodPipelineLayoutDescriptor = {
    bindGroupLayouts: maxBindGroupLayouts
  };

  // Control case
  t.device.createPipelineLayout(goodPipelineLayoutDescriptor);

  // Check bind group layouts exceed maximum in pipeline layout.
  const badPipelineLayoutDescriptor = {
    bindGroupLayouts: [
    ...maxBindGroupLayouts,
    t.device.createBindGroupLayout(bindGroupLayoutDescriptor)]

  };

  t.expectValidationError(() => {
    t.device.createPipelineLayout(badPipelineLayoutDescriptor);
  });
});

g.test('bind_group_layouts,device_mismatch').
desc(
  `
    Tests createPipelineLayout cannot be called with bind group layouts created from another device
    Test with two layouts to make sure all layouts can be validated:
    - layout0 and layout1 from same device
    - layout0 and layout1 from different device
    `
).
paramsSubcasesOnly([
{ layout0Mismatched: false, layout1Mismatched: false }, // control case
{ layout0Mismatched: true, layout1Mismatched: false },
{ layout0Mismatched: false, layout1Mismatched: true }]
).
beforeAllSubcases((t) => {
  t.selectMismatchedDeviceOrSkipTestCase(undefined);
}).
fn((t) => {
  const { layout0Mismatched, layout1Mismatched } = t.params;

  const mismatched = layout0Mismatched || layout1Mismatched;

  const bglDescriptor = {
    entries: []
  };

  const layout0 = layout0Mismatched ?
  t.mismatchedDevice.createBindGroupLayout(bglDescriptor) :
  t.device.createBindGroupLayout(bglDescriptor);
  const layout1 = layout1Mismatched ?
  t.mismatchedDevice.createBindGroupLayout(bglDescriptor) :
  t.device.createBindGroupLayout(bglDescriptor);

  t.expectValidationError(() => {
    t.device.createPipelineLayout({ bindGroupLayouts: [layout0, layout1] });
  }, mismatched);
});

const MaybeNullBindGroupLayoutTypes = ['Null', 'Undefined', 'Empty', 'NonEmpty'];

g.test('bind_group_layouts,null_bind_group_layouts').
desc(
  `
    Tests that it is valid to create a pipeline layout with null bind group layouts.
    `
).
paramsSubcasesOnly((u) =>
u //
.combine('_bglCount', [1, 2, 3, 4]).
combine('_bgl0', MaybeNullBindGroupLayoutTypes).
expand('_bgl1', (p) => p._bglCount > 1 ? MaybeNullBindGroupLayoutTypes : ['Null']).
expand('_bgl2', (p) => p._bglCount > 2 ? MaybeNullBindGroupLayoutTypes : ['Null']).
expand('_bgl3', (p) => p._bglCount > 3 ? MaybeNullBindGroupLayoutTypes : ['Null'])
// Flatten the result down into a single subcase arg which is an array of BGL types.
.expand('bindGroupLayouts', (p) => [[p._bgl0, p._bgl1, p._bgl2, p._bgl3].slice(0, p._bglCount)])
// Only test combinations where exactly one of the BGLs is null|undefined|empty.
.filter((p) => count(p.bindGroupLayouts, (x) => x !== 'NonEmpty') === 1)
).
fn((t) => {
  const nonEmptyBindGroupLayout = t.device.createBindGroupLayout({
    entries: [
    {
      binding: 0,
      visibility: GPUConst.ShaderStage.COMPUTE,
      texture: {}
    }]

  });

  const bindGroupLayouts = t.params.bindGroupLayouts.map((bindGroupLayoutType) => {
    switch (bindGroupLayoutType) {
      case 'Null':
        return null;
      case 'Undefined':
        return undefined;
      case 'Empty':
        return t.device.createBindGroupLayout({ entries: [] });
      case 'NonEmpty':
        return nonEmptyBindGroupLayout;
    }
  });

  const kShouldError = false;
  t.expectValidationError(() => {
    t.device.createPipelineLayout({ bindGroupLayouts });
  }, kShouldError);
});

g.test('bind_group_layouts,create_pipeline_with_null_bind_group_layouts').
desc(
  `
  Tests that it is valid to create a render pipeline or compute pipeline with a pipeline layout
  created with null bind group layouts as long as the pipeline layout matches the declarations in
  the shaders.
  `
).
params((u) =>
u.
combine('pipelineType', ['Render', 'Compute']).
combine('emptyBindGroupLayoutType', ['Null', 'Undefined']).
combine('emptyBindGroupLayoutIndex', [0, 1, 2, 3]).
combine('emptyBindGroupLayoutIndexMissedInShader', [true, false])
).
fn((t) => {
  const {
    pipelineType,
    emptyBindGroupLayoutType,
    emptyBindGroupLayoutIndex,
    emptyBindGroupLayoutIndexMissedInShader
  } = t.params;

  const bindGroupLayouts = [];
  for (let i = 0; i < 4; ++i) {
    if (i === emptyBindGroupLayoutIndex) {
      switch (emptyBindGroupLayoutType) {
        case 'Null':
          bindGroupLayouts.push(null);
          break;
        case 'Undefined':
          bindGroupLayouts.push(undefined);
          break;
      }
    } else {
      const nonEmptyBindGroupLayout = t.device.createBindGroupLayout({
        entries: [
        {
          binding: 0,
          visibility: GPUConst.ShaderStage.COMPUTE | GPUConst.ShaderStage.FRAGMENT,
          buffer: {
            type: 'uniform'
          }
        }]

      });
      bindGroupLayouts.push(nonEmptyBindGroupLayout);
    }
  }
  const layout = t.device.createPipelineLayout({ bindGroupLayouts });

  let declarations = '';
  let statement = '_ = 1';
  for (let i = 0; i < 4; ++i) {
    if (emptyBindGroupLayoutIndexMissedInShader && i === emptyBindGroupLayoutIndex) {
      continue;
    }
    declarations += `@group(${i}) @binding(0) var<uniform> input${i} : u32;\n`;
    statement += ` + input${i}`;
  }

  const shouldError = !emptyBindGroupLayoutIndexMissedInShader;

  switch (pipelineType) {
    case 'Render':{
        const code = `
        ${declarations}
        @vertex
        fn vert_main() -> @builtin(position) vec4f {
            return vec4f(0.0, 0.0, 0.0, 1.0);
        }

        @fragment
        fn frag_main() -> @location(0) vec4f {
            ${statement};
            return vec4f(0.0, 0.0, 0.0, 1.0);
        }
        `;
        const shaderModule = t.device.createShaderModule({
          code
        });

        t.expectValidationError(() => {
          t.device.createRenderPipeline({
            layout,
            vertex: {
              module: shaderModule
            },
            fragment: {
              module: shaderModule,
              targets: [
              {
                format: 'rgba8unorm'
              }]

            }
          });
        }, shouldError);
        break;
      }

    case 'Compute':{
        const code = `
        ${declarations}
        @compute @workgroup_size(1) fn cs_main() {
          ${statement};
        }
        `;
        const shaderModule = t.device.createShaderModule({
          code
        });
        t.expectValidationError(() => {
          t.device.createComputePipeline({
            layout,
            compute: {
              module: shaderModule
            }
          });
        }, shouldError);
        break;
      }
  }
});