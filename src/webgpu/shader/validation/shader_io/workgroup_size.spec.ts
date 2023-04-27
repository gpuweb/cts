export const description = `Validation tests for workgroup_size`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { keysOf } from '../../../../common/util/data_tables.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

const kWorkgroupSizeTests = {
  x_only_float: {
    src: `@workgroup_size(8f)`,
    pass: false,
  },
  xy_only_float: {
    src: `@workgroup_size(8, 8f)`,
    pass: false,
  },
  xyz_float: {
    src: `@workgroup_size(8, 8, 8f)`,
    pass: false,
  },
  empty: {
    src: `@workgroup_size()`,
    pass: false,
  },
  empty_x: {
    src: `@workgroup_size(, 8)`,
    pass: false,
  },
  empty_y: {
    src: `@workgroup_size(8, , 8)`,
    pass: false,
  },
  invalid_entry: {
    src: `@workgroup_size(let)`,
    pass: false,
  },

  x_only_abstract: {
    src: `@workgroup_size(8)`,
    pass: true,
  },
  xy_only_abstract: {
    src: `@workgroup_size(8, 8)`,
    pass: true,
  },
  xyz_abstract: {
    src: `@workgroup_size(8, 8, 8)`,
    pass: true,
  },
  x_only_unsigned: {
    src: `@workgroup_size(8u)`,
    pass: true,
  },
  xy_only_unsigned: {
    src: `@workgroup_size(8u, 8u)`,
    pass: true,
  },
  xyz_unsigned: {
    src: `@workgroup_size(8u, 8u, 8u)`,
    pass: true,
  },
  x_only_signed: {
    src: `@workgroup_size(8i)`,
    pass: true,
  },
  xy_only_signed: {
    src: `@workgroup_size(8i, 8i)`,
    pass: true,
  },
  xyz_signed: {
    src: `@workgroup_size(8i, 8i, 8i)`,
    pass: true,
  },

  override: {
    src: `@id(42) override block_width = 12u;
@workgroup_size(block_width)`,
    pass: true,
  },
  override_no_default: {
    src: `override block_width: i32;
@workgroup_size(block_width)`,
    pass: true,
  },

  trailing_comma_x: {
    src: `@workgroup_size(8, )`,
    pass: true,
  },
  trailing_comma_y: {
    src: `@workgroup_size(8, 8,)`,
    pass: true,
  },
  trailing_comma_z: {
    src: `@workgroup_size(8, 8, 8,)`,
    pass: true,
  },
};
g.test('workgroup_size')
  .desc(`Test validation of workgroup_size`)
  .params(u => u.combine('attr', keysOf(kWorkgroupSizeTests)))
  .fn(t => {
    const code = `
${kWorkgroupSizeTests[t.params.attr].src}
@compute fn main() {}`;
    t.expectCompileResult(kWorkgroupSizeTests[t.params.attr].pass, code);
  });
