export const description = `
Validation tests for constructor built-in functions.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { keysOf } from '../../../../../../common/util/data_tables.js';
import { ShaderValidationTest } from '../../../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

const kScalarTypes = ['bool', 'i32', 'u32', 'f32', 'f16'];

g.test('scalar_zero_value')
  .desc('Tests zero value scalar constructors')
  .params(u => u.combine('type', kScalarTypes))
  .beforeAllSubcases(t => {
    if (t.params.type === 'f16') {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    const enable = t.params.type === 'f16' ? 'enable f16;' : '';
    const code = `${enable}
    const x : ${t.params.type} = ${t.params.type}();
    const_assert x == ${t.params.type}(0);`;
    t.expectCompileResult(true, code);
  });

g.test('scalar_value')
  .desc('Tests scalar value constructors')
  .params(u =>
    u
      .combine('type', kScalarTypes)
      .combine('value_type', [...kScalarTypes, 'vec2u', 'S', 'array<u32, 2>'])
  )
  .beforeAllSubcases(t => {
    if (t.params.type === 'f16' || t.params.value_type === 'f16') {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    const enable = t.params.type === 'f16' || t.params.value_type === 'f16' ? 'enable f16;' : '';
    const code = `${enable}
    const x : ${t.params.type} = ${t.params.type}(${t.params.value_type}());`;
    t.expectCompileResult(kScalarTypes.includes(t.params.value_type), code);
  });

g.test('vector_zero_value')
  .desc('Tests zero value vector constructors')
  .params(u =>
    u
      .combine('type', [...kScalarTypes, 'abstract-int', 'abstract-float'] as const)
      .beginSubcases()
      .combine('size', [2, 3, 4] as const)
  )
  .beforeAllSubcases(t => {
    if (t.params.type === 'f16') {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    const abstract = t.params.type === 'abstract-int' || t.params.type === 'abstract-float';
    const param = abstract ? '' : `<${t.params.type}>`;
    const decl = `vec${t.params.size}${param}`;
    const enable = t.params.type === 'f16' ? 'enable f16;' : '';
    const comparison = abstract ? '0' : `${t.params.type}(0)`;
    let code = `${enable}
    const x ${abstract ? '' : `: ${decl}`} = ${decl}();\n`;
    for (let i = 0; i < t.params.size; i++) {
      code += `const_assert x[${i}] == ${comparison};\n`;
    }
    t.expectCompileResult(true, code);
  });

g.test('vector_splat').unimplemented();

g.test('vector_copy').unimplemented();

g.test('vector_elementwise').unimplemented();

g.test('matrix_zero_value')
  .desc('Tests zero value matrix constructors')
  .params(u =>
    u
      .combine('type', ['f32', 'f16'] as const)
      .beginSubcases()
      .combine('rows', [2, 3, 4] as const)
      .combine('cols', [2, 3, 4] as const)
  )
  .beforeAllSubcases(t => {
    if (t.params.type === 'f16') {
      t.selectDeviceOrSkipTestCase('shader-f16');
    }
  })
  .fn(t => {
    const decl = `mat${t.params.cols}x${t.params.rows}<${t.params.type}>`;
    const enable = t.params.type === 'f16' ? 'enable f16;' : '';
    let code = `${enable}
    const x : ${decl} = ${decl}();\n`;
    for (let c = 0; c < t.params.cols; c++) {
      for (let r = 0; r < t.params.rows; r++) {
        code += `const_assert x[${c}][${r}] == ${t.params.type}(0);\n`;
      }
    }
    t.expectCompileResult(true, code);
  });

g.test('matrix_copy').unimplemented();

g.test('matrix_column').unimplemented();

g.test('matrix_elementwise').unimplemented();

interface ArrayCase {
  element: string;
  size: number | string;
  valid: boolean;
  values: string;
}

const kArrayCases: Record<string, ArrayCase> = {
  i32: {
    element: 'i32',
    size: 4,
    valid: true,
    values: '1,2,3,4',
  },
  f32: {
    element: 'f32',
    size: 1,
    valid: true,
    values: '0',
  },
  u32: {
    element: 'u32',
    size: 2,
    valid: true,
    values: '2,4',
  },
  valid_array: {
    element: 'array<u32, 2>',
    size: 2,
    valid: true,
    values: 'array(0,1), array(2,3)',
  },
  invalid_rta: {
    element: 'u32',
    size: '',
    valid: false,
    values: '0',
  },
  invalid_override_array: {
    element: 'u32',
    size: 'o',
    valid: false,
    values: '1',
  },
  valid_struct: {
    element: 'valid_S',
    size: 1,
    valid: true,
    values: 'valid_S(0)',
  },
  invalid_struct: {
    element: 'invalid_S',
    size: 1,
    valid: false,
    values: 'array(0)',
  },
  invalid_atomic: {
    element: 'atomic<u32>',
    size: 1,
    valid: false,
    values: '0',
  },
};

g.test('array_zero_value')
  .desc('Tests zero value array constructors')
  .params(u => u.combine('case', keysOf(kArrayCases)))
  .fn(t => {
    const testcase = kArrayCases[t.params.case];
    const decl = `array<${testcase.element}, ${testcase.size}>`;
    const code = `override o : i32 = 1;
    struct valid_S {
      x : u32
    }
    struct invalid_S {
      x : array<u32>
    }
    const x : ${decl} = ${decl}();`;
    t.expectCompileResult(testcase.valid, code);
  });

g.test('array_value')
  .desc('Tests array value constructor')
  .params(u => u.combine('case', keysOf(kArrayCases)))
  .fn(t => {
    const testcase = kArrayCases[t.params.case];
    const decl = `array<${testcase.element}, ${testcase.size}>`;
    const code = `override o : i32 = 1;
    struct valid_S {
      x : u32
    }
    struct invalid_S {
      x : array<u32>
    }
    const x : ${decl} = ${decl}(${testcase.values});`;
    t.expectCompileResult(testcase.valid, code);
  });

const kStructCases = {
  i32: {
    name: 'S',
    decls: `struct S { x : u32 }`,
    valid: true,
    values: '0',
  },
  f32x2: {
    name: 'S',
    decls: `struct S { x : f32, y : f32 }`,
    valid: true,
    values: '0,1',
  },
  vec3u: {
    name: 'S',
    decls: `struct S { x : vec3u }`,
    valid: true,
    values: 'vec3()',
  },
  valid_array: {
    name: 'S',
    decls: `struct S { x : array<u32, 2> }`,
    valid: true,
    values: 'array(1,2)',
  },
  runtime_array: {
    name: 'S',
    decls: `struct S { x : array<u32> }`,
    valid: false,
    values: 'array(0)',
  },
  atomic: {
    name: 'S',
    decls: `struct S { x : atomic<u32> }`,
    valid: false,
    values: '0',
  },
  struct: {
    name: 'S',
    decls: `struct S {
      x : T
    }
    struct T {
      x : u32
    }`,
    valid: true,
    values: 'T(0)',
  },
  many_members: {
    name: 'S',
    decls: `struct S {
      a : bool,
      b : u32,
      c : i32,
      d : vec4f,
    }`,
    valid: true,
    values: 'false, 1u, 32i, vec4f(1.0f)',
  },
};

g.test('struct_zero_value')
  .desc('Tests zero value struct constructors')
  .params(u => u.combine('case', keysOf(kStructCases)))
  .fn(t => {
    const testcase = kStructCases[t.params.case];
    const code = `
    ${testcase.decls}
    const x : ${testcase.name} = ${testcase.name}();`;
    t.expectCompileResult(testcase.valid, code);
  });

g.test('struct_value')
  .desc('Tests struct value constructors')
  .params(u => u.combine('case', keysOf(kStructCases)))
  .fn(t => {
    const testcase = kStructCases[t.params.case];
    const code = `
    ${testcase.decls}
    const x : ${testcase.name} = ${testcase.name}(${testcase.values});`;
    t.expectCompileResult(testcase.valid, code);
  });
