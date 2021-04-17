export const description = `
createBindGroupLayout validation tests.

TODO: update for new binding structure, remove eslint-disable.
TODO: review existing tests, write descriptions, and make sure tests are complete.
`;

import { poptions, params } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import {
  kMaxBindingsPerBindGroup,
  kShaderStages,
  kShaderStageCombinations,
  kTextureViewDimensions,
  allBindingEntries,
  bindingTypeInfo,
  bufferBindingTypeInfo,
  kBufferBindingTypes,
  BGLEntry,
} from '../../capability_info.js';

import { ValidationTest } from './validation_test.js';

function clone<T extends GPUBindGroupLayoutDescriptor>(descriptor: T): T {
  return JSON.parse(JSON.stringify(descriptor));
}

export const g = makeTestGroup(ValidationTest);

g.test('some_binding_index_was_specified_more_than_once').fn(async t => {
  const goodDescriptor = {
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, type: 'storage-buffer' as const },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, type: 'storage-buffer' as const },
    ],
  };

  // Control case
  t.device.createBindGroupLayout(goodDescriptor);

  const badDescriptor = clone(goodDescriptor);
  badDescriptor.entries[1].binding = 0;

  // Binding index 0 can't be specified twice.
  t.expectValidationError(() => {
    t.device.createBindGroupLayout(badDescriptor);
  });
});

g.test('visibility')
  .cases(poptions('visibility', kShaderStageCombinations))
  .subcases(() => poptions('entry', allBindingEntries(false)))
  .fn(async t => {
    const { visibility, entry } = t.params;
    const info = bindingTypeInfo(entry);

    const success = (visibility & ~info.validStages) === 0;

    t.expectValidationError(() => {
      t.device.createBindGroupLayout({
        entries: [{ binding: 0, visibility, ...entry }],
      });
    }, !success);
  });

g.test('multisample_requires_2d_view_dimension')
  .params(params().combine(poptions('viewDimension', [undefined, ...kTextureViewDimensions])))
  .fn(async t => {
    const { viewDimension } = t.params;

    const success = viewDimension === '2d' || viewDimension === undefined;

    t.expectValidationError(() => {
      t.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            texture: { multisampled: true, viewDimension },
          },
        ],
      });
    }, !success);
  });

g.test('number_of_dynamic_buffers_exceeds_the_maximum_value')
  .desc(
    `TODO: describe

TODO(#230): Update to enforce per-stage and per-pipeline-layout limits on BGLs as well.`
  )
  .cases(poptions('type', kBufferBindingTypes))
  .fn(async t => {
    const { type } = t.params;
    const info = bufferBindingTypeInfo({ type });

    const maxDynamicBufferCount = info.perPipelineLimitClass.maxDynamic;

    const maxDynamicBufferBindings = [];
    for (let i = 0; i < maxDynamicBufferCount; i++) {
      maxDynamicBufferBindings.push({
        binding: i,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type, hasDynamicOffset: true },
      });
    }

    const goodDescriptor = {
      entries: [
        ...maxDynamicBufferBindings,
        {
          binding: maxDynamicBufferBindings.length,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type, hasDynamicOffset: false },
        },
      ],
    };

    // Control case
    t.device.createBindGroupLayout(goodDescriptor);

    // Dynamic buffers exceed maximum in a bind group layout.
    const badDescriptor = clone(goodDescriptor);
    badDescriptor.entries[maxDynamicBufferCount].buffer.hasDynamicOffset = true;

    t.expectValidationError(() => {
      t.device.createBindGroupLayout(badDescriptor);
    });
  });

/**
 * One bind group layout will be filled with kPerStageBindingLimit[...] of the type |type|.
 * For each item in the array returned here, a case will be generated which tests a pipeline
 * layout with one extra bind group layout with one extra binding. That extra binding will have:
 *
 *   - If extraTypeSame, any of the binding types which counts toward the same limit as |type|.
 *     (i.e. 'storage-buffer' <-> 'readonly-storage-buffer').
 *   - Otherwise, an arbitrary other type.
 */
function* pickExtraBindingTypesForPerStage(
  entry: BGLEntry,
  extraTypeSame: boolean
): IterableIterator<BGLEntry> {
  if (extraTypeSame) {
    const info = bindingTypeInfo(entry);
    for (const extra of allBindingEntries(false)) {
      const extraInfo = bindingTypeInfo(extra);
      if (info.perStageLimitClass.class === extraInfo.perStageLimitClass.class) {
        yield extra;
      }
    }
  } else {
    return entry.sampler ? { texture: {} } : { sampler: {} };
  }
}

const kCasesForMaxResourcesPerStageTests = params()
  .combine(poptions('maxedEntry', allBindingEntries(false)))
  .combine(poptions('maxedVisibility', kShaderStages))
  .filter(p => (bindingTypeInfo(p.maxedEntry).validStages & p.maxedVisibility) !== 0)
  .expand(function* (p) {
    yield* poptions('extraEntry', pickExtraBindingTypesForPerStage(p.maxedEntry, true));
    yield* poptions('extraEntry', pickExtraBindingTypesForPerStage(p.maxedEntry, false));
  })
  .combine(poptions('extraVisibility', kShaderStages))
  .filter(p => (bindingTypeInfo(p.extraEntry).validStages & p.extraVisibility) !== 0);

// Should never fail unless kMaxBindingsPerBindGroup is exceeded, because the validation for
// resources-of-type-per-stage is in pipeline layout creation.
g.test('max_resources_per_stage,in_bind_group_layout')
  .desc(
    `TODO: describe

TODO(#230): Update to enforce per-stage and per-pipeline-layout limits on BGLs as well.`
  )
  .params(kCasesForMaxResourcesPerStageTests)
  .fn(async t => {
    const { maxedEntry, extraEntry, maxedVisibility, extraVisibility } = t.params;
    const maxedTypeInfo = bindingTypeInfo(maxedEntry);
    const maxedCount = maxedTypeInfo.perStageLimitClass.max;

    const maxResourceBindings: GPUBindGroupLayoutEntry[] = [];
    for (let i = 0; i < maxedCount; i++) {
      maxResourceBindings.push({
        binding: i,
        visibility: maxedVisibility,
        ...maxedEntry,
      });
    }

    const goodDescriptor = { entries: maxResourceBindings };

    // Control
    t.device.createBindGroupLayout(goodDescriptor);

    const newDescriptor = clone(goodDescriptor);
    newDescriptor.entries.push({
      binding: maxedCount,
      visibility: extraVisibility,
      ...extraEntry,
    });

    const shouldError = maxedCount >= kMaxBindingsPerBindGroup;

    t.expectValidationError(() => {
      t.device.createBindGroupLayout(newDescriptor);
    }, shouldError);
  });

// One pipeline layout can have a maximum number of each type of binding *per stage* (which is
// different for each type). Test that the max works, then add one more binding of same-or-different
// type and same-or-different visibility.
g.test('max_resources_per_stage,in_pipeline_layout')
  .params(kCasesForMaxResourcesPerStageTests)
  .fn(async t => {
    const { maxedEntry, extraEntry, maxedVisibility, extraVisibility } = t.params;
    const maxedTypeInfo = bindingTypeInfo(maxedEntry);
    const maxedCount = maxedTypeInfo.perStageLimitClass.max;
    const extraTypeInfo = bindingTypeInfo(extraEntry);

    const maxResourceBindings: GPUBindGroupLayoutEntry[] = [];
    for (let i = 0; i < maxedCount; i++) {
      maxResourceBindings.push({
        binding: i,
        visibility: maxedVisibility,
        ...maxedEntry,
      });
    }

    const goodLayout = t.device.createBindGroupLayout({ entries: maxResourceBindings });

    // Control
    t.device.createPipelineLayout({ bindGroupLayouts: [goodLayout] });

    const extraLayout = t.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: extraVisibility,
          ...extraEntry,
        },
      ],
    });

    // Some binding types use the same limit, e.g. 'storage-buffer' and 'readonly-storage-buffer'.
    const newBindingCountsTowardSamePerStageLimit =
      (maxedVisibility & extraVisibility) !== 0 &&
      maxedTypeInfo.perStageLimitClass.class === extraTypeInfo.perStageLimitClass.class;
    const layoutExceedsPerStageLimit = newBindingCountsTowardSamePerStageLimit;

    t.expectValidationError(() => {
      t.device.createPipelineLayout({ bindGroupLayouts: [goodLayout, extraLayout] });
    }, layoutExceedsPerStageLimit);
  });
