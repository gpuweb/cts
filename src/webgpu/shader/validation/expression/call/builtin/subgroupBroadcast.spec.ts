export const description = `
Validation tests for subgroupBroadcast
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { keysOf, objectsToRecord } from '../../../../../../common/util/data_tables.js';
import {
  isConvertible,
  Type,
  elementTypeOf,
  kAllScalarsAndVectors,
} from '../../../../../util/conversion.js';
import { ShaderValidationTest } from '../../../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

const kArgumentTypes = objectsToRecord(kAllScalarsAndVectors);

g.test('early_eval')
  .desc('Ensures the builtin is not able to be compile time evaluated')
  .unimplemented();

g.test('must_use')
  .desc('Tests that the builtin has the @must_use attribute')
  .params(u => u.combine('must_use', [true, false] as const))
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase('subgroups' as GPUFeatureName);
  })
  .fn(t => {
    const wgsl = `
enable subgroups;
@compute @workgroup_size(16)
fn main() {
  ${t.params.must_use ? '_ = ' : ''}subgroupBroadcast(0, 0);
}`;

    t.expectCompileResult(t.params.must_use, wgsl);
  });

g.test('data_type')
  .desc('Validates data parameter type')
  .params(u => u.combine('type', keysOf(kArgumentTypes)))
  .beforeAllSubcases(t => {
    const features = ['subgroups' as GPUFeatureName];
    const type = kArgumentTypes[t.params.type];
    if (type.requiresF16()) {
      features.push('subgroups-f16' as GPUFeatureName);
      features.push('shader-f16');
    }
    t.selectDeviceOrSkipTestCase(features);
  })
  .fn(t => {
    const type = kArgumentTypes[t.params.type];
    let enables = `enable subgroups;\n`;
    if (type.requiresF16()) {
      enables += `enable subgroups_f16;\nenable f16;`;
    }
    const wgsl = `
${enables}
@compute @workgroup_size(1)
fn main() {
  _ = subgroupBroadcast(${type.create(0).wgsl()}, 0);
}`;

    t.expectCompileResult(elementTypeOf(type) !== Type.bool, wgsl);
  });

g.test('return_type')
  .desc('Validates data parameter type')
  .params(u =>
    u
      .combine('dataType', keysOf(kArgumentTypes))
      .combine('retType', keysOf(kArgumentTypes))
      .filter(t => {
        const retType = kArgumentTypes[t.retType];
        const retEleTy = elementTypeOf(retType);
        const dataType = kArgumentTypes[t.dataType];
        const dataEleTy = elementTypeOf(dataType);
        return (
          retEleTy !== Type.abstractInt &&
          retEleTy !== Type.abstractFloat &&
          dataEleTy !== Type.abstractInt &&
          dataEleTy !== Type.abstractFloat
        );
      })
  )
  .beforeAllSubcases(t => {
    const features = ['subgroups' as GPUFeatureName];
    const dataType = kArgumentTypes[t.params.dataType];
    const retType = kArgumentTypes[t.params.retType];
    if (dataType.requiresF16() || retType.requiresF16()) {
      features.push('subgroups-f16' as GPUFeatureName);
      features.push('shader-f16');
    }
    t.selectDeviceOrSkipTestCase(features);
  })
  .fn(t => {
    const dataType = kArgumentTypes[t.params.dataType];
    const retType = kArgumentTypes[t.params.retType];
    let enables = `enable subgroups;\n`;
    if (dataType.requiresF16() || retType.requiresF16()) {
      enables += `enable subgroups_f16;\nenable f16;`;
    }
    const wgsl = `
${enables}
@compute @workgroup_size(1)
fn main() {
  let res : ${retType.toString()} = subgroupBroadcast(${dataType.create(0).wgsl()}, 0);
}`;

    const expect = elementTypeOf(dataType) !== Type.bool && dataType === retType;
    t.expectCompileResult(expect, wgsl);
  });

g.test('id_type')
  .desc('Validates id parameter type')
  .params(u => u.combine('type', keysOf(kArgumentTypes)))
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase('subgroups' as GPUFeatureName);
  })
  .fn(t => {
    const type = kArgumentTypes[t.params.type];
    const wgsl = `
enable subgroups;
@compute @workgroup_size(1)
fn main() {
  _ = subgroupBroadcast(0, ${type.create(0).wgsl()});
}`;

    const expect = isConvertible(type, Type.u32) || isConvertible(type, Type.i32);
    t.expectCompileResult(expect, wgsl);
  });

g.test('stage')
  .desc('Validates it is only usable in correct stage')
  .params(u => u.combine('stage', ['compute', 'fragment', 'vertex'] as const))
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase('subgroups' as GPUFeatureName);
  })
  .fn(t => {
    const compute = `
@compute @workgroup_size(1)
fn main() {
  foo();
}`;

    const fragment = `
@fragment
fn main() {
  foo();
}`;

    const vertex = `
@vertex
fn main() -> @builtin(position) vec4f {
  foo();
  return vec4f();
}`;

    const entry = { compute, fragment, vertex }[t.params.stage];
    const wgsl = `
enable subgroups;
fn foo() {
  _ = subgroupBroadcast(0, 0);
}

${entry}
`;

    t.expectCompileResult(t.params.stage !== 'vertex', wgsl);
  });
