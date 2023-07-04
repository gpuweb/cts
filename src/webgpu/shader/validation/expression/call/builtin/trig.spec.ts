export const description = `
Validation tests for trigonometry builtins.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { ShaderValidationTest } from '../../../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

/// An array of values ranging from -1 to 2
const kMinusOneToTwo = [-1.0, -0.9, -0.1, 0.0, 0.1, 0.5, 0.9, 1.0, 1.1, 1.5, 1.9, 2.0] as const;

/// The evaluation stages to test
const kEvaluationStages = ['constant', 'override'] as const;

/// All floating-point scalar and vector types to test
const kFloatingPointTypes = [
  '',
  'vec2',
  'vec3',
  'vec4',
  'f32',
  'vec2f',
  'vec3f',
  'vec4f',
  'f16',
  'vec2h',
  'vec3h',
  'vec4h',
] as const;

function requiresShaderF16(type: string) {
  return type === 'f16' || type === 'vec2h' || type === 'vec3h' || type === 'vec4h';
}

function runTest(
  t: ShaderValidationTest,
  builtin: string,
  expectedResult: boolean,
  value: number,
  type: string,
  stage: string
) {
  const enables = requiresShaderF16(type) ? 'enable f16;' : '';
  switch (stage) {
    case 'constant': {
      t.expectCompileResult(
        expectedResult,
        `${enables}
const v = ${builtin}(${type}(${value}));`
      );
      break;
    }
    case 'override': {
      t.expectPipelineResult({
        expectedResult,
        code: `${enables}
override o : f32;
var<private> v = ${builtin}(${type}(o));`,
        constants: { o: value },
        reference: ['v'],
      });
      break;
    }
  }
}

g.test('acos')
  .desc(
    `
Validates that constant evaluation and override evaluation of acos() rejects invalid values
`
  )
  .params(u =>
    u
      .combine('stage', kEvaluationStages)
      .combine('type', kFloatingPointTypes)
      .combine('value', kMinusOneToTwo)
  )
  .beforeAllSubcases(t => {
    if (requiresShaderF16(t.params.type)) {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    const expectedResult = Math.abs(t.params.value) <= 1;
    runTest(t, 'acos', expectedResult, t.params.value, t.params.type, t.params.stage);
  });

g.test('acosh')
  .desc(
    `
Validates that constant evaluation and override evaluation of acosh() rejects invalid values
`
  )
  .params(u =>
    u
      .combine('stage', kEvaluationStages)
      .combine('type', kFloatingPointTypes)
      .combine('value', kMinusOneToTwo)
  )
  .beforeAllSubcases(t => {
    if (requiresShaderF16(t.params.type)) {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    const expectedResult = t.params.value >= 1;
    runTest(t, 'acosh', expectedResult, t.params.value, t.params.type, t.params.stage);
  });

g.test('asin')
  .desc(
    `
Validates that constant evaluation and override evaluation of asin() rejects invalid values
`
  )
  .params(u =>
    u
      .combine('stage', kEvaluationStages)
      .combine('type', kFloatingPointTypes)
      .combine('value', kMinusOneToTwo)
  )
  .beforeAllSubcases(t => {
    if (requiresShaderF16(t.params.type)) {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    const expectedResult = Math.abs(t.params.value) <= 1;
    runTest(t, 'asin', expectedResult, t.params.value, t.params.type, t.params.stage);
  });

g.test('atanh')
  .desc(
    `
Validates that constant evaluation and override evaluation of atanh() rejects invalid values
`
  )
  .params(u =>
    u
      .combine('stage', kEvaluationStages)
      .combine('type', kFloatingPointTypes)
      .combine('value', kMinusOneToTwo)
  )
  .beforeAllSubcases(t => {
    if (requiresShaderF16(t.params.type)) {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    const expectedResult = Math.abs(t.params.value) < 1;
    runTest(t, 'atanh', expectedResult, t.params.value, t.params.type, t.params.stage);
  });
