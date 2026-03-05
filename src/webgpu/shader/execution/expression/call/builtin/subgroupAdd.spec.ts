export const description = `
Execution tests for subgroupAdd, subgroupExclusiveAdd, and subgroupInclusiveAdd

Note: There is a lack of portability for non-uniform execution so these tests
restrict themselves to uniform control flow.
Note: There is no guaranteed mapping between subgroup_invocation_id and
local_invocation_index. Tests should avoid assuming there is.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { keysOf, objectsToRecord } from '../../../../../../common/util/data_tables.js';
import { iterRange } from '../../../../../../common/util/util.js';
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

import {
  idFromQuadId,
  kDataSentinel,
  kNumCases,
  kStride,
  kWGSizes,
  kPredicateCases,
  runAccuracyTest,
  runComputeTest,
  SubgroupTest,
  runFragmentTest,
  getUintsPerFramebuffer,
  kFramebufferSizes,
} from './subgroup_util.js';

export const g = makeTestGroup(SubgroupTest);

const kIdentity = 0;

const kDataTypes = objectsToRecord(kConcreteNumericScalarsAndVectors);

type Op = 'subgroupAdd' | 'subgroupInclusiveAdd' | 'subgroupExclusiveAdd';

const kOperations: Op[] = ['subgroupAdd', 'subgroupExclusiveAdd', 'subgroupInclusiveAdd'];

g.test('fp_accuracy')
  .desc(
    `Tests the accuracy of floating-point addition.

The order of operations is implementation defined, most threads are filled with
the identity value and two receive random values.
Subgroup sizes are not known ahead of time so some cases may not perform any
interesting operations. The test biases towards checking subgroup sizes under 64.
These tests only check two values in order to reuse more of the existing infrastructure
and limit the number of permutations needed to calculate the final result.`
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
  .fn(async t => {
    t.skipIfDeviceDoesNotHaveFeature('subgroups' as GPUFeatureName);
    if (t.params.type === 'f16') {
      t.skipIfDeviceDoesNotHaveFeature('shader-f16');
    }

    await runAccuracyTest(
      t,
      t.params.case,
      [t.params.wgSize[0], t.params.wgSize[1], t.params.wgSize[2]],
      'subgroupAdd',
      t.params.type,
      kIdentity,
      t.params.type === 'f16' ? FP.f16.additionInterval : FP.f32.additionInterval
    );
  });

/**
 * Checks subgroup additions
 *
 * Expected results:
 * - subgroupAdd: each invocation should have result equal to real subgroup size
 * - subgroupExclusiveAdd: each invocation should have result equal to its subgroup invocation id
 * - subgroupInclusiveAdd: each invocation should be equal to the result of subgroupExclusiveAdd plus the fill value
 * @param metadata An array containing actual subgroup size per invocation followed by
 *                 subgroup invocation id per invocation
 * @param output An array of additions
 * @param type The data type
 * @param operation Type of addition
 * @param expectedfillValue The original value used to fill the test array
 */
function checkAddition(
  metadata: Uint32Array,
  output: Uint32Array,
  type: Type,
  operation: Op,
  expectedfillValue: number
): undefined | Error {
  let numEles = 1;
  if (type instanceof VectorType) {
    numEles = type.width;
  }
  const scalarTy = scalarTypeOf(type);
  const expectedOffset = operation === 'subgroupAdd' ? 0 : metadata.length / 2;
  for (let i = 0; i < metadata.length / 2; i++) {
    let expected = metadata[i + expectedOffset];
    if (operation === 'subgroupInclusiveAdd') {
      expected += expectedfillValue;
    }

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
      if (expected !== val) {
        return new Error(`Invocation ${i}, component ${j}: incorrect result
- expected: ${expected}
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

TODO: support vec3 types.
  `
  )
  .params(u =>
    u
      .combine('type', keysOf(kDataTypes))
      .filter(t => {
        const type = kDataTypes[t.type];
        if (type instanceof VectorType) {
          return type.width !== 3;
        }
        return true;
      })
      .beginSubcases()
      .combine('wgSize', kWGSizes)
      .combine('operation', kOperations)
  )
  .fn(async t => {
    t.skipIfDeviceDoesNotHaveFeature('subgroups' as GPUFeatureName);
    const type = kDataTypes[t.params.type];
    if (type.requiresF16()) {
      t.skipIfDeviceDoesNotHaveFeature('shader-f16');
    }
    let numEles = 1;
    if (type instanceof VectorType) {
      numEles = type.width;
    }
    const scalarType = scalarTypeOf(type);
    let enables = 'enable subgroups;\n';
    if (type.requiresF16()) {
      enables += 'enable f16;\n';
    }

    const wgThreads = t.params.wgSize[0] * t.params.wgSize[1] * t.params.wgSize[2];

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

  outputs[lid] = ${t.params.operation}(inputs[lid]);
}`;
    const expectedFillValue = 1;
    let fillValue = expectedFillValue;
    let numUints = wgThreads * numEles;
    if (scalarType === Type.f32) {
      fillValue = numberToFloatBits(1, kFloat32Format);
    } else if (scalarType === Type.f16) {
      const f16 = numberToFloatBits(1, kFloat16Format);
      fillValue = f16 | (f16 << 16);
      numUints = Math.ceil(numUints / 2);
    }
    await runComputeTest(
      t,
      wgsl,
      [t.params.wgSize[0], t.params.wgSize[1], t.params.wgSize[2]],
      numUints,
      new Uint32Array([...iterRange(numUints, x => fillValue)]),
      (metadata: Uint32Array, output: Uint32Array) => {
        return checkAddition(metadata, output, type, t.params.operation, expectedFillValue);
      }
    );
  });

/**
 * Performs correctness checking for predicated additions
 *
 * Assumes the shader performs a predicated subgroup addition with the
 * subgroup_invocation_id as the data.
 *
 * @param metadata An array containing subgroup sizes and subgroup invocation ids
 * @param output An array containing the output results
 * @param operation The type of addition
 * @param filter A functor that mirrors the predication in the shader
 */
function checkPredicatedAddition(
  metadata: Uint32Array,
  output: Uint32Array,
  operation: Op,
  filter: (id: number, size: number) => boolean
): Error | undefined {
  for (let i = 0; i < output.length; i++) {
    const size = metadata[i];
    const id = metadata[output.length + i];
    let expected = 0;
    if (filter(id, size)) {
      const bound =
        operation === 'subgroupInclusiveAdd' ? id + 1 : operation === 'subgroupAdd' ? size : id;
      for (let j = 0; j < bound; j++) {
        if (filter(j, size)) {
          expected += j;
        }
      }
    } else {
      expected = kDataSentinel;
    }
    if (expected !== output[i]) {
      return new Error(`Invocation ${i}: incorrect result
- expected: ${expected}
-      got: ${output[i]}`);
    }
  }
  return undefined;
}

g.test('compute,split')
  .desc('Tests that only active invocations contribute to the operation')
  .params(u =>
    u
      .combine('case', keysOf(kPredicateCases))
      .beginSubcases()
      .combine('operation', kOperations)
      .combine('wgSize', kWGSizes)
  )
  .fn(async t => {
    t.skipIfDeviceDoesNotHaveFeature('subgroups' as GPUFeatureName);
    const testcase = kPredicateCases[t.params.case];
    const outputUintsPerElement = 1;
    const inputData = new Uint32Array([0]); // no input data
    const wgThreads = t.params.wgSize[0] * t.params.wgSize[1] * t.params.wgSize[2];

    const wgsl = `
enable subgroups;

diagnostic(off, subgroup_uniformity);

@group(0) @binding(0)
var<storage> input : array<u32>;

@group(0) @binding(1)
var<storage, read_write> outputs : array<u32>;

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
  _ = input[0];

  // Record the actual subgroup size for this invocation.
  // Note: subgroup_size builtin is always a power-of-2 and might be larger
  // if the subgroup is not full.
  let ballot = subgroupBallot(true);
  var subgroupSize = countOneBits(ballot.x);
  subgroupSize += countOneBits(ballot.y);
  subgroupSize += countOneBits(ballot.z);
  subgroupSize += countOneBits(ballot.w);
  metadata.subgroup_size[lid] = subgroupSize;

  // Record subgroup invocation id for this invocation.
  metadata.subgroup_invocation_id[lid] = id;

  if ${testcase.cond} {
    outputs[lid] = ${t.params.operation}(id);
  } else {
    return;
  }
}`;

    await runComputeTest(
      t,
      wgsl,
      [t.params.wgSize[0], t.params.wgSize[1], t.params.wgSize[2]],
      outputUintsPerElement,
      inputData,
      (metadata: Uint32Array, output: Uint32Array) => {
        return checkPredicatedAddition(metadata, output, t.params.operation, testcase.filter);
      }
    );
  });

// Max subgroup size is 128.
const kMaxSize = 128;

interface Coord {
  row: number;
  col: number;
}

/**
 * Checks subgroup addition results in fragment shaders
 *
 * @param data The framebuffer results
 *             * Component 0 is the addition result
 *             * Component 1 is the subgroup_invocation_id
 *             * Component 2 is a unique generated subgroup_id
 *             * Component 3 is the quad invocation id
 * @param op The type of subgroup addition
 * @param format The framebuffer format
 * @param width The framebuffer width
 * @param height The framebuffer height
 */
function checkFragment(
  data: Uint32Array,
  op: Op,
  format: GPUTextureFormat,
  width: number,
  height: number
): Error | undefined {
  const { uintsPerRow, uintsPerTexel } = getUintsPerFramebuffer(format, width, height);

  // First collect each subgroups pixels.
  const subgroupMapping = new Map<number, Array<Coord>>();
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const offset = uintsPerRow * row + col * uintsPerTexel;
      const subgroup_id = data[offset + 2];
      if (subgroup_id === 0) {
        return new Error(`Internal error: no subgroup id at (${col}, ${row})`);
      }

      const subgroup = subgroupMapping.get(subgroup_id) ?? new Array<Coord>();
      subgroup.push({ row, col });
      subgroupMapping.set(subgroup_id, subgroup);
    }
  }

  // We need to calculate with and without helpers until we can determine
  // whether or not the implementation includes helper invocations in subgroup
  // operations.
  let includeHelpers: boolean | undefined = undefined;
  for (const [_, coords] of subgroupMapping) {
    const noHelpersExpected = new Uint32Array([...iterRange(kMaxSize, x => kIdentity)]);
    const helpersExpected = new Uint32Array([...iterRange(kMaxSize, x => kIdentity)]);

    // Initialize a grid to track used coordinates. It will be updated with
    // helper invocations as needed.
    const grid = new Uint32Array([...iterRange((width + 1) * (height + 1), x => 0)]);
    for (const coord of coords) {
      // Note: the grid has a different linearity.
      grid[coord.row * (width + 1) + coord.col] = 1;
    }

    let hasHelpers: boolean = false;
    for (const coord of coords) {
      const offset = uintsPerRow * coord.row + coord.col * uintsPerTexel;
      const id = data[offset + 1];
      const quad_id = data[offset + 3];
      const linear = coord.row * width + coord.col;

      // Record this pixel value
      noHelpersExpected[id] = linear;
      helpersExpected[id] = linear;

      // Determine if the other members of the quad are helpers.
      // If helpers are part of the quad mark them as found in the grid and
      // update expectation arrays with appropriate values.
      // This assumes quads are laid out in 4 consecutive subgroup ids starting from s.
      // Quad ids      Subgroup ids
      //  0 | 1         s   | s+1
      //  -----   ===>  -------
      //  2 | 3         s+2 | s+3
      // Note: the grid has a different linearity than in the shader.
      const rowSwap = (quad_id & 2) === 0 ? 1 : -1;
      const colSwap = (quad_id & 1) === 0 ? 1 : -1;
      const gridSwapRow = (coord.row + rowSwap) * (width + 1) + coord.col;
      const gridSwapCol = coord.row * (width + 1) + coord.col + colSwap;
      const gridSwapDiag = (coord.row + rowSwap) * (width + 1) + coord.col + colSwap;
      if (grid[gridSwapRow] === 0) {
        grid[gridSwapRow] = 1;
        hasHelpers = true;
        const r = coord.row + rowSwap;
        const c = coord.col;
        helpersExpected[idFromQuadId(id, quad_id, 'row')] = r * width + c;
      }
      if (grid[gridSwapCol] === 0) {
        grid[gridSwapCol] = 1;
        hasHelpers = true;
        const r = coord.row;
        const c = coord.col + colSwap;
        helpersExpected[idFromQuadId(id, quad_id, 'col')] = r * width + c;
      }
      if (grid[gridSwapDiag] === 0) {
        grid[gridSwapDiag] = 1;
        hasHelpers = true;
        const r = coord.row + rowSwap;
        const c = coord.col + colSwap;
        helpersExpected[idFromQuadId(id, quad_id, 'diag')] = r * width + c;
      }
    }

    // Now we can check the expected results.
    // We start from an indeterminate state for whether helpers are included in
    // subgroup ops, but once we find a definitive answer all future subgroups
    // must make the same decision to pass.
    for (const coord of coords) {
      const offset = uintsPerRow * coord.row + coord.col * uintsPerTexel;
      const res = data[offset];
      const id = data[offset + 1];
      const bound = op === 'subgroupAdd' ? kMaxSize : op === 'subgroupInclusiveAdd' ? id + 1 : id;
      let noHelpers = kIdentity;
      let helpers = kIdentity;
      for (let i = 0; i < bound; i++) {
        noHelpers += noHelpersExpected[i];
        helpers += helpersExpected[i];
      }

      if (includeHelpers === undefined) {
        if (res !== noHelpers && res !== helpers) {
          return new Error(`Row ${coord.row}, col ${coord.col}: invalid result
- expected: ${noHelpers} (without helpers) or ${helpers} (with helpers)
-      got: ${res}`);
        }

        // Crystalize the lattice if possible.
        if (hasHelpers) {
          includeHelpers = res === helpers;
        } else if (helpers !== noHelpers) {
          includeHelpers = res === helpers;
        }
      } else if (includeHelpers === true && res !== helpers) {
        return new Error(`Row ${coord.row}, col ${coord.col}: invalid result (helpers)
- expected: ${helpers}
-      got: ${res}`);
      } else if (includeHelpers === false && res !== noHelpers) {
        return new Error(`Row ${coord.row}, col ${coord.col}: invalid result (no helpers)
- expected: ${helpers}
-      got: ${res}`);
      }
    }
  }
  return undefined;
}

g.test('fragment')
  .desc('Test subgroup additions in fragment shaders')
  .params(u =>
    u
      .combine('op', kOperations)
      .combine('size', kFramebufferSizes)
      .beginSubcases()
      .combineWithParams([{ format: 'rgba32uint' }] as const)
  )
  .fn(async t => {
    t.skipIfDeviceDoesNotHaveFeature('subgroups' as GPUFeatureName);

    const fsShader = `
enable subgroups;

@group(0) @binding(0)
var<uniform> inputs : array<vec4u, 1>;

@fragment
fn main(
  @builtin(position) pos : vec4f,
  @builtin(subgroup_invocation_id) id : u32
) -> @location(0) vec4u {
  // Force usage
  _ = inputs[0];

  let linear = u32(pos.x) + u32(pos.y) * ${t.params.size[0]};
  let subgroup_id = subgroupBroadcastFirst(linear + 1);

  // Which pixel in the quad am I?
  let swap_x = quadSwapX(pos.x);
  let swap_y = quadSwapY(pos.y);
  let left = select(1u, 0u, pos.x < swap_x);
  let top = select(1u, 0u, pos.y < swap_y);
  let quad_id = left | (top << 1);

  let value = linear;
  return vec4u(${t.params.op}(value), id, subgroup_id, quad_id);
};`;

    await runFragmentTest(
      t,
      t.params.format,
      fsShader,
      t.params.size[0],
      t.params.size[1],
      new Uint32Array([0]), // unused
      (data: Uint32Array) => {
        return checkFragment(
          data,
          t.params.op,
          t.params.format,
          t.params.size[0],
          t.params.size[1]
        );
      }
    );
  });
