export const description = `
This test dedicatedly tests createRenderPipeline validation issues related to the shader modules.

Note: entry point matching tests are in ../shader_module/entry_point.spec.ts
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import {
  getFragmentShaderCodeWithOutput,
  getShaderWithEntryPoint,
  kDefaultVertexShaderCode,
  kDefaultFragmentShaderCode,
} from '../../../util/shader.js';

import { CreateRenderPipelineValidationTest } from './common.js';

export const g = makeTestGroup(CreateRenderPipelineValidationTest);

const values = [0, 1, 0, 1];

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
              code: kDefaultFragmentShaderCode,
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
