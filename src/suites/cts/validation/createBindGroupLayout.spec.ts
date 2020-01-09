export const description = `
createBindGroupLayout validation tests.
`;

import { C, TestGroup, poptions } from '../../../framework/index.js';
import { ParamSpec } from '../../../framework/params/index.js';
import { bindingTypeInfo, bindingTypes, shaderStages } from '../format_info.js';

import { ValidationTest } from './validation_test.js';

// TODO: Move this somewhere central?
const kMaxBindingsPerBindGroup = 16;

function clone<T extends GPUBindGroupLayoutDescriptor>(descriptor: T): T {
  return JSON.parse(JSON.stringify(descriptor));
}

export const g = new TestGroup(ValidationTest);

g.test('some binding index was specified more than once', async t => {
  const goodDescriptor = {
    bindings: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, type: C.BindingType.StorageBuffer },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, type: C.BindingType.StorageBuffer },
    ],
  };

  // Control case
  t.device.createBindGroupLayout(goodDescriptor);

  const badDescriptor = clone(goodDescriptor);
  badDescriptor.bindings[1].binding = 0;

  // Binding index 0 can't be specified twice.
  t.expectValidationError(() => {
    t.device.createBindGroupLayout(badDescriptor);
  });
});

g.test('negative binding index', async t => {
  const goodDescriptor = {
    bindings: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, type: C.BindingType.StorageBuffer },
    ],
  };

  // Control case
  t.device.createBindGroupLayout(goodDescriptor);

  // Negative binding index can't be specified.
  const badDescriptor = clone(goodDescriptor);
  badDescriptor.bindings[0].binding = -1;

  t.expectValidationError(() => {
    t.device.createBindGroupLayout(badDescriptor);
  });
});

g.test('Visibility of bindings can be 0', async t => {
  t.device.createBindGroupLayout({
    bindings: [{ binding: 0, visibility: 0, type: 'storage-buffer' }],
  });
});

g.test('number of dynamic buffers exceeds the maximum value', async t => {
  const { type, maxDynamicBufferCount } = t.params;

  const maxDynamicBufferBindings: GPUBindGroupLayoutBinding[] = [];
  for (let i = 0; i < maxDynamicBufferCount; i++) {
    maxDynamicBufferBindings.push({
      binding: i,
      visibility: GPUShaderStage.COMPUTE,
      type,
      hasDynamicOffset: true,
    });
  }

  const goodDescriptor = {
    bindings: [
      ...maxDynamicBufferBindings,
      {
        binding: maxDynamicBufferBindings.length,
        visibility: GPUShaderStage.COMPUTE,
        type,
        hasDynamicOffset: false,
      },
    ],
  };

  // Control case
  t.device.createBindGroupLayout(goodDescriptor);

  // Dynamic buffers exceed maximum in a bind group layout.
  const badDescriptor = clone(goodDescriptor);
  badDescriptor.bindings[maxDynamicBufferCount].hasDynamicOffset = true;

  t.expectValidationError(() => {
    t.device.createBindGroupLayout(badDescriptor);
  });
}).params([
  { type: C.BindingType.StorageBuffer, maxDynamicBufferCount: 4 },
  { type: C.BindingType.UniformBuffer, maxDynamicBufferCount: 8 },
]);

g.test('dynamic set to true is allowed only for buffers', async t => {
  const type: GPUBindingType = t.params.type;
  const success = bindingTypeInfo[type].type === 'buffer';

  const descriptor = {
    bindings: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, type, hasDynamicOffset: true }],
  };

  t.expectValidationError(() => {
    t.device.createBindGroupLayout(descriptor);
  }, !success);
}).params(poptions('type', bindingTypes));

{
  function pickExtraBindingTypes(type: GPUBindingType, extraTypeSame: boolean): GPUBindingType[] {
    if (extraTypeSame) {
      switch (type) {
        case 'storage-buffer':
        case 'readonly-storage-buffer':
          return ['storage-buffer', 'readonly-storage-buffer'];
        default:
          return [type];
      }
    } else {
      return type === 'sampler' ? ['sampled-texture'] : ['sampler'];
    }
  }

  const kCasesForMaxResourcesPerStageTests: ParamSpec[] = [];
  for (const maxedType of bindingTypes) {
    for (const maxedVisibility of shaderStages) {
      const maxedVisibilityVertex = (maxedVisibility & C.ShaderStage.Vertex) !== 0;
      if (bindingTypeInfo[maxedType].isStorageBuffer && maxedVisibilityVertex) continue;

      for (const extraTypeSame of [false, true]) {
        for (const extraType of pickExtraBindingTypes(maxedType, extraTypeSame)) {
          for (const extraVisibility of shaderStages) {
            const extraVisibilityVertex = (extraVisibility & C.ShaderStage.Vertex) !== 0;
            if (bindingTypeInfo[extraType].isStorageBuffer && extraVisibilityVertex) continue;

            kCasesForMaxResourcesPerStageTests.push({
              maxedType,
              maxedVisibility,
              extraType,
              extraVisibility,
            });
          }
        }
      }
    }
  }

  // Should never fail unless kMaxBindingsPerBindGroup is exceeded, because the validation for
  // resources-of-type-per-stage is in pipeline layout creation.
  g.test('max resources per stage/in bind group layout', async t => {
    const maxedType: GPUBindingType = t.params.maxedType;
    const extraType: GPUBindingType = t.params.extraType;
    const { maxedVisibility, extraVisibility } = t.params;
    const maxedCount = bindingTypeInfo[maxedType].maxPerShaderStage;

    const maxResourceBindings: GPUBindGroupLayoutBinding[] = [];
    for (let i = 0; i < maxedCount; i++) {
      maxResourceBindings.push({
        binding: i,
        visibility: maxedVisibility,
        type: maxedType,
      });
    }

    const goodDescriptor = { bindings: maxResourceBindings };

    // Control
    t.device.createBindGroupLayout(goodDescriptor);

    const newDescriptor = clone(goodDescriptor);
    newDescriptor.bindings.push({
      binding: maxedCount,
      visibility: extraVisibility,
      type: extraType,
    });

    const shouldError = maxedCount >= kMaxBindingsPerBindGroup;

    t.expectValidationError(() => {
      t.device.createBindGroupLayout(newDescriptor);
    }, shouldError);
  }).params(kCasesForMaxResourcesPerStageTests);

  // One pipeline layout can have a maximum number of each type of binding *per stage* (which is
  // different for each type). Test that the max works, then add one more binding of same-or-different
  // type and same-or-different visibility.
  g.test('max resources per stage/in pipeline layout', async t => {
    const maxedType: GPUBindingType = t.params.maxedType;
    const extraType: GPUBindingType = t.params.extraType;
    const { maxedVisibility, extraVisibility } = t.params;
    const maxedCount = bindingTypeInfo[maxedType].maxPerShaderStage;

    const maxResourceBindings: GPUBindGroupLayoutBinding[] = [];
    for (let i = 0; i < maxedCount; i++) {
      maxResourceBindings.push({
        binding: i,
        visibility: maxedVisibility,
        type: maxedType,
      });
    }

    const goodLayout = t.device.createBindGroupLayout({ bindings: maxResourceBindings });

    // Control
    t.device.createPipelineLayout({ bindGroupLayouts: [goodLayout] });

    const extraLayout = t.device.createBindGroupLayout({
      bindings: [{ binding: 0, visibility: extraVisibility, type: extraType }],
    });

    const hasCollision =
      (maxedVisibility & extraVisibility) !== 0 &&
      bindingTypeInfo[maxedType].isStorageBuffer === bindingTypeInfo[extraType].isStorageBuffer;
    t.expectValidationError(() => {
      t.device.createPipelineLayout({ bindGroupLayouts: [goodLayout, extraLayout] });
    }, hasCollision);
  }).params(kCasesForMaxResourcesPerStageTests);
}
