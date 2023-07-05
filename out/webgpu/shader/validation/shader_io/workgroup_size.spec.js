/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `Validation tests for workgroup_size`;import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { keysOf } from '../../../../common/util/data_tables.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

const kWorkgroupSizeTests = {
  x_only_float: {
    src: `@workgroup_size(8f)`,
    pass: false
  },
  xy_only_float: {
    src: `@workgroup_size(8, 8f)`,
    pass: false
  },
  xyz_float: {
    src: `@workgroup_size(8, 8, 8f)`,
    pass: false
  },
  empty: {
    src: `@workgroup_size()`,
    pass: false
  },
  empty_x: {
    src: `@workgroup_size(, 8)`,
    pass: false
  },
  empty_y: {
    src: `@workgroup_size(8, , 8)`,
    pass: false
  },
  invalid_entry: {
    src: `@workgroup_size(let)`,
    pass: false
  },

  x_only_abstract: {
    src: `@workgroup_size(8)`,
    pass: true
  },
  xy_only_abstract: {
    src: `@workgroup_size(8, 8)`,
    pass: true
  },
  xyz_abstract: {
    src: `@workgroup_size(8, 8, 8)`,
    pass: true
  },
  x_only_unsigned: {
    src: `@workgroup_size(8u)`,
    pass: true
  },
  xy_only_unsigned: {
    src: `@workgroup_size(8u, 8u)`,
    pass: true
  },
  xyz_unsigned: {
    src: `@workgroup_size(8u, 8u, 8u)`,
    pass: true
  },
  x_only_signed: {
    src: `@workgroup_size(8i)`,
    pass: true
  },
  xy_only_signed: {
    src: `@workgroup_size(8i, 8i)`,
    pass: true
  },
  xyz_signed: {
    src: `@workgroup_size(8i, 8i, 8i)`,
    pass: true
  },

  const_expr: {
    src: `const a = 4;
    const b = 5;
    @workgroup_size(a, b, a + b)`,
    pass: true
  },

  override: {
    src: `@id(42) override block_width = 12u;
@workgroup_size(block_width)`,
    pass: true
  },
  override_no_default: {
    src: `override block_width: i32;
@workgroup_size(block_width)`,
    pass: true
  },

  trailing_comma_x: {
    src: `@workgroup_size(8, )`,
    pass: true
  },
  trailing_comma_y: {
    src: `@workgroup_size(8, 8,)`,
    pass: true
  },
  trailing_comma_z: {
    src: `@workgroup_size(8, 8, 8,)`,
    pass: true
  },

  override_expr: {
    src: `override a = 5;
    override b = 6;
    @workgroup_size(a, b, a + b)`,
    pass: true
  },

  // Mixed abstract is ok
  mixed_abstract_signed: {
    src: `@workgroup_size(8, 8i)`,
    pass: true
  },
  mixed_abstract_unsigned: {
    src: `@workgroup_size(8u, 8)`,
    pass: true
  },
  // Mixed signed and unsigned is not
  mixed_signed_unsigned: {
    src: `@workgroup_size(8i, 8i, 8u)`,
    pass: false
  },

  zero_x: {
    src: `@workgroup_size(0)`,
    pass: false
  },
  zero_y: {
    src: `@workgroup_size(8, 0)`,
    pass: false
  },
  zero_z: {
    src: `@workgroup_size(8, 8, 0)`,
    pass: false
  },
  negative_x: {
    src: `@workgroup_size(-8)`,
    pass: false
  },
  negative_y: {
    src: `@workgroup_size(8, -8)`,
    pass: false
  },
  negative_z: {
    src: `@workgroup_size(8, 8, -8)`,
    pass: false
  },

  max_values: {
    src: `@workgroup_size(256, 256, 64)`,
    pass: true
  }
};
g.test('workgroup_size').
desc(`Test validation of workgroup_size`).
params((u) => u.combine('attr', keysOf(kWorkgroupSizeTests))).
fn((t) => {
  const code = `
${kWorkgroupSizeTests[t.params.attr].src}
@compute fn main() {}`;
  t.expectCompileResult(kWorkgroupSizeTests[t.params.attr].pass, code);
});
//# sourceMappingURL=workgroup_size.spec.js.map