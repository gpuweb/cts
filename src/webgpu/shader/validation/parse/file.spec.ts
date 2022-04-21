export const description = `Validation tests for file parsing`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';

import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('valid_file')
  .desc(`Tests that a valid source file is consumed successfully.`)
  .fn(t => {
    const code = `
    @stage(fragment)
    fn main() -> @location(0) vec4<f32> {
      return vec4<f32>(.4, .2, .3, .1);
    }`;
    t.expectCompileResult(true, code);
  });

g.test('empty')
  .desc(`Test that an empty source file is consumed successfully.`)
  .fn(t => {
    t.expectCompileResult(true, '');
  });

g.test('invalid_file')
  .desc(`Tests that a source file which does not match the grammar fails.`)
  .fn(t => {
    t.expectCompileResult(false, 'invalid_file');
  });
