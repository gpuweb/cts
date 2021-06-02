export const description = `
createComputePipeline and createComputePipelineAsync validation tests.

TODO:
For createComputePipeline and its async version createComputePipelineAsync,
each start with a valid descriptor, than for the only one compute stage, make
following errors:
- compute stage's module is an invalid object
- compute stage's module is of other stage, i.e., vertex or gragment
- stage's entryPoint doesn't exist, including following situation:
  - the entryPoint in module is / isn't 'main'
  - the assigned name is different from module's name
  - the assigned name is empty string
  - the assigned name contain illegal character
`;

import { params, poptions } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';

// import { kAllTextureFormats, kAllTextureFormatInfo } from '../../capability_info.js';
import { ValidationTest } from './validation_test.js';

type TShaderStage = 'compute' | 'vertex' | 'fragment' | 'empty';

class F extends ValidationTest {
  getShaderModule(
    shaderStage: TShaderStage = 'compute',
    entryPoint: string = 'main'
  ): GPUShaderModule {
    let code;
    switch (shaderStage) {
      case 'compute': {
        code = `[[stage(compute)]] fn ${entryPoint}() {}`;
        break;
      }
      case 'vertex': {
        code = `
        [[stage(vertex)]] fn ${entryPoint}() -> [[builtin(position)]] vec4<f32> {
          return vec4<f32>(0.0, 0.0, 0.0, 1.0);
        }`;
        break;
      }
      case 'fragment': {
        const fragColorType = 'i32';
        const suffix = '';
        code = `
        [[stage(fragment)]] fn ${entryPoint}() -> [[location(0)]] vec4<${fragColorType}> {
          return vec4<${fragColorType}>(0${suffix}, 1${suffix}, 0${suffix}, 1${suffix});
        }`;
        break;
      }
      case 'empty':
      default: {
        code = '';
        break;
      }
    }
    return this.device.createShaderModule({ code });
  }

  getInvalidShaderModule(): GPUShaderModule {
    this.device.pushErrorScope('validation');
    const code = 'deadbeaf'; // Something make nonsense
    const shaderModule = this.device.createShaderModule({ code });
    this.device.popErrorScope();
    return shaderModule;
  }

  doCreateComputePipelineTest(
    isAsync: boolean,
    _success: boolean,
    descriptor: GPUComputePipelineDescriptor
  ) {
    if (isAsync) {
      if (_success) {
        this.shouldResolve(this.device.createComputePipelineAsync(descriptor));
      } else {
        this.shouldReject('OperationError', this.device.createComputePipelineAsync(descriptor));
      }
    } else {
      if (_success) {
        this.device.createComputePipeline(descriptor);
      } else {
        this.expectValidationError(() => {
          this.device.createComputePipeline(descriptor);
        });
      }
    }
  }
}

export const g = makeTestGroup(F);

g.test('basic_use_of_createComputePipeline')
  .cases(poptions('isAsync', [true, false]))
  .fn(async t => {
    const { isAsync } = t.params;
    t.doCreateComputePipelineTest(isAsync, true, {
      compute: { module: t.getShaderModule('compute', 'main'), entryPoint: 'main' },
    });
  });

g.test('shader_module_must_be_valid')
  .cases(poptions('isAsync', [true, false]))
  .fn(async t => {
    const { isAsync } = t.params;
    t.doCreateComputePipelineTest(isAsync, false, {
      compute: {
        module: t.getInvalidShaderModule(),
        entryPoint: 'main',
      },
    });
  });

g.test('shader_module_stage_must_be_compute')
  .cases(
    params()
      .combine(poptions('isAsync', [true, false]))
      .combine(
        poptions('shaderModuleStage', [
          'compute' as TShaderStage,
          'vertex' as TShaderStage,
          'fragment' as TShaderStage,
        ])
      )
  )
  .fn(async t => {
    const { isAsync, shaderModuleStage } = t.params;
    const descriptor = {
      compute: {
        module: t.getShaderModule(shaderModuleStage, 'main'),
        entryPoint: 'main',
      },
    };
    t.doCreateComputePipelineTest(isAsync, shaderModuleStage === 'compute', descriptor);
  });

g.test('enrty_point_name_must_match')
  .cases(
    params()
      .combine(poptions('isAsync', [true, false]))
      .combine([
        { shaderModuleEntryPoint: 'main', stageEntryPoint: 'main' },
        { shaderModuleEntryPoint: 'main', stageEntryPoint: '' },
        { shaderModuleEntryPoint: 'main', stageEntryPoint: 'main\0' },
        { shaderModuleEntryPoint: 'main', stageEntryPoint: 'main\0a' },
        { shaderModuleEntryPoint: 'main', stageEntryPoint: 'mian' },
        { shaderModuleEntryPoint: 'main', stageEntryPoint: 'main ' },
        { shaderModuleEntryPoint: 'main', stageEntryPoint: 'main\n' },
        { shaderModuleEntryPoint: 'mian', stageEntryPoint: 'mian' },
        { shaderModuleEntryPoint: 'mian', stageEntryPoint: 'main' },
      ])
  )
  .fn(async t => {
    const { isAsync, shaderModuleEntryPoint, stageEntryPoint } = t.params;
    const descriptor = {
      compute: {
        module: t.getShaderModule('compute', shaderModuleEntryPoint),
        entryPoint: stageEntryPoint,
      },
    };
    const _success = shaderModuleEntryPoint === stageEntryPoint;
    t.doCreateComputePipelineTest(isAsync, _success, descriptor);
  });
