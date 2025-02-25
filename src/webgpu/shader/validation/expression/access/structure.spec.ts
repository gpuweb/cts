export const description = `
Validation tests for structure access expressions.

* Correct result type
* Identifier matching
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { keysOf } from '../../../../../common/util/data_tables.js';
import { ShaderValidationTest } from '../../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('identifier_mismatch')
  .desc('Tests that the member identifier must match a member in the declaration')
  .params(u => u.combine('decl', ['value', 'ref'] as const))
  .fn(t => {
    const code = `
    struct S {
      x : u32
    }
    fn foo() {
      ${t.params.decl === 'value' ? 'let' : 'var'} v : S = S();
      _ = v.y;
    }`;
    t.expectCompileResult(false, code);
  });

g.test('shadowed_member')
  .desc('Tests that other declarations do not interfere with member determination')
  .params(u => u.combine('decl', ['value', 'ref'] as const))
  .fn(t => {
    const code = `
    struct S {
      x : u32
    }
    fn foo() {
      var x : i32;
      ${t.params.decl === 'value' ? 'let' : 'var'} v : S = S();
      let tmp : u32 = v.x;
    }`;
    t.expectCompileResult(true, code);
  });

g.test('result_type')
  .desc('Tests correct result types are returned')
  .params(u => u.combine('decl', ['value', 'ref'] as const))
  .fn(t => {
    const types = [
      'i32',
      'u32',
      'f32',
      'bool',
      'array<u32, 4>',
      'array<T, 2>',
      'vec2f',
      'vec3u',
      'vec4i',
      'mat2x2f',
      'T',
    ];
    let code = `
    struct T {
      a : f32
    }
    struct S {\n`;

    for (let i = 0; i < types.length; i++) {
      code += `m${i} : ${types[i]},\n`;
    }

    code += `}
    fn foo() {
      var x : i32;
      ${t.params.decl === 'value' ? 'let' : 'var'} v : S = S();\n`;

    for (let i = 0; i < types.length; i++) {
      code += `let tmp${i} : ${types[i]} = v.m${i};\n`;
    }

    code += `}`;
    t.expectCompileResult(true, code);
  });

g.test('result_type_f16')
  .desc('Tests correct type is returned for f16')
  .params(u => u.combine('decl', ['value', 'ref'] as const))
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase('shader-f16');
  })
  .fn(t => {
    const code = `
    enable f16;
    struct S {
      x : f16
    }
    fn foo() {
      ${t.params.decl === 'value' ? 'let' : 'var'} v : S = S();
      let tmp : f16 = v.x;
    }`;
    t.expectCompileResult(true, code);
  });

g.test('result_type_runtime_array')
  .desc('Tests correct type is returned for runtime arrays')
  .fn(t => {
    const code = `
    struct S {
      x : array<u32>
    }
    @group(0) @binding(0) var<storage> v : S;
    fn foo() {
      let tmp : u32 = v.x[0];
      let tmp_ptr : ptr<storage, array<u32>> = &v.x;
    }`;
    t.expectCompileResult(true, code);
  });

interface OutOfBoundsCase {
  code: string;
  result: boolean;
  pipeline?: boolean;
  value?: number;
}

const kOutOfBoundsCases: Record<string, OutOfBoundsCase> = {
  runtime_structure_array_override_oob_neg: {
    code: `
      override x : i32;
      struct S {
        w : array<u32>
      }
      @group(0) @binding(0) var<storage> v : S;
      fn foo() -> u32 {
        let tmp : u32 = v.w[x];
        return 0;
      }`,
    result: false,
    pipeline: true,
    value: -1,
  },
  runtime_structure_array_override_pos: {
    code: `
      override x : i32;
      struct S {
        w : array<u32>
      }
      @group(0) @binding(0) var<storage> v : S;
      fn foo() -> u32 {
        let tmp : u32 = v.w[x];
        return 0;
      }`,
    result: true,
    pipeline: true,
    value: 1,
  },
  runtime_structure_array_override_oob_pos: {
    code: `
      override x : i32;
      struct S {
        w : array<u32, 5>
      }
      @group(0) @binding(0) var<storage> v : S;
      fn foo() -> u32 {
        let tmp : u32 = v.w[x];
        return 0;
      }`,
    result: false,
    pipeline: true,
    value: 5,
  },
  runtime_nested_structure_array_override_oob_pos: {
    code: `
      override x : i32;
      struct S {
        w : array<u32, 5>
      }
      struct S2 {
        r : S
      }
      @group(0) @binding(0) var<storage> v : S2;
      fn foo() -> u32 {
        let tmp : u32 = v.r.w[x];
        return 0;
      }`,
    result: false,
    pipeline: true,
    value: 5,
  },
  runtime_nested_structure_array_override_pos: {
    code: `
      override x : i32;
      struct S {
        w : array<u32, 6>
      }
      struct S2 {
        r : S
      }
      @group(0) @binding(0) var<storage> v : S2;
      fn foo() -> u32 {
        let tmp : u32 = v.r.w[x];
        return 0;
      }`,
    result: true,
    pipeline: true,
    value: 5,
  },
};

g.test('early_eval_errors')
  .desc('Tests early evaluation errors for arrays in stuctures out-of-bounds indexing')
  .params(u => u.combine('case', keysOf(kOutOfBoundsCases)))
  .fn(t => {
    const testcase = kOutOfBoundsCases[t.params.case];
    if (testcase.pipeline) {
      const v: number = testcase.value ?? 0;
      t.expectPipelineResult({
        expectedResult: testcase.result,
        code: testcase.code,
        constants: { x: v },
        reference: ['foo()'],
      });
    } else {
      t.expectCompileResult(testcase.result, testcase.code);
    }
  });
