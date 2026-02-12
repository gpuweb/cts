export const description = `
Swizzle assignment execution.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { keysOf } from '../../../../common/util/data_tables.js';
import { TypedArrayBufferView } from '../../../../common/util/util.js';
import { Float16Array } from '../../../../external/petamoriken/float16/float16.js';
import { AllFeaturesMaxLimitsGPUTest, GPUTest } from '../../../gpu_test.js';

export const g = makeTestGroup(AllFeaturesMaxLimitsGPUTest);

/**
 * Builds, runs then checks the output of a shader test with a swizzle assignment.
 *
 * @param t The test object
 * @param elemType The type of the vector elements
 * @param vecSize The size of the vector
 * @param initial The initial values of the vector
 * @param swizzle The swizzle string for the assignment
 * @param rhs The WGSL string for the right-hand side of the assignment
 * @param expectedValues The expected final values of the vector after the assignment
 */
export function runSwizzleAssignmentTest(
  t: GPUTest,
  elemType: SwizzleAssignmentCase['elemType'],
  vecSize: SwizzleAssignmentCase['vecSize'],
  initial: readonly number[],
  swizzle: string,
  rhs: string,
  expectedValues: readonly number[]
) {
  t.skipIfLanguageFeatureNotSupported('swizzle_assignment');
  if (elemType === 'f16') {
    t.skipIfDeviceDoesNotHaveFeature('shader-f16');
  }

  const vecType = `vec${vecSize}<${elemType}>`;
  const initialValues =
    elemType === 'bool'
      ? initial.map(v => (v === 0 ? 'false' : 'true')).join(', ')
      : initial.join(', ');
  const outputElemType = elemType === 'bool' ? 'u32' : elemType;
  const wgsl = `
requires swizzle_assignment;
${elemType === 'f16' ? 'enable f16;' : ''}

struct Outputs {
  data : array<${outputElemType}>,
};

@group(0) @binding(1) var<storage, read_write> outputs : Outputs;

@compute @workgroup_size(1)
fn main() {
  var v = ${vecType}(${initialValues});
  v.${swizzle} = ${rhs};

  // Store result to Output
  for (var i = 0; i < ${vecSize}; i++) {
    ${elemType === 'bool' ? 'outputs.data[i] = u32(v[i]);' : 'outputs.data[i] = v[i];'}
  }
}
`;

  const pipeline = t.device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: t.device.createShaderModule({ code: wgsl }),
      entryPoint: 'main',
    },
  });

  const maxOutputValues = 1000;
  const outputBuffer = t.createBufferTracked({
    size: 4 * (1 + maxOutputValues),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  const bindGroup = t.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 1, resource: { buffer: outputBuffer } }],
  });

  const encoder = t.device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(1);
  pass.end();
  t.queue.submit([encoder.finish()]);

  let outputArrayConstructor: { new (values: readonly number[]): TypedArrayBufferView };
  switch (elemType) {
    case 'u32':
      outputArrayConstructor = Uint32Array;
      break;
    case 'i32':
      outputArrayConstructor = Int32Array;
      break;
    case 'f32':
      outputArrayConstructor = Float32Array;
      break;
    case 'f16':
      outputArrayConstructor = Float16Array;
      break;
    case 'bool':
      outputArrayConstructor = Uint32Array;
      break;
  }
  t.expectGPUBufferValuesEqual(outputBuffer, new outputArrayConstructor(expectedValues));
}

interface SwizzleAssignmentCase {
  elemType: 'u32' | 'i32' | 'f32' | 'f16' | 'bool';
  vecSize: 2 | 3 | 4;
  initial: readonly number[];
  swizzle: string;
  rhs: string;
  expected: readonly number[];
}

const kSwizzleAssignmentCases: Record<string, SwizzleAssignmentCase> = {
  // v = vec4u(1, 2, 3, 4)
  // v.w = 5;
  vec4u_w_literal: {
    elemType: 'u32',
    vecSize: 4,
    initial: [1, 2, 3, 4],
    swizzle: 'w',
    rhs: '5',
    expected: [1, 2, 3, 5],
  },
  // v = vec4u(1, 2, 3, 5)
  // v.xy = vec2u(6, 7);
  vec4u_xy_vec2u: {
    elemType: 'u32',
    vecSize: 4,
    initial: [1, 2, 3, 5],
    swizzle: 'xy',
    rhs: 'vec2u(6, 7)',
    expected: [6, 7, 3, 5],
  },
  // v = vec4u(6, 7, 3, 5)
  // v.zx = vec2u(8, 9);
  vec4u_zx_vec2u: {
    elemType: 'u32',
    vecSize: 4,
    initial: [6, 7, 3, 5],
    swizzle: 'zx',
    rhs: 'vec2u(8, 9)',
    expected: [9, 7, 8, 5],
  },
  // v = vec4u(1, 1, 1, 1)
  // v.xyzw = vec4u(10, 11, 12, 13);
  vec4u_xyzw_vec4u: {
    elemType: 'u32',
    vecSize: 4,
    initial: [1, 1, 1, 1],
    swizzle: 'xyzw',
    rhs: 'vec4u(10, 11, 12, 13)',
    expected: [10, 11, 12, 13],
  },
  // v = vec4u(10, 11, 12, 13)
  // v.xy = vec2(v.y, v.x);
  vec4u_xy_vec2_yx: {
    elemType: 'u32',
    vecSize: 4,
    initial: [10, 11, 12, 13],
    swizzle: 'xy',
    rhs: 'vec2(v.y, v.x)',
    expected: [11, 10, 12, 13],
  },
  // v = vec3i(-10, -20, -30)
  // v.y = 50;
  vec3i_y_literal: {
    elemType: 'i32',
    vecSize: 3,
    initial: [-10, -20, -30],
    swizzle: 'y',
    rhs: '-50',
    expected: [-10, -50, -30],
  },
  // v = vec3i(10, 20, 30)
  // v.zx = vec2i(40, 60);
  vec3i_zx_vec2i: {
    elemType: 'i32',
    vecSize: 3,
    initial: [10, 20, 30],
    swizzle: 'zx',
    rhs: 'vec2i(40, 60)',
    expected: [60, 20, 40],
  },
  // v = vec3f(1.0, 2.0, 3.0)
  // v.xy = vec2f(4.0, 5.0);
  vec3f_xy_vec2f: {
    elemType: 'f32',
    vecSize: 3,
    initial: [1.0, 2.0, 3.0],
    swizzle: 'xy',
    rhs: 'vec2f(4.0, 5.0)',
    expected: [4.0, 5.0, 3.0],
  },
  // v = vec2f(1.0, 2.0)
  // v.xy = v + v;
  vec2f_yx_v_plus_v: {
    elemType: 'f32',
    vecSize: 2,
    initial: [1.0, 2.0],
    swizzle: 'yx',
    rhs: 'v + v',
    expected: [4.0, 2.0],
  },
  // v = vec4f(10.0, 20.0, 30.0, 100.0)
  // v.rgb = vec3f(v.r, v.g, v.b) / 10;
  vec4f_rgb_vec3f_div_10: {
    elemType: 'f32',
    vecSize: 4,
    initial: [10.0, 20.0, 30.0, 100.0],
    swizzle: 'rgb',
    rhs: 'vec3f(v.r, v.g, v.b) / 10',
    expected: [1.0, 2.0, 3.0, 100.0],
  },
  // v = vec2h(1.0, 2.0)
  // v.yx = vec2h(4.0, 5.0);
  vec2h_yx_vec2h: {
    elemType: 'f16',
    vecSize: 2,
    initial: [1.0, 2.0],
    swizzle: 'yx',
    rhs: 'vec2h(4.0, 5.0)',
    expected: [5.0, 4.0],
  },
  // v = vec2<bool>(true, false)
  // v.y = true;
  vec2_bool_y_true: {
    elemType: 'bool',
    vecSize: 2,
    initial: [1, 0],
    swizzle: 'y',
    rhs: 'true',
    expected: [1, 1],
  },
  // v = vec3<bool>(true, true, true)
  // v.xz = vec2<bool>(false, false);
  vec3_bool_xz_vec2bool: {
    elemType: 'bool',
    vecSize: 3,
    initial: [1, 1, 1],
    swizzle: 'xz',
    rhs: 'vec2<bool>(false, false)',
    expected: [0, 1, 0],
  },
};

g.test('swizzle_assignment_local_var')
  .desc('Tests the value of a vector after swizzle assignment on a local function variable.')
  .params(u => u.combine('case', keysOf(kSwizzleAssignmentCases)))
  .fn(t => {
    const { elemType, vecSize, initial, swizzle, rhs, expected } =
      kSwizzleAssignmentCases[t.params.case];
    runSwizzleAssignmentTest(t, elemType, vecSize, initial, swizzle, rhs, expected);
  });

g.test('swizzle_assignment_other_vars')
  .desc('Tests the value of a vector after swizzle assignment with other address spaces.')
  .unimplemented();

g.test('swizzle_assignment_chained')
  .desc('Tests the value of a vector after swizzle assignment on a chained swizzle.')
  .unimplemented();

g.test('swizzle_assignment_pointer')
  .desc('Tests the value of a vector after swizzle assignment on pointer to a swizzle.')
  .unimplemented();

g.test('swizzle_compound_assignment')
  .desc('Tests the value of a vector after compound swizzle assignment.')
  .unimplemented();
