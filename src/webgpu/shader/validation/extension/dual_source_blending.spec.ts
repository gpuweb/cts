export const description = `
Validation tests for the dual_source_blending extension
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { keysOf } from '../../../../common/util/data_tables.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('use_blend_src_requires_extension_enabled')
  .desc(
    `Checks that the blend_src attribute is only allowed with the WGSL extension
     dual_source_blending enabled in shader and the WebGPU extension dual-source-blending supported
     on the device.`
  )
  .params(u =>
    u.combine('requireExtension', [true, false]).combine('enableExtension', [true, false])
  )
  .beforeAllSubcases(t => {
    if (t.params.requireExtension) {
      t.selectDeviceOrSkipTestCase({ requiredFeatures: ['dual-source-blending'] });
    }
  })
  .fn(t => {
    const { requireExtension, enableExtension } = t.params;

    t.expectCompileResult(
      requireExtension && enableExtension,
      `
        ${enableExtension ? 'enable dual_source_blending;' : ''}
        struct FragOut {
          @location(0) @blend_src(0) color : vec4f,
          @location(0) @blend_src(1) blend : vec4f,
        }
        @fragment fn main() -> FragOut {
          var output : FragOut;
          output.color = vec4f(1.0, 0.0, 0.0, 1.0);
          output.blend = vec4f(0.0, 1.0, 0.0, 1.0);
          return output;
        }
    `
    );
  });

const kSyntaxValidationTests = {
  zero: {
    src: `@blend_src(0)`,
    add_blend_src_0: false,
    add_blend_src_1: true,
    pass: true,
  },
  one: {
    src: `@blend_src(1)`,
    add_blend_src_0: true,
    add_blend_src_1: false,
    pass: true,
  },
  invalid: {
    src: `@blend_src(2)`,
    add_blend_src_0: true,
    add_blend_src_1: true,
    pass: false,
  },
  extra_comma: {
    src: `@blend_src(1,)`,
    add_blend_src_0: true,
    add_blend_src_1: false,
    pass: true,
  },
  i32: {
    src: `@blend_src(1i)`,
    add_blend_src_0: true,
    add_blend_src_1: false,
    pass: true,
  },
  u32: {
    src: `@blend_src(1u)`,
    add_blend_src_0: true,
    add_blend_src_1: false,
    pass: true,
  },
  hex: {
    src: `@blend_src(0x1)`,
    add_blend_src_0: true,
    add_blend_src_1: false,
    pass: true,
  },
  valid_const_expr: {
    src: `@blend_src(a + b)`,
    add_blend_src_0: true,
    add_blend_src_1: false,
    pass: true,
  },
  invalid_const_expr: {
    src: `@blend_src(b + c)`,
    add_blend_src_0: true,
    add_blend_src_1: true,
    pass: false,
  },
  max: {
    src: `@blend_src(2147483647)`,
    add_blend_src_0: true,
    add_blend_src_1: true,
    pass: false,
  },
  newline: {
    src: '@\nblend_src(1)',
    add_blend_src_0: true,
    add_blend_src_1: false,
    pass: true,
  },
  comment: {
    src: `@/* comment */blend_src(1)`,
    add_blend_src_0: true,
    add_blend_src_1: false,
    pass: true,
  },
  misspelling: {
    src: `@mblend_src(1)`,
    add_blend_src_0: true,
    add_blend_src_1: true,
    pass: false,
  },
  no_parens: {
    src: `@blend_src`,
    add_blend_src_0: true,
    add_blend_src_1: true,
    pass: false,
  },
  no_parens_no_blend_src_0: {
    src: `@blend_src`,
    add_blend_src_0: false,
    add_blend_src_1: true,
    pass: false,
  },
  empty_params: {
    src: `@blend_src()`,
    add_blend_src_0: true,
    add_blend_src_1: true,
    pass: false,
  },
  empty_params_no_blend_src_0: {
    src: `@blend_src()`,
    add_blend_src_0: false,
    add_blend_src_1: true,
    pass: false,
  },
  missing_left_paren: {
    src: `@blend_src 1)`,
    add_blend_src_0: true,
    add_blend_src_1: false,
    pass: false,
  },
  missing_right_paren: {
    src: `@blend_src(1`,
    add_blend_src_0: true,
    add_blend_src_1: false,
    pass: false,
  },
  extra_params: {
    src: `@blend_src(1, 2)`,
    add_blend_src_0: true,
    add_blend_src_1: true,
    pass: false,
  },
  f32: {
    src: `@blend_src(1f)`,
    add_blend_src_0: true,
    add_blend_src_1: false,
    pass: false,
  },
  f32_literal: {
    src: `@blend_src(1.0)`,
    add_blend_src_0: true,
    add_blend_src_1: false,
    pass: false,
  },
  negative: {
    src: `@blend_src(-1)`,
    add_blend_src_0: true,
    add_blend_src_1: true,
    pass: false,
  },
  override_expr: {
    src: `@blend_src(z + y)`,
    add_blend_src_0: true,
    add_blend_src_1: false,
    pass: false,
  },
  vec: {
    src: `@blend_src(vec2(1,1))`,
    add_blend_src_0: true,
    add_blend_src_1: true,
    pass: false,
  },
  duplicate: {
    src: `@blend_src(1) @blend_src(1)`,
    add_blend_src_0: true,
    add_blend_src_1: false,
    pass: false,
  },
};

g.test('blend_src_syntax_validation')
  .desc(`Syntax validation tests of blend_src.`)
  .params(u => u.combine('attr', keysOf(kSyntaxValidationTests)))
  .beforeAllSubcases(t =>
    t.selectDeviceOrSkipTestCase({ requiredFeatures: ['dual-source-blending'] })
  )
  .fn(t => {
    const code = `
enable dual_source_blending;

const a = 0;
const b = 1;
const c = 1;
override z = 0;
override y = 1;

struct FragOut {
  @location(0) ${kSyntaxValidationTests[t.params.attr].src} blend : vec4f,
  ${
    kSyntaxValidationTests[t.params.attr].add_blend_src_0
      ? '@location(0) @blend_src(0) color0 : vec4f,'
      : ''
  }
  ${
    kSyntaxValidationTests[t.params.attr].add_blend_src_1
      ? '@location(0) @blend_src(1) color1 : vec4f,'
      : ''
  }
}

@fragment fn main() -> FragOut {
  var output : FragOut;
  output.blend = vec4f(1.0, 0.0, 0.0, 1.0);
  ${kSyntaxValidationTests[t.params.attr].add_blend_src_0 ? 'output.color0 = output.blend;' : ''}
  ${kSyntaxValidationTests[t.params.attr].add_blend_src_1 ? 'output.color1 = output.blend;' : ''}
  return output;
}`;
    t.expectCompileResult(kSyntaxValidationTests[t.params.attr].pass, code);
  });

const kStageIOValidationTests = {
  vertex_input: {
    shader: `
    struct BlendSrcStruct {
      @location(0) @blend_src(0) color : vec4f,
      @location(0) @blend_src(1) blend : vec4f,
    }
    @vertex fn main(vertexInput : BlendSrcStruct) -> @builtin(position) vec4f {
      return vertexInput.color + vertexInput.blend;
    }
    `,
    pass: false,
  },
  vertex_output: {
    shader: `
    struct BlendSrcStruct {
      @location(0) @blend_src(0) color : vec4f,
      @location(0) @blend_src(1) blend : vec4f,
      @builtin(position) myPosition: vec4f,
    }
    @vertex fn main() -> BlendSrcStruct {
      var vertexOutput : BlendSrcStruct;
      vertexOutput.myPosition = vec4f(0.0, 0.0, 0.0, 1.0);
      return vertexOutput;
    }
    `,
    pass: false,
  },
  fragment_input: {
    shader: `
    struct BlendSrcStruct {
      @location(0) @blend_src(0) color : vec4f,
      @location(0) @blend_src(1) blend : vec4f,
    }
    @fragment fn main(fragmentInput : BlendSrcStruct) -> @location(0) vec4f {
      return fragmentInput.color + fragmentInput.blend;
    }
    `,
    pass: false,
  },
  fragment_output: {
    shader: `
    struct BlendSrcStruct {
      @location(0) @blend_src(0) color : vec4f,
      @location(0) @blend_src(1) blend : vec4f,
    }
    @fragment fn main() -> BlendSrcStruct {
      var fragmentOutput : BlendSrcStruct;
      fragmentOutput.color = vec4f(0.0, 1.0, 0.0, 1.0);
      fragmentOutput.blend = fragmentOutput.color;
      return fragmentOutput;
    }
    `,
    pass: true,
  },
};

g.test('blend_src_stage_input_output')
  .desc(
    `Test that the struct with blend_src cannot be used in the input of the fragment stage, the
  input of the vertex stage, or the output of the vertex stage. blend_src can be used as a part of
  the output of the fragment stage.`
  )
  .params(u => u.combine('attr', keysOf(kStageIOValidationTests)))
  .beforeAllSubcases(t =>
    t.selectDeviceOrSkipTestCase({ requiredFeatures: ['dual-source-blending'] })
  )
  .fn(t => {
    const code = `
enable dual_source_blending;

${kStageIOValidationTests[t.params.attr].shader}
`;
    t.expectCompileResult(kStageIOValidationTests[t.params.attr].pass, code);
  });
