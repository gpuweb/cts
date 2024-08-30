/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution tests for subgroupAny.

Note: There is a lack of portability for non-uniform execution so these tests
restrict themselves to uniform control flow.
Note: There is no guaranteed mapping between subgroup_invocation_id and
local_invocation_index. Tests should avoid assuming there is.
`;import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { keysOf } from '../../../../../../common/util/data_tables.js';
import { iterRange } from '../../../../../../common/util/util.js';
import { PRNG } from '../../../../../util/prng.js';

import {
  kWGSizes,
  kPredicateCases,
  SubgroupTest,
  runComputeTest,
  kDataSentinel } from
'./subgroup_util.js';

export const g = makeTestGroup(SubgroupTest);

const kNumCases = 15;

/**
 * Generate input data for testing.
 *
 * Data is generated in the following categories:
 * Seed 0 generates all 0 data
 * Seed 1 generates all 1 data
 * Seeds 2-9 generates all 0s except for a one randomly once per 32 elements
 * Seeds 10+ generate all random data
 * @param seed The seed for the PRNG
 * @param num The number of data items to generate
 * @param addCounter If true, treats the first index as an atomic counter
 */
function generateInputData(seed, num, addCounter) {
  const prng = new PRNG(seed);

  const bound = Math.min(num, 32);
  const index = prng.uniformInt(bound);

  return new Uint32Array([
  ...iterRange(num, (x) => {
    if (addCounter && x === 0) {
      // Counter should start at 1 to avoid clear value.
      return 1;
    }

    if (seed === 0) {
      return 0;
    } else if (seed === 1) {
      return 1;
    } else if (seed < 10) {
      const bounded = (addCounter ? x + 1 : x) % bound;
      return bounded === index ? 1 : 0;
    }
    return prng.uniformInt(2);
  })]
  );
}

/**
 * Checks the result of a subgroupAny operation
 *
 * Since subgroup size depends on the pipeline compile, we calculate the expected
 * results after execution. The shader generates a subgroup id and records it for
 * each invocation. The check first calculates the expected result for each subgroup
 * and then compares to the actual result for each invocation. The filter functor
 * ensures only the correct invocations contribute to the calculation.
 * @param metadata An array of uints:
 *                 * first half containing subgroup sizes (from builtin value)
 *                 * second half subgroup invocation id
 * @param output An array of uints containing:
 *               * first half is the outputs of subgroupAny
 *               * second half is a generated subgroup id
 * @param numInvs Number of invocations executed
 * @param input The input data (equal size to output)
 * @param filter A functor to filter active invocations
 */
function checkAny(
metadata, // unused
output,
numInvs,
input,
filter)
{
  // First, generate expected results.
  const expected = new Map();
  for (let inv = 0; inv < numInvs; inv++) {
    const size = metadata[inv];
    const id = metadata[inv + numInvs];
    if (!filter(id, size)) {
      continue;
    }
    const subgroup_id = output[numInvs + inv];
    let v = expected.get(subgroup_id) ?? 0;
    v |= input[inv];
    expected.set(subgroup_id, v);
  }

  // Second, check against actual results.
  for (let inv = 0; inv < numInvs; inv++) {
    const size = metadata[inv];
    const id = metadata[inv + numInvs];
    const res = output[inv];
    if (filter(id, size)) {
      const subgroup_id = output[numInvs + inv];
      const expected_v = expected.get(subgroup_id) ?? 0;
      if (expected_v !== res) {
        return new Error(`Invocation ${inv}:
- expected: ${expected_v}
-      got: ${res}`);
      }
    } else {
      if (res !== kDataSentinel) {
        return new Error(`Invocation ${inv} unexpected write:
- subgroup invocation id: ${id}
-          subgroup size: ${size}`);
      }
    }
  }

  return undefined;
}

g.test('compute,all_active').
desc(`Test compute subgroupAny`).
params((u) =>
u.
combine('wgSize', kWGSizes).
beginSubcases().
combine('case', [...iterRange(kNumCases, (x) => x)])
).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase('subgroups');
}).
fn(async (t) => {
  const wgThreads = t.params.wgSize[0] * t.params.wgSize[1] * t.params.wgSize[2];

  const wgsl = `
enable subgroups;

@group(0) @binding(0)
var<storage> inputs : array<u32>;

@group(0) @binding(1)
var<storage, read_write> outputs : array<u32>;

struct Metadata {
  subgroup_size: array<u32, ${wgThreads}>,
  subgroup_invocation_id: array<u32, ${wgThreads}>,
}

@group(0) @binding(2)
var<storage, read_write> metadata : Metadata;

@compute @workgroup_size(${t.params.wgSize[0]}, ${t.params.wgSize[1]}, ${t.params.wgSize[2]})
fn main(
  @builtin(local_invocation_index) lid : u32,
  @builtin(subgroup_invocation_id) id : u32,
  @builtin(subgroup_size) subgroupSize : u32,
) {
  metadata.subgroup_size[lid] = subgroupSize;

  metadata.subgroup_invocation_id[lid] = id;

  // Record a representative subgroup id.
  outputs[lid + ${wgThreads}] = subgroupBroadcastFirst(lid);

  let res = select(0u, 1u, subgroupAny(bool(inputs[lid])));
  outputs[lid] = res;
}`;

  const includeCounter = false;
  const inputData = generateInputData(t.params.case, wgThreads, includeCounter);

  const uintsPerOutput = 2;
  await runComputeTest(
    t,
    wgsl,
    [t.params.wgSize[0], t.params.wgSize[1], t.params.wgSize[2]],
    uintsPerOutput,
    inputData,
    (metadata, output) => {
      return checkAny(metadata, output, wgThreads, inputData, (id, size) => {
        return true;
      });
    }
  );
});

g.test('compute,split').
desc('Test that only active invocation participate').
params((u) =>
u.
combine('predicate', keysOf(kPredicateCases)).
beginSubcases().
combine('wgSize', kWGSizes).
combine('case', [...iterRange(kNumCases, (x) => x)])
).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase('subgroups');
}).
fn(async (t) => {
  const testcase = kPredicateCases[t.params.predicate];
  const wgThreads = t.params.wgSize[0] * t.params.wgSize[1] * t.params.wgSize[2];

  const wgsl = `
enable subgroups;

@group(0) @binding(0)
var<storage> inputs : array<u32>;

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
  @builtin(subgroup_size) subgroupSize : u32,
) {
  metadata.subgroup_size[lid] = subgroupSize;

  // Record subgroup invocation id for this invocation.
  metadata.subgroup_invocation_id[lid] = id;

  // Record a generated subgroup id.
  outputs[${wgThreads} + lid] = subgroupBroadcastFirst(lid);

  if ${testcase.cond} {
    outputs[lid] = select(0u, 1u, subgroupAny(bool(inputs[lid])));
  } else {
    return;
  }
}`;

  const includeCounter = false;
  const inputData = generateInputData(t.params.case, wgThreads, includeCounter);

  const uintsPerOutput = 2;
  await runComputeTest(
    t,
    wgsl,
    [t.params.wgSize[0], t.params.wgSize[1], t.params.wgSize[2]],
    uintsPerOutput,
    inputData,
    (metadata, output) => {
      return checkAny(metadata, output, wgThreads, inputData, testcase.filter);
    }
  );
});

g.test('fragment').unimplemented();
//# sourceMappingURL=subgroupAny.spec.js.map