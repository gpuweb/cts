export const description = `Validation tests for whitespace handling`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';

import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('null_characters')
  .desc(`Test that WGSL source containing a null character is rejected.`)
  .params(u =>
    u
      .combine('contains_null', [true, false])
      .combine('placement', ['comment', 'delimiter', 'eol'])
      .beginSubcases()
  )
  .fn(t => {
    let code = '';
    if (t.params.placement === 'comment') {
      code = `// Here is a ${t.params.contains_null ? '\0' : 'Z'} character`;
    } else if (t.params.placement === 'delimiter') {
      code = `let${t.params.contains_null ? '\0' : ' '}name : i32 = 0;`;
    } else if (t.params.placement === 'eol') {
      code = `let name : i32 = 0;${t.params.contains_null ? '\0' : ''}`;
    }
    t.expectCompileResult(!t.params.contains_null, code);
  });

g.test('whitespace')
  .desc(`Test that all whitespace characters act as delimiters.`)
  .fn(t => {
    const code = `
let space:i32=0;
let\thorizontal_tab:i32=0;
let\nlinefeed:i32=0;
let\vvertical_tab:i32=0;
let\fformfeed:i32=0;
let\rcarriage_return:i32=0;
`;
    t.expectCompileResult(true, code);
  });
