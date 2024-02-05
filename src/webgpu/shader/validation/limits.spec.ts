export const description = `Validation tests for WGSL limits.`;

import { makeTestGroup } from '../../../common/framework/test_group.js';
import { keysOf } from '../../../common/util/data_tables.js';
import { ShaderValidationTest } from './shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('struct_members')
  .desc(`Test that structures with up to 16383 members are supported.`)
  .fn(t => {
    let code = `struct S {`;
    for (let m = 0; m < 16383; m++) {
      code += `  m${m}: u32,\n`;
    }
    code += `}

    @group(0) @binding(0) var<storage, read_write> buffer : S;

    @compute @workgroup_size(1)
    fn foo() {
      buffer = S();
    }
    `;
    t.expectPipelineResult({ expectedResult: true, code, entryPoint: 'foo' });
  });

g.test('nesting_depth_composite_struct')
  .desc(`Test that composite types can be nested up to 255 levels.`)
  .fn(t => {
    let code = `struct S0 { a : u32 }\n`;
    for (let s = 1; s < 255; s++) {
      code += `struct S${s} { a : S${s - 1} }\n`;
    }
    code += `
    @group(0) @binding(0) var<storage, read_write> buffer : S254;

    @compute @workgroup_size(1)
    fn foo() {
      buffer = S254();
    }
    `;
    t.expectPipelineResult({ expectedResult: true, code, entryPoint: 'foo' });
  });

g.test('nesting_depth_composite_array')
  .desc(`Test that composite types can be nested up to 255 levels.`)
  .fn(t => {
    let type = ``;
    for (let m = 0; m < 254; m++) {
      type += `array<`;
    }
    type += 'u32';
    for (let m = 0; m < 254; m++) {
      type += `, 1>`;
    }

    let code = `
    @group(0) @binding(0) var<storage, read_write> buffer : ${type};

    @compute @workgroup_size(1)
    fn foo() {
      buffer = ${type}();
    }
    `;
    t.expectPipelineResult({ expectedResult: true, code, entryPoint: 'foo' });
  });

g.test('nesting_depth_braces')
  .desc(`Test that brace-enclosed statements can be nested up to 127 levels.`)
  .fn(t => {
    let code = `@group(0) @binding(0) var<storage, read_write> buffer : array<u32, 127>;
    @compute @workgroup_size(1)

    fn foo() {
    `;
    for (let b = 0; b < 127; b++) {
      code += `  if (buffer[${b}] == ${b}) {\n`;
    }
    code += '    buffer[0] = 42;\n';
    for (let b = 0; b < 127; b++) {
      code += `  }\n`;
    }
    code += `
    }
    `;
    t.expectPipelineResult({ expectedResult: true, code, entryPoint: 'foo' });
  });

g.test('function_parameters')
  .desc(`Test that functions can have 255 parameters.`)
  .fn(t => {
    let code = `@group(0) @binding(0) var<storage, read_write> buffer : array<u32, 255>;

    fn bar(`;
    for (let p = 0; p < 255; p++) {
      code += `p${p}: u32, `;
    }
    code += `) {`;

    for (let p = 0; p < 255; p++) {
      code += `buffer[${p}] = p${p};\n`;
    }

    code += `}

    @compute @workgroup_size(1)
    fn foo() {
      bar(`;
    for (let p = 0; p < 255; p++) {
      code += `${p}, `;
    }
    code += `);
    }
    `;
    t.expectPipelineResult({ expectedResult: true, code, entryPoint: 'foo' });
  });

g.test('switch_case_selectors')
  .desc(`Test that switch statements can have 16383 case selectors in separate clauses.`)
  .fn(t => {
    let code = `@group(0) @binding(0) var<storage, read_write> buffer : array<u32, 2>;

    @compute @workgroup_size(1)
    fn foo() {
      switch (buffer[0]) {
        default {}`;
    for (let s = 0; s < 16382; s++) {
      code += `
        case ${s} { buffer[1] = ${s}; }`;
    }
    code += `
      };
    }
    `;
    t.expectPipelineResult({ expectedResult: true, code, entryPoint: 'foo' });
  });

g.test('switch_case_selectors_same_clause')
  .desc(`Test that switch statements can have 16383 case selectors in the same clause.`)
  .fn(t => {
    let code = `@group(0) @binding(0) var<storage, read_write> buffer : array<u32, 2>;

    @compute @workgroup_size(1)
    fn foo() {
      switch (buffer[0]) {
        default {}
        case `;
    for (let s = 0; s < 16382; s++) {
      code += `${s}, `;
    }
    code += ` { buffer[1] = 42; }
      };
    }
    `;
    t.expectPipelineResult({ expectedResult: true, code, entryPoint: 'foo' });
  });

// A list of types used for array elements.
const kArrayElements = {
  bool: {
    size: 1,
    to_u32: (x: string) => `u32(${x})`,
  },
  u32: {
    size: 4,
    to_u32: (x: string) => x,
  },
  vec4u: {
    size: 16,
    to_u32: (x: string) => `dot(${x}, ${x})`,
  },
};

g.test('private_array_byte_size')
  .desc(`Test that arrays in the private address space up to 65535 bytes are supported.`)
  .params(u => u.combine('type', keysOf(kArrayElements)))
  .fn(t => {
    const type = kArrayElements[t.params.type];
    const elements = Math.floor(65535 / type.size);
    let code = `
    @group(0) @binding(0) var<storage, read_write> buffer : array<u32, ${elements}>;

    var<private> arr : array<${t.params.type}, ${elements}>;

    @compute @workgroup_size(1)
    fn foo() {
      for (var i = 0; i < ${elements}; i++) {
        buffer[i] = ${type.to_u32('arr[i]')};
      }
    }
    `;
    t.expectPipelineResult({ expectedResult: true, code, entryPoint: 'foo' });
  });

g.test('function_array_byte_size')
  .desc(`Test that arrays in the function address space up to 65535 bytes are supported.`)
  .params(u => u.combine('type', keysOf(kArrayElements)))
  .fn(t => {
    const type = kArrayElements[t.params.type];
    const elements = Math.floor(65535 / type.size);
    let code = `
    @group(0) @binding(0) var<storage, read_write> buffer : array<u32, ${elements}>;

    @compute @workgroup_size(1)
    fn foo() {
      var arr : array<${t.params.type}, ${elements}>;
      for (var i = 0; i < ${elements}; i++) {
        buffer[i] = ${type.to_u32('arr[i]')};
      }
    }
    `;
    t.expectPipelineResult({ expectedResult: true, code, entryPoint: 'foo' });
  });

g.test('function_variable_combined_byte_size')
  .desc(`Test the combined sizes of variables in the function address space.`)
  .params(u => u.combine('type', keysOf(kArrayElements)))
  .fn(t => {
    const type = kArrayElements[t.params.type];
    const elements = Math.floor(65535 / type.size / 4);
    let code = `
    @group(0) @binding(0) var<storage, read_write> buffer : array<u32, ${elements}>;

    @compute @workgroup_size(1)
    fn foo() {
      var arr1 : array<${t.params.type}, ${elements}>;
      var arr2 : array<${t.params.type}, ${elements}>;
      var arr3 : array<${t.params.type}, ${elements}>;
      var arr4 : array<${t.params.type}, ${elements}>;
      for (var i = 0; i < ${elements}; i++) {
        buffer[i] = ${type.to_u32('arr1[i]')} + ${type.to_u32('arr2[i]')} +
                    ${type.to_u32('arr3[i]')} + ${type.to_u32('arr4[i]')};
      }
    }
    `;
    t.expectPipelineResult({ expectedResult: true, code, entryPoint: 'foo' });
  });

g.test('workgroup_array_byte_size')
  .desc(`Test that arrays in the workgroup address space up to the maximum size are supported.`)
  .params(u => u.combine('type', keysOf(kArrayElements)))
  .fn(t => {
    const maxSize = t.device.limits.maxComputeWorkgroupStorageSize;
    const type = kArrayElements[t.params.type];
    const elements = Math.floor(maxSize / type.size);
    let code = `
    @group(0) @binding(0) var<storage, read_write> buffer : array<u32, ${elements}>;

    var<workgroup> arr : array<${t.params.type}, ${elements}>;

    @compute @workgroup_size(1)
    fn foo() {
      for (var i = 0; i < ${elements}; i++) {
        buffer[i] = ${type.to_u32('arr[i]')};
      }
    }
    `;
    t.expectPipelineResult({ expectedResult: true, code, entryPoint: 'foo' });
  });

g.test('workgroup_array_byte_size_override')
  .desc(`Test that arrays in the workgroup address space up to the maximum size are supported.`)
  .params(u => u.combine('type', keysOf(kArrayElements)))
  .fn(t => {
    const maxSize = t.device.limits.maxComputeWorkgroupStorageSize;
    const type = kArrayElements[t.params.type];
    const elements = Math.floor(maxSize / type.size);
    let code = `
    @group(0) @binding(0) var<storage, read_write> buffer : array<u32, ${elements}>;

    override elements = ${elements} * 1000;
    var<workgroup> arr : array<${t.params.type}, elements>;

    @compute @workgroup_size(1)
    fn foo() {
      for (var i = 0; i < ${elements}; i++) {
        buffer[i] = ${type.to_u32('arr[i]')};
      }
    }
    `;
    t.expectPipelineResult({
      expectedResult: true,
      code,
      entryPoint: 'foo',
      constants: { elements: elements },
    });
  });

g.test('const_array_elements')
  .desc(`Test that constant array expressions with 65535 elements are supported.`)
  .fn(t => {
    let type = `array<u32, 65535>`;

    let expr = `${type}(`;
    for (let i = 0; i < 65535; i++) {
      expr += `${i}, `;
    }
    expr += `)`;

    let code = `
    @group(0) @binding(0) var<storage, read_write> buffer : ${type};

    @compute @workgroup_size(1)
    fn foo() {
      buffer = ${expr};
    }
    `;
    t.expectPipelineResult({ expectedResult: true, code, entryPoint: 'foo' });
  });
