export const description = `
TODO: interface matching between vertex and fragment shader validation for createRenderPipeline:
    - superset, subset, etc.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { assert, range } from '../../../../common/util/util.js';

import { CreateRenderPipelineValidationTest } from './common.js';

// const kScalarTypes = ['i32', 'u32', 'f32'];
// const kInterpolationTypes = ['perspective', 'linear', 'flat'];
// const kInterpolationSamplings = ['center', 'centroid', 'sample'];

// type InterStageVariable = {
//   location: number,
//   type: 'i32' | 'u32' | 'f32',
//   scalarCount: number,
//   interpolationType: 'perspective' | 'linear' | 'flat',
//   interpolationSampling: 'center' | 'centroid' | 'sample',
// };

class InterStageMatchingValidationTest extends CreateRenderPipelineValidationTest {
  // getVertexStateWithOutputs(outputs: InterStageVariable[]): GPUVertexState {
  getVertexStateWithOutputs(outputs: string[]): GPUVertexState {
    console.log(`
    struct A {
        ${outputs.join(',\n')},
        @builtin(position) pos: vec4<f32>,
    }
    @vertex fn main() -> A {
        var vertexOut: A;
        vertexOut.pos = vec4<f32>(0.0, 0.0, 0.0, 1.0);
        return vertexOut;
    }
    `);
    return {
      module: this.device.createShaderModule({
        code: `
        struct A {
            ${outputs.join(',\n')},
            @builtin(position) pos: vec4<f32>,
        }
        @vertex fn main() -> A {
            var vertexOut: A;
            vertexOut.pos = vec4<f32>(0.0, 0.0, 0.0, 1.0);
            return vertexOut;
        }
        `,
      }),
      entryPoint: 'main',
    };
  }

  getFragmentStateWithInputs(inputs: string[]): GPUFragmentState {
    return {
      targets: [{ format: 'rgba8unorm' }],
      module: this.device.createShaderModule({
        code: `
        struct B {
            ${inputs.join(',\n')},
        }
        @fragment fn main(fragmentIn: B) -> @location(0) vec4<f32> {
            return vec4<f32>(1.0, 1.0, 1.0, 1.0);
        }
        `,
      }),
      entryPoint: 'main',
    };
  }

  getDescriptorWithStates(vertex: GPUVertexState, fragment: GPUFragmentState): GPURenderPipelineDescriptor {
    return {
      layout: 'auto',
      vertex,
      fragment,
    };
  }
}

export const g = makeTestGroup(InterStageMatchingValidationTest);

g.test('location,match')
  .desc(`Control case: creating render pipeline with input and output location match should succeed.`)
  .params(u => u.combine('isAsync', [false, true]))
  .fn(async t => {
    const { isAsync } = t.params;

    const descriptor = t.getDescriptorWithStates(
      t.getVertexStateWithOutputs(['@location(0) vout0: f32']),
      t.getFragmentStateWithInputs(['@location(0) fin0: f32']),
    );

    t.doCreateRenderPipelineTest(isAsync, true, descriptor);
  });

g.test('location,mismatch')
  .desc(`Tests that missing declaration at the same location should fail validation.`)
  .params(u => u.combine('isAsync', [false, true]))
  .fn(async t => {
    const { isAsync } = t.params;

    const descriptor = t.getDescriptorWithStates(
      t.getVertexStateWithOutputs(['@location(0) vout0: f32']),
      t.getFragmentStateWithInputs(['@location(1) fin1: f32']),
    );

    t.doCreateRenderPipelineTest(isAsync, false, descriptor);
  });

g.test('location,superset')
  .desc(`Tests that validation should fail when vertex output is a superset of fragment input.`)
  .params(u => u.combine('isAsync', [false, true]))
  .fn(async t => {
    const { isAsync } = t.params;

    const descriptor = t.getDescriptorWithStates(
      t.getVertexStateWithOutputs([
        '@location(0) vout0: f32',
        '@location(1) vout1: f32',
      ]),
      t.getFragmentStateWithInputs([
        '@location(1) fin1: f32',
      ]),
    );

    t.doCreateRenderPipelineTest(isAsync, false, descriptor);
  });

g.test('location,subset')
  .desc(`Tests that validation should fail when vertex output is a subset of fragment input.`)
  .params(u => u.combine('isAsync', [false, true]))
  .fn(async t => {
    const { isAsync } = t.params;

    const descriptor = t.getDescriptorWithStates(
      t.getVertexStateWithOutputs([
        '@location(0) vout0: f32',
      ]),
      t.getFragmentStateWithInputs([
        '@location(0) fin0: f32',
        '@location(1) fin1: f32',
      ]),
    );

    t.doCreateRenderPipelineTest(isAsync, false, descriptor);
  });

g.test('type')
  .desc(`Tests that validation should fail when type of vertex output and fragment input at the same location doesn't match.`)
  .params(u => 
    u.combine('isAsync', [false, true])
    .combineWithParams([
      { output: 'f32', input: 'f32' },
      { output: 'i32', input: 'f32' },
      { output: 'u32', input: 'f32' },
      { output: 'u32', input: 'i32' },
      { output: 'i32', input: 'u32' },
      { output: 'vec2<f32>', input: 'vec2<f32>' },
      { output: 'vec3<f32>', input: 'vec2<f32>' },
      { output: 'vec2<f32>', input: 'vec3<f32>' },
      { output: 'vec2<f32>', input: 'f32' },
      { output: 'f32', input: 'vec2<f32>' },
    ])
  )
  .fn(async t => {
    const { isAsync, output, input } = t.params;

    const descriptor = t.getDescriptorWithStates(
      t.getVertexStateWithOutputs([
        `@location(0) @interpolate(flat) vout0: ${output}`,
      ]),
      t.getFragmentStateWithInputs([
        `@location(0) @interpolate(flat) fin0: ${input}`,
      ]),
    );

    t.doCreateRenderPipelineTest(isAsync, output === input, descriptor);
  });

g.test('interpolation_type')
  .desc(`Tests that validation should fail when interpolation type of vertex output and fragment input at the same location doesn't match.`)
  .params(u => 
    u.combine('isAsync', [false, true])
    .combineWithParams([
      // default is @interpolate(perspective, center)
      { output: '', input: '' },
      { output: '', input: '@interpolate(perspective) ', _success: true },
      { output: '', input: '@interpolate(perspective, center) ', _success: true },
      { output: '@interpolate(perspective) ', input: '', _success: true },
      { output: '', input: '@interpolate(linear) ' },
      { output: '@interpolate(perspective) ', input: '@interpolate(perspective) ' },
      { output: '@interpolate(linear) ', input: '@interpolate(perspective) ' },
      { output: '@interpolate(flat) ', input: '@interpolate(perspective) ' },
      { output: '@interpolate(linear) ', input: '@interpolate(flat) ' },
      { output: '@interpolate(linear, center) ', input: '@interpolate(linear, center) ' },
    ])
  )
  .fn(async t => {
    const { isAsync, output, input, _success } = t.params;

    const descriptor = t.getDescriptorWithStates(
      t.getVertexStateWithOutputs([
        `@location(0) ${output}vout0: f32`,
      ]),
      t.getFragmentStateWithInputs([
        `@location(0) ${input}fin0: f32`,
      ]),
    );

    t.doCreateRenderPipelineTest(isAsync, _success ?? output === input, descriptor);
  });

g.test('interpolation_sampling')
  .desc(`Tests that validation should fail when interpolation sampling of vertex output and fragment input at the same location doesn't match.`)
  .params(u => 
    u.combine('isAsync', [false, true])
    .combineWithParams([
      // default is @interpolate(perspective, center)
      { output: '@interpolate(perspective) ', input: '@interpolate(perspective) ' },
      { output: '@interpolate(perspective) ', input: '@interpolate(perspective, center) ', _success: true },
      { output: '@interpolate(linear, center) ', input: '@interpolate(linear) ', _success: true },
      { output: '@interpolate(flat) ', input: '@interpolate(flat) ' },
      { output: '@interpolate(perspective) ', input: '@interpolate(perspective, sample) ' },
      { output: '@interpolate(perspective, center) ', input: '@interpolate(perspective, sample) ' },
      { output: '@interpolate(perspective, center) ', input: '@interpolate(perspective, centroid) ' },
      { output: '@interpolate(perspective, centroid) ', input: '@interpolate(perspective) ' },
    ])
  )
  .fn(async t => {
    const { isAsync, output, input, _success } = t.params;

    const descriptor = t.getDescriptorWithStates(
      t.getVertexStateWithOutputs([
        `@location(0) ${output}vout0: f32`,
      ]),
      t.getFragmentStateWithInputs([
        `@location(0) ${input}fin0: f32`,
      ]),
    );

    t.doCreateRenderPipelineTest(isAsync, _success ?? output === input, descriptor);
  });

// g.test('max_shader_variables,output')

g.test('max_components_count,output')
  .desc(`Tests that validation should fail when scalar components of all user-defined outputs > max vertex shader output components.`)
  .params(u => 
    u.combine('isAsync', [false, true])
    .combineWithParams([
      // count of output scalar components in test shader = device.limits.maxInterStageShaderComponents + countDelta
      { countDelta: 0, topology: 'triangle-list', _success: true },
      { countDelta: 1, topology: 'triangle-list', _success: false },
      { countDelta: 0, topology: 'point-list', _success: false },
      { countDelta: -1, topology: 'point-list', _success: true },
    ] as const)
  )
  .fn(async t => {
    const { isAsync, countDelta, topology, _success } = t.params;

    const scalarComponentsCount = t.device.limits.maxInterStageShaderComponents + countDelta;

    const numVec4 = Math.floor(scalarComponentsCount / 4);
    const numScalar = scalarComponentsCount % 4;
    const numVariables = numVec4 + numScalar;
    // assert(numVariables <= t.device.limits.maxInterStageShaderVariables);

    const descriptor = t.getDescriptorWithStates(
      t.getVertexStateWithOutputs(
        range(numVec4, (i) => `@location(${i}) vout${i}: vec4<f32>`)
          .concat(range(numScalar, (i) => `@location(${numVec4 + i}) vout${numVec4 + i}: f32`))
      ),
      t.getFragmentStateWithInputs(
        range(numVec4, (i) => `@location(${i}) fin${i}: vec4<f32>`)
          .concat(range(numScalar, (i) => `@location(${numVec4 + i}) fin${numVec4 + i}: f32`))
      ),
    );
    descriptor.primitive = { topology };

    t.doCreateRenderPipelineTest(isAsync, _success, descriptor);
  });

g.test('max_components_count,input')
  .desc(`Tests that validation should fail when scalar components of all user-defined outputs > max vertex shader output components.`)
  .params(u => 
    u.combine('isAsync', [false, true])
    .combineWithParams([
      // count of input scalar components in test shader = device.limits.maxInterStageShaderComponents + countDelta
      { countDelta: 0, useExtraBuiltinInputs: false, _success: true },
      { countDelta: 1, useExtraBuiltinInputs: false, _success: false },
      { countDelta: 0, useExtraBuiltinInputs: true, _success: false },
      { countDelta: -3, useExtraBuiltinInputs: true, _success: true },
      { countDelta: -2, useExtraBuiltinInputs: true, _success: false },
    ] as const)
  )
  .fn(async t => {
    const { isAsync, countDelta, useExtraBuiltinInputs, _success } = t.params;

    const scalarComponentsCount = t.device.limits.maxInterStageShaderComponents + countDelta;

    const numVec4 = Math.floor(scalarComponentsCount / 4);
    const numScalar = scalarComponentsCount % 4;
    const numVariables = numVec4 + numScalar;
    // assert(numVariables <= t.device.limits.maxInterStageShaderVariables);

    const outputs = range(numVec4, (i) => `@location(${i}) vout${i}: vec4<f32>`)
      .concat(range(numScalar, (i) => `@location(${numVec4 + i}) vout${numVec4 + i}: f32`));
    const inputs = range(numVec4, (i) => `@location(${i}) fin${i}: vec4<f32>`)
      .concat(range(numScalar, (i) => `@location(${numVec4 + i}) fin${numVec4 + i}: f32`));
    
    if (useExtraBuiltinInputs) {
      inputs.push(
        '@builtin(front_facing) front_facing_in: bool',
        '@builtin(sample_index) sample_index_in: u32',
        '@builtin(sample_mask) sample_mask_in: u32',
      );
    }

    const descriptor = t.getDescriptorWithStates(
      t.getVertexStateWithOutputs(outputs),
      t.getFragmentStateWithInputs(inputs),
    );

    // t.doCreateRenderPipelineTest(isAsync, _success && numVariables <= t.device.limits.maxInterStageShaderVariables, descriptor);
    t.doCreateRenderPipelineTest(isAsync, _success, descriptor);
  });