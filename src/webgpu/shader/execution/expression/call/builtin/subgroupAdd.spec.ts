export const description = `
Execution tests for subgroupAdd and subgroupExclusiveAdd

Note: There is a lack of portability for non-uniform execution so these tests
restrict themselves to uniform control flow.
Note: There is no guaranteed mapping between subgroup_invocation_id and
local_invocation_index. Tests should avoid assuming there is.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { keysOf, objectsToRecord } from '../../../../../../common/util/data_tables.js';
import { iterRange } from '../../../../../../common/util/util.js';
import { Float16Array } from '../../../../../../external/petamoriken/float16/float16.js';
import { GPUTest } from '../../../../../gpu_test.js';
import {
  kConcreteNumericScalarsAndVectors,
  Type,
  VectorType,
  numberToFloatBits,
  floatBitsToNumber,
  kFloat32Format,
  kFloat16Format,
  scalarTypeOf,
} from '../../../../../util/conversion.js';
import { FP } from '../../../../../util/floating_point.js';
import { sparseScalarF16Range, sparseScalarF32Range } from '../../../../../util/math.js';
import { PRNG } from '../../../../../util/prng.js';

export const g = makeTestGroup(GPUTest);

const kStride = 128;
const kNumCases = 1000;
const kIdentity = 0;

const kDataTypes = objectsToRecord(kConcreteNumericScalarsAndVectors);

/**
 * Check the accuracy of the reduction operation.
 *
 * @param metadata An array containing subgroup size at index 0 and
 *                 subgroup ids for each invocation in subsequent indices
 * @param output An array containing the results of the reduction for each invocation
 * @param indices An of two values containing the indices of the interesting values in the input
 * @param values An of two values containing the interesting values in the input
 */
function checkAccuracy(
  metadata: Uint32Array,
  output: Float32Array | Float16Array,
  indices: number[],
  values: number[],
  type: 'f16' | 'f32'
): undefined | Error {
  const subgroupIdIdx1 = metadata[1 + indices[0]];
  const subgroupIdIdx2 = metadata[1 + indices[1]];
  for (let i = 0; i < output.length; i++) {
    const subgroupId = metadata[1 + i];

    const v1 = subgroupId === subgroupIdIdx1 ? values[0] : kIdentity;
    const v2 = subgroupId === subgroupIdIdx2 ? values[1] : kIdentity;
    const interval =
      type === 'f16' ? FP.f16.additionInterval(v1, v2) : FP.f32.additionInterval(v1, v2);
    if (!interval.contains(output[i])) {
      return new Error(`Invocation ${i}, subgroup id ${subgroupId}: incorrect result
- interval: ${interval.toString()}
- output: ${output[i]}`);
    }
  }

  return undefined;
}

g.test('fp_accuracy')
  .desc(
    `Tests the accuracy of floating-point addition.

The order of operations is implementation defined, most threads are filled with
the identity value and two receive random values.
Subgroup sizes are not known ahead of time so some cases may not perform any
interesting operations. The test biases towards checking subgroup sizes under 64.`
  )
  .params(u =>
    u
      .combine('case', [...iterRange(kNumCases, x => x)])
      .combine('type', ['f32', 'f16'] as const)
      .combine('wgSize', [
        [kStride, 1, 1],
        [kStride / 2, 2, 1],
      ] as const)
  )
  .beforeAllSubcases(t => {
    const features: GPUFeatureName[] = ['subgroups' as GPUFeatureName];
    if (t.params.type === 'f16') {
      features.push('shader-f16');
      features.push('subgroups-f16' as GPUFeatureName);
    }
    t.selectDeviceOrSkipTestCase(features);
  })
  .fn(async t => {
    const prng = new PRNG(t.params.case);

    // Compatibility mode has lower workgroup limits.
    const wgThreads = t.params.wgSize[0] * t.params.wgSize[1] * t.params.wgSize[2];
    const {
      maxComputeInvocationsPerWorkgroup,
      maxComputeWorkgroupSizeX,
      maxComputeWorkgroupSizeY,
      maxComputeWorkgroupSizeZ,
    } = t.device.limits;
    t.skipIf(
      maxComputeInvocationsPerWorkgroup < wgThreads ||
        maxComputeWorkgroupSizeX < t.params.wgSize[0] ||
        maxComputeWorkgroupSizeY < t.params.wgSize[1] ||
        maxComputeWorkgroupSizeZ < t.params.wgSize[2],
      'Workgroup size too large'
    );

    // Bias half the cases to lower indices since most subgroup sizes are <= 64.
    let indexLimit = kStride;
    if (t.params.case < kNumCases / 4) {
      indexLimit = 16;
    } else if (t.params.case < kNumCases / 2) {
      indexLimit = 64;
    }

    // Ensure two distinct indices are picked.
    const idx1 = prng.uniformInt(indexLimit);
    let idx2 = prng.uniformInt(indexLimit - 1);
    if (idx1 === idx2) {
      idx2++;
    }

    // Select two random values.
    const range = t.params.type === 'f16' ? sparseScalarF16Range() : sparseScalarF32Range();
    const numVals = range.length;
    const val1 = range[prng.uniformInt(numVals)];
    const val2 = range[prng.uniformInt(numVals)];

    const extraEnables = t.params.type === 'f16' ? `enable f16;\nenable subgroups_f16;` : ``;
    const wgsl = `
enable subgroups;
${extraEnables}

@group(0) @binding(0)
var<storage> inputs : array<${t.params.type}>;

@group(0) @binding(1)
var<storage, read_write> outputs : array<${t.params.type}>;

struct Metadata {
  subgroupSize : u32,
  subgroup_id : array<u32, ${kStride}>,
}

@group(0) @binding(2)
var<storage, read_write> metadata : Metadata;

@compute @workgroup_size(${t.params.wgSize[0]}, ${t.params.wgSize[1]}, ${t.params.wgSize[2]})
fn main(
  @builtin(local_invocation_index) lid : u32,
  @builtin(subgroup_size) sg_size : u32,
) {
  if (lid == 0) {
    metadata.subgroupSize = sg_size;
  }
  metadata.subgroup_id[lid] = subgroupBroadcast(lid, 0);
  outputs[lid] = subgroupAdd(inputs[lid]);
}`;

    const inputData =
      t.params.type === 'f16'
        ? new Float16Array([
            ...iterRange(kStride, x => {
              if (x === idx1) return val1;
              if (x === idx2) return val2;
              return kIdentity;
            }),
          ])
        : new Float32Array([
            ...iterRange(kStride, x => {
              if (x === idx1) return val1;
              if (x === idx2) return val2;
              return kIdentity;
            }),
          ]);

    const inputBuffer = t.makeBufferWithContents(
      inputData,
      GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    );
    t.trackForCleanup(inputBuffer);

    const outputBuffer = t.makeBufferWithContents(
      new Float32Array([...iterRange(kStride, x => 0)]),
      GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    );
    t.trackForCleanup(outputBuffer);

    const numMetadata = 1 + kStride;
    const metadataBuffer = t.makeBufferWithContents(
      new Uint32Array([...iterRange(numMetadata, x => 0)]),
      GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    );

    const pipeline = t.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: t.device.createShaderModule({
          code: wgsl,
        }),
        entryPoint: 'main',
      },
    });
    const bg = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: inputBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: outputBuffer,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: metadataBuffer,
          },
        },
      ],
    });

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(1, 1, 1);
    pass.end();
    t.queue.submit([encoder.finish()]);

    const metadataReadback = await t.readGPUBufferRangeTyped(metadataBuffer, {
      srcByteOffset: 0,
      type: Uint32Array,
      typedLength: numMetadata,
      method: 'copy',
    });
    const metadata = metadataReadback.data;

    let output: Float16Array | Float32Array;
    if (t.params.type === 'f16') {
      const outputReadback = await t.readGPUBufferRangeTyped(outputBuffer, {
        srcByteOffset: 0,
        type: Float16Array,
        typedLength: kStride,
        method: 'copy',
      });
      output = outputReadback.data;
    } else {
      const outputReadback = await t.readGPUBufferRangeTyped(outputBuffer, {
        srcByteOffset: 0,
        type: Float32Array,
        typedLength: kStride,
        method: 'copy',
      });
      output = outputReadback.data;
    }

    t.expectOK(checkAccuracy(metadata, output, [idx1, idx2], [val1, val2], t.params.type));
  });

const kWGSizes = [
  [4, 1, 1],
  [8, 1, 1],
  [16, 1, 1],
  [32, 1, 1],
  [64, 1, 1],
  [128, 1, 1],
  [256, 1, 1],
  [1, 4, 1],
  [1, 8, 1],
  [1, 16, 1],
  [1, 32, 1],
  [1, 64, 1],
  [1, 128, 1],
  [1, 256, 1],
  [1, 1, 4],
  [1, 1, 8],
  [1, 1, 16],
  [1, 1, 32],
  [1, 1, 64],
  [3, 3, 3],
  [4, 4, 4],
  [16, 16, 1],
  [16, 1, 16],
  [1, 16, 16],
  [15, 3, 3],
  [3, 15, 3],
  [3, 3, 15],
] as const;

/**
 * Checks reduce add
 *
 * Each invocation should have result equal to its actual subgroup size.
 * @param metadata Array containing actual subgroup size per invocation followed by
 *                 subgroup invocation id per invocation
 * @param output Array of additions
 */
function checkReduction(metadata: Uint32Array, output: Uint32Array, type: Type): undefined | Error {
  let numEles = 1;
  if (type instanceof VectorType) {
    numEles = type.width;
  }
  const scalarTy = scalarTypeOf(type);
  for (let i = 0; i < metadata.length / 2; i++) {
    const size = metadata[i];
    for (let j = 0; j < numEles; j++) {
      let idx = i * numEles + j;
      if (scalarTy === Type.f16) {
        idx = Math.floor(idx / 2);
      }
      let val = output[idx];
      if (scalarTy === Type.f32) {
        val = floatBitsToNumber(val, kFloat32Format);
      } else if (scalarTy === Type.f16) {
        if (j & 0x1) {
          val = val >> 16;
        }
        val = floatBitsToNumber(val & 0xffff, kFloat16Format);
      }
      if (size !== val) {
        return new Error(`Invocation ${i}, component ${j}: incorrect result
- expected: ${size}
-      got: ${val}`);
      }
    }
  }

  return undefined;
}

/**
 * Checks exclusive-scan add
 *
 * Each invocation should have result equal to its subgroup invocation id.
 * @param metadata Array containing actual subgroup size per invocation followed by
 *                 subgroup invocation id per invocation
 * @param output Array of additions
 */
function checkExclusiveScan(
  metadata: Uint32Array,
  output: Uint32Array,
  type: Type
): undefined | Error {
  let numEles = 1;
  if (type instanceof VectorType) {
    numEles = type.width;
  }
  const scalarTy = scalarTypeOf(type);
  for (let i = 0; i < metadata.length / 2; i++) {
    const invocation = metadata[i + metadata.length / 2];
    for (let j = 0; j < numEles; j++) {
      let idx = i * numEles + j;
      const isOdd = idx & 0x1;
      if (scalarTy === Type.f16) {
        idx = Math.floor(idx / 2);
      }
      let val = output[idx];
      if (scalarTy === Type.f32) {
        val = floatBitsToNumber(val, kFloat32Format);
      } else if (scalarTy === Type.f16) {
        if (isOdd) {
          val = val >> 16;
        }
        val = floatBitsToNumber(val & 0xffff, kFloat16Format);
      }
      if (invocation !== val) {
        return new Error(`Invocation ${i}, component ${j}: incorrect result
- expected: ${invocation}
-      got: ${val}`);
      }
    }
  }

  return undefined;
}

g.test('data_types')
  .desc(
    `Tests subgroup addition for valid data types

Tests a simple addition of all 1 values.
Reductions expect result to be equal to actual subgroup size.
Exclusice scans expect result to be equal subgroup invocation id.
  `
  )
  .params(u =>
    u
      .combine('type', keysOf(kDataTypes))
      .filter(t => {
        // Skip vec3 for simplicity
        const type = kDataTypes[t.type];
        if (type instanceof VectorType) {
          return type.width !== 3;
        }
        return true;
      })
      .beginSubcases()
      .combine('wgSize', kWGSizes)
      .combine('operation', ['reduction', 'exclusive-scan'] as const)
  )
  .beforeAllSubcases(t => {
    const features: GPUFeatureName[] = ['subgroups' as GPUFeatureName];
    const type = kDataTypes[t.params.type];
    if (type.requiresF16()) {
      features.push('shader-f16');
      features.push('subgroups-f16' as GPUFeatureName);
    }
    t.selectDeviceOrSkipTestCase(features);
  })
  .fn(async t => {
    const type = kDataTypes[t.params.type];
    let numEles = 1;
    if (type instanceof VectorType) {
      numEles = type.width;
    }
    const scalarType = scalarTypeOf(type);
    let enables = 'enable subgroups;\n';
    if (type.requiresF16()) {
      enables += 'enable f16;\nenable subgroups_f16;\n';
    }

    // Compatibility mode has lower workgroup limits.
    const wgThreads = t.params.wgSize[0] * t.params.wgSize[1] * t.params.wgSize[2];
    const {
      maxComputeInvocationsPerWorkgroup,
      maxComputeWorkgroupSizeX,
      maxComputeWorkgroupSizeY,
      maxComputeWorkgroupSizeZ,
    } = t.device.limits;
    t.skipIf(
      maxComputeInvocationsPerWorkgroup < wgThreads ||
        maxComputeWorkgroupSizeX < t.params.wgSize[0] ||
        maxComputeWorkgroupSizeY < t.params.wgSize[1] ||
        maxComputeWorkgroupSizeZ < t.params.wgSize[2],
      'Workgroup size too large'
    );

    const op = t.params.operation === 'reduction' ? 'subgroupAdd' : 'subgroupExclusiveAdd';

    const wgsl = `
${enables}

@group(0) @binding(0)
var<storage> inputs : array<${type.toString()}>;

@group(0) @binding(1)
var<storage, read_write> outputs : array<${type.toString()}>;

struct Metadata {
  subgroup_size : array<u32, ${wgThreads}>,
  subgroup_invocation_id : array<u32, ${wgThreads}>,
}

@group(0) @binding(2)
var<storage, read_write> metadata : Metadata;

@compute @workgroup_size(${t.params.wgSize[0]}, ${t.params.wgSize[1]}, ${t.params.wgSize[2]})
fn main(
  @builtin(local_invocation_index) lid : u32,
  @builtin(subgroup_invocation_id) id : u32,
) {
  // Record the actual subgroup size for this invocation.
  // Note: subgroup_size builtin is always a power-of-2 and might be larger
  // if the subgroup is not full.
  let ballot = subgroupBallot(true);
  var size = countOneBits(ballot.x);
  size += countOneBits(ballot.y);
  size += countOneBits(ballot.z);
  size += countOneBits(ballot.w);
  metadata.subgroup_size[lid] = size;

  // Record subgroup invocation id for this invocation.
  metadata.subgroup_invocation_id[lid] = id;

  outputs[lid] = ${op}(inputs[lid]);
}`;

    let fillValue = 1;
    let numUints = wgThreads * numEles;
    if (scalarType === Type.f32) {
      fillValue = numberToFloatBits(1, kFloat32Format);
    } else if (scalarType === Type.f16) {
      const f16 = numberToFloatBits(1, kFloat16Format);
      fillValue = f16 | (f16 << 16);
      numUints = Math.ceil(numUints / 2);
    }

    const inputBuffer = t.makeBufferWithContents(
      new Uint32Array([...iterRange(numUints, x => fillValue)]),
      GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    );
    t.trackForCleanup(inputBuffer);

    const outputBuffer = t.makeBufferWithContents(
      new Uint32Array([...iterRange(numUints, x => 0)]),
      GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    );
    t.trackForCleanup(outputBuffer);

    const numMetadata = 2 * wgThreads;
    const metadataBuffer = t.makeBufferWithContents(
      new Uint32Array([...iterRange(numMetadata, x => 0)]),
      GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    );

    const pipeline = t.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: t.device.createShaderModule({
          code: wgsl,
        }),
        entryPoint: 'main',
      },
    });
    const bg = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: inputBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: outputBuffer,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: metadataBuffer,
          },
        },
      ],
    });

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(1, 1, 1);
    pass.end();
    t.queue.submit([encoder.finish()]);

    const metadataReadback = await t.readGPUBufferRangeTyped(metadataBuffer, {
      srcByteOffset: 0,
      type: Uint32Array,
      typedLength: numMetadata,
      method: 'copy',
    });
    const metadata = metadataReadback.data;

    const outputReadback = await t.readGPUBufferRangeTyped(outputBuffer, {
      srcByteOffset: 0,
      type: Uint32Array,
      typedLength: numUints,
      method: 'copy',
    });
    const output = outputReadback.data;

    if (t.params.operation === 'reduction') {
      t.expectOK(checkReduction(metadata, output, type));
    } else {
      t.expectOK(checkExclusiveScan(metadata, output, type));
    }
  });

g.test('fragment').unimplemented();
