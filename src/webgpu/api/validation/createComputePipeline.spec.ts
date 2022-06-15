export const description = `
createComputePipeline and createComputePipelineAsync validation tests.
`;

import { makeTestGroup } from '../../../common/framework/test_group.js';
import { TShaderStage, getShaderWithEntryPoint } from '../../util/shader.js';

import { ValidationTest } from './validation_test.js';

class F extends ValidationTest {
  getShaderModule(
    shaderStage: TShaderStage = 'compute',
    entryPoint: string = 'main'
  ): GPUShaderModule {
    return this.device.createShaderModule({
      code: getShaderWithEntryPoint(shaderStage, entryPoint),
    });
  }
}

export const g = makeTestGroup(F);

g.test('basic_use_of_createComputePipeline')
  .desc(
    `
Control case for createComputePipeline and createComputePipelineAsync.
Call the API with valid compute shader and matching valid entryPoint, making sure that the test function working well.
`
  )
  .params(u => u.combine('isAsync', [true, false]))
  .fn(async t => {
    const { isAsync } = t.params;
    t.doCreateComputePipelineTest(isAsync, true, {
      layout: 'auto',
      compute: { module: t.getShaderModule('compute', 'main'), entryPoint: 'main' },
    });
  });

g.test('shader_module_must_be_valid')
  .desc(
    `
Tests calling createComputePipeline(Async) with a invalid compute shader, and check that the APIs catch this error.
`
  )
  .params(u => u.combine('isAsync', [true, false]))
  .fn(async t => {
    const { isAsync } = t.params;
    t.doCreateComputePipelineTest(isAsync, false, {
      layout: 'auto',
      compute: {
        module: t.createInvalidShaderModule(),
        entryPoint: 'main',
      },
    });
  });

g.test('shader_module_stage_must_be_compute')
  .desc(
    `
Tests calling createComputePipeline(Async) with valid but different stage shader and matching entryPoint,
and check that the APIs only accept compute shader.
`
  )
  .params(u =>
    u //
      .combine('isAsync', [true, false])
      .combine('shaderModuleStage', ['compute', 'vertex', 'fragment'] as TShaderStage[])
  )
  .fn(async t => {
    const { isAsync, shaderModuleStage } = t.params;
    const descriptor = {
      layout: 'auto' as const,
      compute: {
        module: t.getShaderModule(shaderModuleStage, 'main'),
        entryPoint: 'main',
      },
    };
    t.doCreateComputePipelineTest(isAsync, shaderModuleStage === 'compute', descriptor);
  });

g.test('entry_point_name_must_match')
  .desc(
    `
Tests calling createComputePipeline(Async) with valid compute stage shader and different entryPoint,
and check that the APIs only accept matching entryPoint.

The entryPoint in shader module include standard "main" and others.
The entryPoint assigned in descriptor include:
- Matching case (control case)
- Empty string
- Mistyping
- Containing invalid char, including space and control codes (Null character)
- Unicode entrypoints and their ASCIIfied version
`
  )
  .params(u =>
    u.combine('isAsync', [true, false]).combineWithParams([
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
    ])
  )
  .fn(async t => {
    const { isAsync, shaderModuleEntryPoint, stageEntryPoint } = t.params;
    const descriptor = {
      layout: 'auto' as const,
      compute: {
        module: t.getShaderModule('compute', shaderModuleEntryPoint),
        entryPoint: stageEntryPoint,
      },
    };
    const _success = shaderModuleEntryPoint === stageEntryPoint;
    t.doCreateComputePipelineTest(isAsync, _success, descriptor);
  });

g.test('pipeline_layout,device_mismatch')
  .desc(
    'Tests createComputePipeline(Async) cannot be called with a pipeline layout created from another device'
  )
  .paramsSubcasesOnly(u => u.combine('isAsync', [true, false]).combine('mismatched', [true, false]))
  .beforeAllSubcases(t => {
    t.selectMismatchedDeviceOrSkipTestCase(undefined);
  })
  .fn(async t => {
    const { isAsync, mismatched } = t.params;
    const device = mismatched ? t.mismatchedDevice : t.device;

    const layout = device.createPipelineLayout({ bindGroupLayouts: [] });

    const descriptor = {
      layout,
      compute: {
        module: t.getShaderModule('compute', 'main'),
        entryPoint: 'main',
      },
    };

    t.doCreateComputePipelineTest(isAsync, !mismatched, descriptor);
  });

g.test('shader_module,device_mismatch')
  .desc(
    'Tests createComputePipeline(Async) cannot be called with a shader module created from another device'
  )
  .paramsSubcasesOnly(u => u.combine('isAsync', [true, false]).combine('mismatched', [true, false]))
  .beforeAllSubcases(t => {
    t.selectMismatchedDeviceOrSkipTestCase(undefined);
  })
  .fn(async t => {
    const { isAsync, mismatched } = t.params;

    const device = mismatched ? t.mismatchedDevice : t.device;

    const module = device.createShaderModule({
      code: '@compute @workgroup_size(1) fn main() {}',
    });

    const descriptor = {
      layout: 'auto' as const,
      compute: {
        module,
        entryPoint: 'main',
      },
    };

    t.doCreateComputePipelineTest(isAsync, !mismatched, descriptor);
  });
