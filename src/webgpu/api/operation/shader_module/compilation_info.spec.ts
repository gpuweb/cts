export const description = `
ShaderModule CompilationInfo tests.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { assert } from '../../../../common/framework/util/util.js';

export const g = makeTestGroup(GPUTest);

const BAD_SHADER_SOURCE = `
  [[stage(vertex)]] fn main() -> [[builtin(position)]] vec4<f32> {
    // Expected Error: vec4 should be vec4<f32>
    return vec4(0.0, 0.0, 0.0, 1.0);
  }
`;

g.test('compilationInfo_valid_shader')
  .desc(
    `Ensures that compilationInfo() can be called on a valid ShaderModules.`
  )
  .fn(async t => {
    const shaderModule = t.device.createShaderModule({
      code: `
        [[stage(vertex)]] fn main() -> [[builtin(position)]] vec4<f32> {
          return vec4<f32>(0.0, 0.0, 0.0, 1.0);
        }
      `,
    });

    const info = await shaderModule.compilationInfo();

    t.expect(info instanceof GPUCompilationInfo, "Expected a GPUCompilationInfo object to be returned");

    // Expect that we get zero error messages from a valid shader.
    // Message types other than errors are OK.
    let errorCount = 0;
    for (const message of info.messages) {
      if (message.type == 'error') {
        errorCount++;
      }
    }
    t.expect(errorCount == 0, "Expected zero GPUCompilationMessages of type 'error'");
});

g.test('compilationInfo_invalid_shader')
  .desc(
    `Ensures that compilationInfo() can be called on an invalid ShaderModules.`
  )
  .fn(async t => {

    const shaderModule = t.expectGPUError(
      'validation', // Should be a validation error since the shader is invalid.
      () =>
        t.device.createShaderModule({
          code: BAD_SHADER_SOURCE,
        })
    );

    const info = await shaderModule.compilationInfo();

    t.expect(info instanceof GPUCompilationInfo, "Expected a GPUCompilationInfo object to be returned");

    // Expect that we get at least one error message.
    // Additional errors or other message types are also OK.
    let errorCount = 0;
    for (const message of info.messages) {
      if (message.type == 'error') {
        errorCount++;
      }
    }
    t.expect(errorCount > 0, "Expected at least one GPUCompilationMessages of type 'error'");
});

g.test('compilationInfo_line_position')
  .desc(
    `Ensures that line numbers reported by compilationInfo either point at an appropriate line and
    position or at 0:0, indicating an unknown position.`
  )
  .fn(async t => {

    const shaderModule = t.expectGPUError(
      'validation', // Should be a validation error since the shader is invalid.
      () =>
        t.device.createShaderModule({
          code: BAD_SHADER_SOURCE,
        })
    );

    const info = await shaderModule.compilationInfo();

    let foundAppropriateError = false;
    for (const message of info.messages) {
      if (message.type == 'error') {
        // Some backends may not be able to indicate a precise location for the error. In those
        // cases a line and position of 0 should be reported.
        if (message.lineNum == 0) {
          foundAppropriateError = true;
          t.expect(message.linePos == 0, "GPUCompilationMessages that don't report a line number should not report a line position.")
          break;
        }

        // If a line is reported, it should point at the correct line (1-based).
        if (message.lineNum == 4) {
          foundAppropriateError = true;

          // Various backends may choose to report the error at different positions within the line,
          // so it's difficult to meaningfully validate them.
          break;
        }
      }
    }
    t.expect(foundAppropriateError, "Expected to find an error which corresponded with the erronious line");
});


g.test('compilationInfo_offset_length')
  .desc(
    `Ensures message offsets and lengths are valid and align with any reported lineNum and linePos.`
  )
  .fn(async t => {

    const shaderModule = t.expectGPUError(
      'validation', // Should be a validation error since the shader is invalid.
      () =>
        t.device.createShaderModule({
          code: BAD_SHADER_SOURCE,
        })
    );

    const info = await shaderModule.compilationInfo();

    for (const message of info.messages) {
      // Any offsets and lengths should reference valid spans of the shader code.
      t.expect(message.offset < BAD_SHADER_SOURCE.length, "Message offset should be within the shader source");
      t.expect(message.offset + message.length < BAD_SHADER_SOURCE.length, "Message offset and length should be within the shader source");

      // If a valid line number and position are given the offset should point the the same location in the shader source.
      if (message.lineNum != 0 && message.linePos != 0) {
        let lineOffset = 0;
        for (let i = 0; i < message.lineNum-1; ++i) {
          lineOffset = BAD_SHADER_SOURCE.indexOf('\n', lineOffset);
          assert(lineOffset != -1);
          lineOffset+=1;
        }

        t.expect(message.offset == lineOffset + message.linePos-1, "lineNum and linePos should point to the same location as offset");
      }
    }
});

g.test('compilationInfo_offset_unicode')
  .desc(
    `Ensures that message offsets properly take into account unicode characters`
  )
  .unimplemented();
