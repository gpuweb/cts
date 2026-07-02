export const description = `
Execution tests for bufferArrayView
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { keysOf } from '../../../../../../common/util/data_tables.js';
import { assert } from '../../../../../../common/util/util.js';
import { AllFeaturesMaxLimitsGPUTest } from '../../../../../gpu_test.js';
import { Type } from '../../../../../util/conversion.js';

import {
  kBufferSizes,
  kArrayLengthTypes,
  kOffsets,
  kSizes,
  kCalls,
  kStructDecls,
  isValidArrayLengthCase,
  calculateArrayLength,
  runLengthTest,
  kLayoutCases,
  runReadLayoutTest,
  runWriteLayoutTest,
  runReadWriteTest,
} from './buffer_view_utils.js';

export const g = makeTestGroup(AllFeaturesMaxLimitsGPUTest);

g.test('array_length')
  .desc('Tests arrayLength from a bufferView')
  .params(u =>
    u
      .combine('type', keysOf(kArrayLengthTypes))
      .combine('aspace', ['workgroup', 'storage', 'uniform'] as const)
      .beginSubcases()
      .combine('sized', [false, true] as const)
      .combine('override', [false, true] as const)
      .combine('bufferSize', kBufferSizes)
      .combine('dynamic_offset', [0, 256] as const)
      .filter(t => {
        if (t.aspace === 'workgroup' && t.dynamic_offset !== 0) {
          return false;
        }
        if (t.aspace !== 'workgroup' && t.override === true) {
          return false;
        }
        return t.sized || t.aspace === 'storage';
      })
  )
  .fn(t => {
    const testcase = kArrayLengthTypes[t.params.type];
    t.skipIfLanguageFeatureNotSupported('buffer_view');
    if (t.params.aspace === 'uniform' && testcase.uniformStdLayout === true) {
      t.skipIfLanguageFeatureNotSupported('uniform_buffer_standard_layout');
    }
    if (testcase.f16) {
      t.skipIfDeviceDoesNotHaveFeature('shader-f16');
    }

    const bSize = t.params.override ? 'bufferSize' : `${t.params.bufferSize}`;
    const buffer_ty = `buffer${t.params.sized ? `<${bSize}>` : ``}`;
    let decl = '';
    switch (t.params.aspace) {
      case 'workgroup':
        decl = `var<workgroup> v : ${buffer_ty};\n@group(0) @binding(0) var<storage> dummy : array<u32>;`;
        break;
      case 'uniform':
        decl = `@group(0) @binding(0) var<uniform> v : ${buffer_ty};`;
        break;
      case 'storage':
        decl = `@group(0) @binding(0) var<storage> v : ${buffer_ty};`;
        break;
    }

    const values: number[] = [];
    const offsets: number[] = [];
    const sizes: number[] = [];
    // Limit the number of assignments.
    for (let o = 0; o < kOffsets.length; o += 2) {
      for (const size of kSizes) {
        const offset = kOffsets[o];

        // Skip any case that results in an invalid memory reference.
        // Split the writes up one per thread.
        if (isValidArrayLengthCase(testcase, offset, size, t.params.bufferSize)) {
          values.push(calculateArrayLength(testcase, offset, size, t.params.bufferSize));
          // Setup the offset and size buffer values so they can be indexed by invocation id.
          offsets.push(offset);
          sizes.push(size);
        }
      }
    }

    assert(values.length > 0, 'no tests run');

    const access = testcase.access ?? '';
    const addrOf = access === '' ? '' : '&';

    const enables = testcase.f16 === true ? 'enable f16;' : '';

    const wgsl = `
${enables}

${kStructDecls}

override bufferSize : u32 = 0u;
${decl}
@group(0) @binding(1) var<storage> offsets : array<u32>;
@group(0) @binding(2) var<storage> sizes : array<u32>; // unused
@group(0) @binding(3) var<storage, read_write> out : array<u32>;

override wgx : u32;
@compute @workgroup_size(wgx)
fn main(@builtin(global_invocation_id) gid : vec3u,
        @builtin(local_invocation_index) lid : u32) {
  ${t.params.aspace === 'workgroup' ? '_ = dummy[0];' : ''}

  if gid.x >= ${values.length} {
    return;
  }

  out[gid.x] = arrayLength(${addrOf}bufferArrayView<${
    testcase.type
  }>(&v, offsets[gid.x], sizes[gid.x])${access});
}`;

    runLengthTest(
      t,
      wgsl,
      t.params.aspace === 'uniform' ? GPUBufferUsage.UNIFORM : GPUBufferUsage.STORAGE,
      t.params.bufferSize,
      t.params.dynamic_offset,
      offsets,
      sizes,
      values
    );
  });

g.test('array_length,functions')
  .desc('Tests arrayLength from a bufferView')
  .params(u =>
    u
      .combine('type', keysOf(kArrayLengthTypes))
      .combine('aspace', ['workgroup', 'storage', 'uniform'] as const)
      .beginSubcases()
      .combine('call', kCalls)
      .combine('bufferSize', kBufferSizes)
      .combine('dynamic_offset', [0, 256] as const)
      .filter(t => {
        if (t.bufferSize === 128) {
          return false;
        }
        return t.aspace !== 'workgroup' || t.dynamic_offset === 0;
      })
  )
  .fn(t => {
    const testcase = kArrayLengthTypes[t.params.type];
    t.skipIfLanguageFeatureNotSupported('buffer_view');
    t.skipIfLanguageFeatureNotSupported('unrestricted_pointer_parameters');
    if (t.params.aspace === 'uniform' && testcase.uniformStdLayout === true) {
      t.skipIfLanguageFeatureNotSupported('uniform_buffer_standard_layout');
    }
    if (testcase.f16) {
      t.skipIfDeviceDoesNotHaveFeature('shader-f16');
    }

    const buffer_ty = `buffer<${t.params.bufferSize}>`;
    let decl = '';
    switch (t.params.aspace) {
      case 'workgroup':
        decl = `var<workgroup> v : ${buffer_ty};\n@group(0) @binding(0) var<storage> dummy : array<u32>;`;
        break;
      case 'uniform':
        decl = `@group(0) @binding(0) var<uniform> v : ${buffer_ty};`;
        break;
      case 'storage':
        decl = `@group(0) @binding(0) var<storage> v : ${buffer_ty};`;
        break;
    }

    const values: number[] = [];
    const offsets: number[] = [];
    const sizes: number[] = [];
    // Limit the number of assignments.
    for (let o = 0; o < kOffsets.length; o += 2) {
      for (const size of kSizes) {
        const offset = kOffsets[o];
        const usedSize =
          t.params.call === 'unsized' ? t.params.bufferSize : t.params.bufferSize / 2;

        // Skip any case that results in an invalid memory reference.
        // Split the writes up one per thread.
        if (isValidArrayLengthCase(testcase, offset, size, usedSize)) {
          values.push(calculateArrayLength(testcase, offset, size, usedSize));
          // Setup the offset and size buffer values so they can be indexed by invocation id.
          offsets.push(offset);
          sizes.push(size);
        }
      }
    }

    assert(values.length > 0, 'no tests run');

    const access = testcase.access ?? '';
    const addrOf = access === '' ? '' : '&';

    const enables = testcase.f16 === true ? 'enable f16;' : '';

    const wgsl = `
${enables}

${kStructDecls}

fn unsizedLength(p : ptr<${t.params.aspace}, buffer>, gidx : u32) -> u32 {
  return arrayLength(${addrOf}bufferArrayView<${
    testcase.type
  }>(p, offsets[gidx], sizes[gidx])${access});
}

fn sizedLength(p : ptr<${t.params.aspace}, buffer<${t.params.bufferSize / 2}>>, gidx : u32) -> u32 {
  return arrayLength(${addrOf}bufferArrayView<${
    testcase.type
  }>(p, offsets[gidx], sizes[gidx])${access});
}

fn sized_indirectLength(p : ptr<${t.params.aspace}, buffer<${
      t.params.bufferSize / 2
    }>>, gidx : u32) -> u32 {
  return unsizedLength(p, gidx);
}

fn sized_sized_indirectLength(p : ptr<${t.params.aspace}, buffer<${
      t.params.bufferSize
    }>>, gidx : u32) -> u32 {
  return sizedLength(p, gidx);
}

override bufferSize : u32 = 0u;
${decl}
@group(0) @binding(1) var<storage> offsets : array<u32>;
@group(0) @binding(2) var<storage> sizes : array<u32>; // unused
@group(0) @binding(3) var<storage, read_write> out : array<u32>;

override wgx : u32;
@compute @workgroup_size(wgx)
fn main(@builtin(global_invocation_id) gid : vec3u,
        @builtin(local_invocation_index) lid : u32) {
  ${t.params.aspace === 'workgroup' ? '_ = dummy[0];' : ''}

  if gid.x >= ${values.length} {
    return;
  }

  out[gid.x] = ${t.params.call}Length(&v, gid.x);
}`;

    runLengthTest(
      t,
      wgsl,
      t.params.aspace === 'uniform' ? GPUBufferUsage.UNIFORM : GPUBufferUsage.STORAGE,
      t.params.bufferSize,
      t.params.dynamic_offset,
      offsets,
      sizes,
      values
    );
  });

g.test('read_layout')
  .desc('Test reading memory layout from a bufferArrayView')
  .params(u =>
    u
      .combine('case', keysOf(kLayoutCases))
      .beginSubcases()
      .combine('aspace', ['storage', 'ro_storage', 'uniform', 'workgroup'] as const)
      .combine('offset', kOffsets)
      .filter(t => {
        const testcase = kLayoutCases[t.case];
        if ((t.offset & (testcase.align - 1)) !== 0) {
          return false;
        }
        return testcase.offset + t.offset < 252;
      })
  )
  .fn(t => {
    const testcase = kLayoutCases[t.params.case];
    t.skipIfLanguageFeatureNotSupported('buffer_view');
    if (t.params.aspace === 'uniform') {
      if (testcase.uniformStdLayoutArrayView === true || testcase.uniformStdLayoutView === true) {
        t.skipIfLanguageFeatureNotSupported('uniform_buffer_standard_layout');
      }
    }
    if (testcase.f16) {
      t.skipIfDeviceDoesNotHaveFeature('shader-f16');
    }

    const enables = testcase.f16 === true ? 'enable f16;' : '';
    const v = t.params.aspace === 'workgroup' ? 'wg_var' : 'in';

    const wgsl = `
${enables}

${testcase.decl ?? ''}

@group(0) @binding(0)
var<${t.params.aspace === 'uniform' ? 'uniform' : 'storage'}${
      t.params.aspace === 'storage' ? ', read_write' : ''
    }> in : buffer<256 * 4>;

@group(0) @binding(1) var<storage, read_write> out : u32;

var<workgroup> wg_var : buffer<256 * 4>;

@compute @workgroup_size(1)
fn main() {
  let in_ptr = bufferView<array<vec4u, 256 / 4>>(&in, 0);
  let wg_ptr = bufferView<array<vec4u, 256 / 4>>(&wg_var, 0);
  for (var i = 0; i < 256 / 4; i++) {
    (*wg_ptr)[i] = (*in_ptr)[i];
  }

  workgroupBarrier();

  let p = bufferArrayView<array<${testcase.type}>>(&${v}, ${
    t.params.offset
  }, bufferLength(&${v}) - ${t.params.offset});
  out = u32((*p)[0]${testcase.access});
}
`;

    runReadLayoutTest(t, testcase, wgsl, t.params.aspace, t.params.offset);
  });

g.test('write_layout')
  .desc('Test writing memory layout via a bufferView')
  .params(u =>
    u
      .combine('case', keysOf(kLayoutCases))
      .beginSubcases()
      .combine('assign', ['let', 'call'] as const)
      .combine('aspace', ['storage', 'workgroup'] as const)
      .combine('offset', kOffsets)
      .filter(t => {
        const testcase = kLayoutCases[t.case];
        if ((t.offset & (testcase.align - 1)) !== 0) {
          return false;
        }
        return testcase.offset + t.offset < 252;
      })
  )
  .fn(t => {
    const testcase = kLayoutCases[t.params.case];
    t.skipIfLanguageFeatureNotSupported('buffer_view');
    if (testcase.f16) {
      t.skipIfDeviceDoesNotHaveFeature('shader-f16');
    }

    const enables = testcase.f16 === true ? 'enable f16;' : '';
    const v = t.params.aspace === 'workgroup' ? 'wg_var' : 'out';
    const call_expr = `bufferArrayView<array<${testcase.type}>>(&${v}, ${t.params.offset}, bufferLength(&${v}) - ${t.params.offset})`;

    let post_assign = '';
    if (t.params.aspace === 'workgroup') {
      post_assign = `
  workgroupBarrier();

  let out_ptr = bufferView<array<u32>>(&out, 0);
  let wg_ptr = bufferView<array<u32>>(&wg_var, 0);
  for (var i = 0; i < 256; i++) {
    (*out_ptr)[i] = (*wg_ptr)[i];
  }
`;
    }

    const wgsl = `
${enables}

${testcase.decl ?? ''}

@group(0) @binding(0) var<storage> in : u32;
@group(0) @binding(1) var<storage, read_write> out : buffer<256 * 4>;


var<workgroup> wg_var : buffer<256 * 4>;

@compute @workgroup_size(1)
fn main() {
  let val = ${testcase.f16 ? 'f16' : testcase.f32 ? 'f32' : 'u32'}(in);
  let ptr = ${call_expr};
  (*${t.params.assign === 'call' ? call_expr : 'ptr'})[0]${testcase.access} = val;

  ${post_assign}
}
`;

    runWriteLayoutTest(t, testcase, wgsl, t.params.offset);
  });

g.test('read')
  .desc('Test reading various types from bufferArrayView')
  .params(u =>
    u
      .combine('base_type', ['u32', 'i32', 'f32', 'f16'] as const)
      .beginSubcases()
      .combine('wrap', ['none', 'vector', 'array', 'matrix'] as const)
      .combine('width', [1, 2, 3, 4] as const)
      .combine('aspace', ['workgroup', 'storage', 'ro_storage', 'uniform'] as const)
      .combine('offset', [0, 4, 8, 12, 16, 32, 48, 64] as const)
      .filter(t => {
        if (t.wrap !== 'none' && t.width === 1) {
          return false;
        }
        if (t.wrap === 'none' && t.width !== 1) {
          return false;
        }
        if (t.wrap === 'matrix' && t.base_type !== 'f32' && t.base_type !== 'f16') {
          return false;
        }
        if (t.aspace === 'uniform' && t.wrap === 'array') {
          return false;
        }
        const ty = Type[t.base_type];
        let align = ty.alignment;
        switch (t.wrap) {
          case 'vector':
            align = Type.vec(t.width, ty).alignment;
            break;
          case 'array':
            align = Type.array(2, ty).alignment;
            break;
          case 'matrix':
            align = Type.mat(t.width, 2, ty).alignment;
            break;
          case 'none':
            break;
        }
        if (t.offset % align !== 0) {
          return false;
        }
        if (t.aspace === 'uniform' && align % 16 !== 0) {
          return false;
        }
        return true;
      })
  )
  .fn(t => {
    t.skipIfLanguageFeatureNotSupported('buffer_view');
    if (t.params.base_type === 'f16') {
      t.skipIfDeviceDoesNotHaveFeature('shader-f16');
    }

    const ele_ty = Type[t.params.base_type];
    let ty: Type = ele_ty;
    switch (t.params.wrap) {
      case 'vector':
        ty = Type.vec(t.params.width, ele_ty);
        break;
      case 'array':
        ty = Type.array(t.params.width, ele_ty);
        break;
      case 'matrix':
        ty = Type.mat(t.params.width, 2, ele_ty);
        break;
      case 'none':
        break;
    }

    const bufferSize = 128;
    const enables = t.params.base_type === 'f16' ? 'enable f16;' : '';
    const v = t.params.aspace === 'workgroup' ? 'wg_var' : 'in';
    const wgsl = `
${enables}


@group(0) @binding(0)
var<${t.params.aspace === 'uniform' ? 'uniform' : 'storage'}${
      t.params.aspace === 'storage' ? ', read_write' : ''
    }> in : buffer<${bufferSize}>;

@group(0) @binding(1) var<storage, read_write> out : ${ty.toString()};

var<workgroup> wg_var : buffer<${bufferSize}>;

@compute @workgroup_size(1)
fn main() {
  let in_ptr = bufferView<array<vec4u, ${bufferSize} / 16>>(&in, 0);
  let wg_ptr = bufferView<array<vec4u, ${bufferSize} / 16>>(&wg_var, 0);
  for (var i = 0; i < 256 / 4; i++) {
    (*wg_ptr)[i] = (*in_ptr)[i];
  }

  workgroupBarrier();

  let p = bufferArrayView<array<${ty.toString()}>>(&${v}, ${
    t.params.offset
  }, bufferLength(&${v}) - ${t.params.offset});
  out = (*p)[0];
}
`;

    runReadWriteTest(true, t, wgsl, ele_ty, ty, t.params.aspace, t.params.offset, bufferSize);
  });

g.test('write')
  .desc('Test writing various types via bufferArrayView')
  .params(u =>
    u
      .combine('base_type', ['u32', 'i32', 'f32', 'f16'] as const)
      .beginSubcases()
      .combine('wrap', ['none', 'vector', 'array', 'matrix'] as const)
      .combine('width', [1, 2, 3, 4] as const)
      .combine('aspace', ['workgroup', 'storage'] as const)
      .combine('offset', [0, 4, 8, 12, 16, 32, 48, 64] as const)
      .combine('assign', ['let', 'call'] as const)
      .combine('swizzle', [false, true] as const)
      .filter(t => {
        if (t.wrap !== 'none' && t.width === 1) {
          return false;
        }
        if (t.wrap === 'none' && t.width !== 1) {
          return false;
        }
        if (t.wrap === 'matrix' && t.base_type !== 'f32' && t.base_type !== 'f16') {
          return false;
        }
        if (t.wrap !== 'vector' && t.swizzle) {
          return false;
        }
        const ty = Type[t.base_type];
        let align = ty.alignment;
        switch (t.wrap) {
          case 'vector':
            align = Type.vec(t.width, ty).alignment;
            break;
          case 'array':
            align = Type.array(2, ty).alignment;
            break;
          case 'matrix':
            align = Type.mat(t.width, 2, ty).alignment;
            break;
          case 'none':
            break;
        }
        if (t.offset % align !== 0) {
          return false;
        }
        return true;
      })
  )
  .fn(t => {
    t.skipIfLanguageFeatureNotSupported('buffer_view');
    if (t.params.base_type === 'f16') {
      t.skipIfDeviceDoesNotHaveFeature('shader-f16');
    }
    if (t.params.swizzle) {
      t.skipIfLanguageFeatureNotSupported('swizzle_assignment');
    }

    let swizzle = '';
    const ele_ty = Type[t.params.base_type];
    let ty: Type = ele_ty;
    switch (t.params.wrap) {
      case 'vector':
        ty = Type.vec(t.params.width, ele_ty);
        if (t.params.swizzle) {
          swizzle = '.xyzw'.substring(0, 1 + t.params.width);
        }
        break;
      case 'array':
        ty = Type.array(t.params.width, ele_ty);
        break;
      case 'matrix':
        ty = Type.mat(t.params.width, 2, ele_ty);
        break;
      case 'none':
        break;
    }

    const bufferSize = 128;
    const enables = t.params.base_type === 'f16' ? 'enable f16;' : '';
    const v = t.params.aspace === 'workgroup' ? 'wg_var' : 'out';

    let post_assign = '';
    if (t.params.aspace === 'workgroup') {
      post_assign = `
  workgroupBarrier();

  let out_ptr = bufferView<array<u32>>(&out, 0);
  let wg_ptr = bufferView<array<u32>>(&wg_var, 0);
  for (var i = 0; i < 256; i++) {
    (*out_ptr)[i] = (*wg_ptr)[i];
  }
`;
    }

    const call_expr = `bufferArrayView<array<${ty.toString()}>>(&${v}, ${
      t.params.offset
    }, bufferLength(&${v}) - ${t.params.offset})`;
    const wgsl = `
${enables}

@group(0) @binding(0) var<storage> in : ${ty.toString()};
@group(0) @binding(1) var<storage, read_write> out : buffer<${bufferSize}>;


var<workgroup> wg_var : buffer<${bufferSize}>;

@compute @workgroup_size(1)
fn main() {
  let ptr = ${call_expr};
  (*${t.params.assign === 'call' ? call_expr : 'ptr'})[0]${swizzle} = in;

  ${post_assign}
}
`;

    runReadWriteTest(false, t, wgsl, ele_ty, ty, t.params.aspace, t.params.offset, bufferSize);
  });
