export const description = `Validation tests for uniformity analysis`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

export const kCollectiveOps = [
  { op: 'textureSample', stage: 'fragment' },
  { op: 'textureSampleBias', stage: 'fragment' },
  { op: 'textureSampleCompare', stage: 'fragment' },
  { op: 'dpdx', stage: 'fragment' },
  { op: 'dpdxCoarse', stage: 'fragment' },
  { op: 'dpdxFine', stage: 'fragment' },
  { op: 'dpdy', stage: 'fragment' },
  { op: 'dpdyCoarse', stage: 'fragment' },
  { op: 'dpdyFine', stage: 'fragment' },
  { op: 'fwidth', stage: 'fragment' },
  { op: 'fwidthCoarse', stage: 'fragment' },
  { op: 'fwidthFine', stage: 'fragment' },
  { op: 'storageBarrier', stage: 'compute' },
  { op: 'workgroupBarrier', stage: 'compute' },
  { op: 'workgroupUniformLoad', stage: 'compute' },
] as const;

export const kConditions = [
  { cond: 'uniform_storage_ro', expectation: true },
  { cond: 'nonuniform_storage_ro', expectation: false },
  { cond: 'nonuniform_storage_rw', expectation: false },
  { cond: 'nonuniform_builtin', expectation: false },
  { cond: 'uniform_literal', expectation: true },
  { cond: 'uniform_const', expectation: true },
  { cond: 'uniform_override', expectation: true },
  { cond: 'uniform_let', expectation: true },
  { cond: 'nonuniform_let', expectation: false },
  { cond: 'uniform_or', expectation: true },
  { cond: 'nonuniform_or1', expectation: false },
  { cond: 'nonuniform_or2', expectation: false },
  { cond: 'uniform_and', expectation: true },
  { cond: 'nonuniform_and1', expectation: false },
  { cond: 'nonuniform_and2', expectation: false },
  { cond: 'uniform_func_var', expectation: true },
  { cond: 'nonuniform_func_var', expectation: false },
] as const;

export function generateCondition({ condition }: { condition: string }) {
  let code = ``;

  switch (condition) {
    case 'uniform_storage_ro': {
      code += `ro_buffer[0] == 0`;
      break;
    }
    case 'nonuniform_storage_ro': {
      code += `ro_buffer[priv_var[0]] == 0`;
      break;
    }
    case 'nonuniform_storage_rw': {
      code += `rw_buffer[0] == 0`;
      break;
    }
    case 'nonuniform_builtin': {
      code += `p.x == 0`;
      break;
    }
    case 'uniform_literal': {
      code += `false`;
      break;
    }
    case 'uniform_const': {
      code += `c`;
      break;
    }
    case 'uniform_override': {
      code += `o == 0`;
      break;
    }
    case 'uniform_let': {
      code += `u_let == 0`;
      break;
    }
    case 'nonuniform_let': {
      code += `n_let == 0`;
      break;
    }
    case 'uniform_or': {
      code += `u_let == 0 || uniform_buffer.y > 1`;
      break;
    }
    case 'nonuniform_or1': {
      code += `u_let == 0 || n_let == 0`;
      break;
    }
    case 'nonuniform_or2': {
      code += `n_let == 0 || u_let == 0`;
      break;
    }
    case 'uniform_and': {
      code += `u_let == 0 && uniform_buffer.y > 1`;
      break;
    }
    case 'nonuniform_and1': {
      code += `u_let == 0 && n_let == 0`;
      break;
    }
    case 'nonuniform_and2': {
      code += `n_let == 0 && u_let == 0`;
      break;
    }
    case 'uniform_func_var': {
      code += `u_f == 0`;
      break;
    }
    case 'nonuniform_func_var': {
      code += `n_f == 0`;
      break;
    }
    default: {
      break;
    }
  }

  return code;
}

export function generateOp({ op }: { op: string }) {
  let code = ``;

  switch (op) {
    case 'textureSample': {
      code += `let x = ${op}(tex, s, vec2(0,0));\n`;
      break;
    }
    case 'textureSampleBias': {
      code += `let x = ${op}(tex, s, vec2(0,0), 0);\n`;
      break;
    }
    case 'textureSampleCompare': {
      code += `let x = ${op}(tex_depth, s_comp, vec2(0,0), 0);\n`;
      break;
    }
    case 'storageBarrier':
    case 'workgroupBarrier': {
      code += `${op}();\n`;
      break;
    }
    case 'workgroupUniformLoad': {
      code += `let x = ${op}(&wg);`;
      break;
    }
    case 'dpdx':
    case 'dpdxCoarse':
    case 'dpdxFine':
    case 'dpdy':
    case 'dpdyCoarse':
    case 'dpdyFine':
    case 'fwidth':
    case 'fwidthCoarse':
    case 'fwidthFine':
    default: {
      code += `let x = ${op}(0);\n`;
      break;
    }
  }

  return code;
}

export function generateConditionalStatement({
  statement,
  condition,
  op,
}: {
  statement: string;
  condition: string;
  op: string;
}) {
  let code = ``;
  switch (statement) {
    case 'if': {
      code += `if `;
      code += generateCondition({ condition });
      code += ` {\n`;
      code += generateOp({ op });
      code += `\n}\n`;
      break;
    }
    case 'for': {
      code += `for (;`;
      code += generateCondition({ condition });
      code += `;) {\n`;
      code += generateOp({ op });
      code += `\n}\n`;
      break;
    }
    case 'while': {
      code += `while `;
      code += generateCondition({ condition });
      code += ` {\n`;
      code += generateOp({ op });
      code += `\n}\n`;
      break;
    }
    case 'switch': {
      code += `switch u32(`;
      code += generateCondition({ condition });
      code += `) {
        case 0: {\n`;
      code += generateOp({ op });
      code += `\n}\ndefault: { }\n`;
      code += `}\n`;
      break;
    }

    default: {
      break;
    }
  }

  return code;
}

g.test('basics')
  .desc(`Test collective operations in simple uniform or non-uniform control flow.`)
  .params(u =>
    u
      .combineWithParams(kCollectiveOps)
      .combineWithParams(kConditions)
      .combine('statement', ['if', 'for', 'while', 'switch'] as const)
      .beginSubcases()
  )
  .fn(t => {
    let code = `
 @group(0) @binding(0) var s : sampler;
 @group(0) @binding(1) var s_comp : sampler_comparison;
 @group(0) @binding(2) var tex : texture_2d<f32>;
 @group(0) @binding(3) var tex_depth : texture_depth_2d;

 @group(1) @binding(0) var<storage, read> ro_buffer : array<f32, 4>;
 @group(1) @binding(1) var<storage, read_write> rw_buffer : array<f32, 4>;
 @group(1) @binding(2) var<uniform> uniform_buffer : vec4<f32>;

 var<private> priv_var : array<f32, 4> = array(0,0,0,0);

 const c = false;
 override o : f32;
`;

    if (t.params.stage === 'compute') {
      code += `var<workgroup> wg : f32;\n`;
      code += ` @workgroup_size(16, 1, 1)`;
    }
    code += `@${t.params.stage}`;
    code += `\nfn main(`;
    if (t.params.stage === 'compute') {
      code += `@builtin(global_invocation_id) p : vec3<u32>`;
    } else {
      code += `@builtin(position) p : vec4<f32>`;
    }
    code += `) {
      let u_let = uniform_buffer.x;
      let n_let = rw_buffer[0];
      var u_f = uniform_buffer.z;
      var n_f = rw_buffer[1];
    `;

    // Simple control statement containing the op.
    code += generateConditionalStatement({
      statement: t.params.statement,
      condition: t.params.cond,
      op: t.params.op,
    });

    code += `\n}\n`;

    t.expectCompileResult(t.params.expectation, code);
  });
