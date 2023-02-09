export const description = `Validation tests for @builtin`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { keysOf } from '../../../../common/util/data_tables.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

const kTests = {
  pos: {
    src: `@builtin(position)`,
    pass: true,
  },
  trailing_comma: {
    src: `@builtin(position,)`,
    pass: true,
  },
  newline_in_attr: {
    src: `@ \n builtin(position)`,
    pass: true,
  },
  whitespace_in_attr: {
    src: `@/* comment */builtin/* comment */\n\n(\t/*comment*/position/*comment*/)`,
    pass: true,
  },
  invalid_name: {
    src: `@abuiltin(position)`,
    pass: false,
  },
  no_params: {
    src: `@builtin`,
    pass: false,
  },
  missing_param: {
    src: `@builtin()`,
    pass: false,
  },
  missing_parens: {
    src: `@builtin position`,
    pass: false,
  },
  missing_lparen: {
    src: `@builtin position)`,
    pass: false,
  },
  missing_rparen: {
    src: `@builtin(position`,
    pass: false,
  },
  multiple_params: {
    src: `@builtin(position, frag_depth)`,
    pass: false,
  },
  ident_param: {
    src: `@builtin(identifier)`,
    pass: false,
  },
  number_param: {
    src: `@builtin(2)`,
    pass: false,
  },
};

g.test('parse')
  .desc(`Test that @builtin is parsed correctly.`)
  .params(u => u.combine('builtin', keysOf(kTests)))
  .fn(t => {
    const src = kTests[t.params.builtin].src;
    const code = `
@vertex
fn main() -> ${src} vec4<f32> {
  return vec4<f32>(.4, .2, .3, .1);
}`;
    t.expectCompileResult(kTests[t.params.builtin].pass, code);
  });
