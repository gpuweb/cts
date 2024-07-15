export const description = `Test compute shader builtin variables`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { iterRange } from '../../../../common/util/util.js';
import { GPUTest } from '../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

// Test that the values for each input builtin are correct.
g.test('inputs')
  .desc(`Test compute shader builtin inputs values`)
  .params(u =>
    u
      .combine('method', ['param', 'struct', 'mixed'] as const)
      .combine('dispatch', ['direct', 'indirect'] as const)
      .combineWithParams([
        {
          groupSize: { x: 1, y: 1, z: 1 },
          numGroups: { x: 1, y: 1, z: 1 },
        },
        {
          groupSize: { x: 8, y: 4, z: 2 },
          numGroups: { x: 1, y: 1, z: 1 },
        },
        {
          groupSize: { x: 1, y: 1, z: 1 },
          numGroups: { x: 8, y: 4, z: 2 },
        },
        {
          groupSize: { x: 3, y: 7, z: 5 },
          numGroups: { x: 13, y: 9, z: 11 },
        },
      ] as const)
      .beginSubcases()
  )
  .fn(t => {
    const invocationsPerGroup = t.params.groupSize.x * t.params.groupSize.y * t.params.groupSize.z;
    const totalInvocations =
      invocationsPerGroup * t.params.numGroups.x * t.params.numGroups.y * t.params.numGroups.z;

    // Generate the structures, parameters, and builtin expressions used in the shader.
    let params = '';
    let structures = '';
    let local_id = '';
    let local_index = '';
    let global_id = '';
    let group_id = '';
    let num_groups = '';
    switch (t.params.method) {
      case 'param':
        params = `
          @builtin(local_invocation_id) local_id : vec3<u32>,
          @builtin(local_invocation_index) local_index : u32,
          @builtin(global_invocation_id) global_id : vec3<u32>,
          @builtin(workgroup_id) group_id : vec3<u32>,
          @builtin(num_workgroups) num_groups : vec3<u32>,
        `;
        local_id = 'local_id';
        local_index = 'local_index';
        global_id = 'global_id';
        group_id = 'group_id';
        num_groups = 'num_groups';
        break;
      case 'struct':
        structures = `struct Inputs {
            @builtin(local_invocation_id) local_id : vec3<u32>,
            @builtin(local_invocation_index) local_index : u32,
            @builtin(global_invocation_id) global_id : vec3<u32>,
            @builtin(workgroup_id) group_id : vec3<u32>,
            @builtin(num_workgroups) num_groups : vec3<u32>,
          };`;
        params = `inputs : Inputs`;
        local_id = 'inputs.local_id';
        local_index = 'inputs.local_index';
        global_id = 'inputs.global_id';
        group_id = 'inputs.group_id';
        num_groups = 'inputs.num_groups';
        break;
      case 'mixed':
        structures = `struct InputsA {
          @builtin(local_invocation_index) local_index : u32,
          @builtin(global_invocation_id) global_id : vec3<u32>,
        };
        struct InputsB {
          @builtin(workgroup_id) group_id : vec3<u32>
        };`;
        params = `@builtin(local_invocation_id) local_id : vec3<u32>,
                  inputsA : InputsA,
                  inputsB : InputsB,
                  @builtin(num_workgroups) num_groups : vec3<u32>,`;
        local_id = 'local_id';
        local_index = 'inputsA.local_index';
        global_id = 'inputsA.global_id';
        group_id = 'inputsB.group_id';
        num_groups = 'num_groups';
        break;
    }

    // WGSL shader that stores every builtin value to a buffer, for every invocation in the grid.
    const wgsl = `
      struct Outputs {
        local_id: vec3u,
        local_index: u32,
        global_id: vec3u,
        group_id: vec3u,
        num_groups: vec3u,
      };
      @group(0) @binding(0) var<storage, read_write> outputs : array<Outputs>;

      ${structures}

      const group_width = ${t.params.groupSize.x}u;
      const group_height = ${t.params.groupSize.y}u;
      const group_depth = ${t.params.groupSize.z}u;

      @compute @workgroup_size(group_width, group_height, group_depth)
      fn main(
        ${params}
        ) {
        let group_index = ((${group_id}.z * ${num_groups}.y) + ${group_id}.y) * ${num_groups}.x + ${group_id}.x;
        let global_index = group_index * ${invocationsPerGroup}u + ${local_index};
        var o: Outputs;
        o.local_id = ${local_id};
        o.local_index = ${local_index};
        o.global_id = ${global_id};
        o.group_id = ${group_id};
        o.num_groups = ${num_groups};
        outputs[global_index] = o;
      }
    `;

    const pipeline = t.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: t.device.createShaderModule({
          code: wgsl,
        }),
        entryPoint: 'main',
      },
    });

    // Offsets are in u32 size units
    const kLocalIdOffset = 0;
    const kLocalIndexOffset = 3;
    const kGlobalIdOffset = 4;
    const kGroupIdOffset = 8;
    const kNumGroupsOffset = 12;
    const kOutputElementSize = 16;

    // Create the output buffers.
    const outputBuffer = t.createBufferTracked({
      size: totalInvocations * kOutputElementSize * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const bindGroup = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: outputBuffer } }],
    });

    // Run the shader.
    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    switch (t.params.dispatch) {
      case 'direct':
        pass.dispatchWorkgroups(t.params.numGroups.x, t.params.numGroups.y, t.params.numGroups.z);
        break;
      case 'indirect': {
        const dispatchBuffer = t.createBufferTracked({
          size: 3 * Uint32Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.INDIRECT,
          mappedAtCreation: true,
        });
        const dispatchData = new Uint32Array(dispatchBuffer.getMappedRange());
        dispatchData[0] = t.params.numGroups.x;
        dispatchData[1] = t.params.numGroups.y;
        dispatchData[2] = t.params.numGroups.z;
        dispatchBuffer.unmap();
        pass.dispatchWorkgroupsIndirect(dispatchBuffer, 0);
        break;
      }
    }
    pass.end();
    t.queue.submit([encoder.finish()]);

    type vec3 = { x: number; y: number; z: number };

    // Helper to check that the vec3<u32> value at each index of the provided `output` buffer
    // matches the expected value for that invocation, as generated by the `getBuiltinValue`
    // function. The `name` parameter is the builtin name, used for error messages.
    const checkEachIndex = (output: Uint32Array) => {
      // Loop over workgroups.
      for (let gz = 0; gz < t.params.numGroups.z; gz++) {
        for (let gy = 0; gy < t.params.numGroups.y; gy++) {
          for (let gx = 0; gx < t.params.numGroups.x; gx++) {
            // Loop over invocations within a group.
            for (let lz = 0; lz < t.params.groupSize.z; lz++) {
              for (let ly = 0; ly < t.params.groupSize.y; ly++) {
                for (let lx = 0; lx < t.params.groupSize.x; lx++) {
                  const groupIndex = (gz * t.params.numGroups.y + gy) * t.params.numGroups.x + gx;
                  const localIndex = (lz * t.params.groupSize.y + ly) * t.params.groupSize.x + lx;
                  const globalIndex = groupIndex * invocationsPerGroup + localIndex;
                  const globalOffset = globalIndex * kOutputElementSize;

                  const expectEqual = (name: string, expected: number, actual: number) => {
                    if (actual !== expected) {
                      return new Error(
                        `${name} failed at group(${gx},${gy},${gz}) local(${lx},${ly},${lz}))\n` +
                          `    expected: ${expected}\n` +
                          `    got:      ${actual}`
                      );
                    }
                    return undefined;
                  };

                  const checkVec3Value = (name: string, fieldOffset: number, expected: vec3) => {
                    const offset = globalOffset + fieldOffset;
                    return (
                      expectEqual(`${name}.x`, expected.x, output[offset + 0]) ||
                      expectEqual(`${name}.y`, expected.y, output[offset + 1]) ||
                      expectEqual(`${name}.z`, expected.z, output[offset + 2])
                    );
                  };

                  const error =
                    checkVec3Value('local_id', kLocalIdOffset, { x: lx, y: ly, z: lz }) ||
                    checkVec3Value('global_id', kGlobalIdOffset, {
                      x: gx * t.params.groupSize.x + lx,
                      y: gy * t.params.groupSize.y + ly,
                      z: gz * t.params.groupSize.z + lz,
                    }) ||
                    checkVec3Value('group_id', kGroupIdOffset, { x: gx, y: gy, z: gz }) ||
                    checkVec3Value('num_groups', kNumGroupsOffset, t.params.numGroups) ||
                    expectEqual(
                      'local_index',
                      localIndex,
                      output[globalOffset + kLocalIndexOffset]
                    );
                  if (error) {
                    return error;
                  }
                }
              }
            }
          }
        }
      }
      return undefined;
    };

    t.expectGPUBufferValuesPassCheck(outputBuffer, outputData => checkEachIndex(outputData), {
      type: Uint32Array,
      typedLength: outputBuffer.size / 4,
    });
  });

/**
 * @returns The population count of input.
 */
function popcount(input: number): number {
  let n = input;
  n = n - ((n >> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
  return (((n + (n >> 4)) & 0xf0f0f0f) * 0x1010101) >> 24;
}

function ErrorMsg(msg: string, got: number, expected: number): string {
  return `${msg}:\n-      got: ${got}\n- expected: ${expected}`;
}

/**
 * Checks that the subgroup size and ballot buffers are consistent.
 *
 * This function assumes subgroups will be filled as much as possible with
 * up to 1 partial subgroup at the end of each workgroup.
 *
 * @param data The subgroup_size buffer
 * @param compare The ballot buffer
 * @param min The minimum subgroup size allowed
 * @param max The maximum subgroup size allowed
 * @param invocations The number of invocations in a workgroup
 */
function checkSubgroupSizeConsistency(
  data: Uint32Array,
  compare: Uint32Array,
  min: number,
  max: number,
  invocations: number
): Error | undefined {
  const subgroupSize = data[0];
  if (popcount(subgroupSize) !== 1) {
    return new Error(`Subgroup size '${subgroupSize}' is not a power of two`);
  }
  if (subgroupSize < min) {
    return new Error(`Subgroup size '${subgroupSize}' is less than minimum '${min}'`);
  }
  if (max < subgroupSize) {
    return new Error(`Subgroup size '${subgroupSize}' is greater than maximum '${max}'`);
  }

  // Check that remaining invocations record a consistent subgroup size.
  for (let i = 1; i < data.length; i++) {
    if (data[i] !== subgroupSize) {
      return new Error(
        ErrorMsg(`Invocation ${i}: subgroup size inconsistency`, data[i], subgroupSize)
      );
    }
  }

  // Assumes workgroups are divided such that there is a single partial subgroup if any.
  const partialSize = invocations % subgroupSize;
  let fullSize = 0;
  if (subgroupSize <= invocations) {
    fullSize = Math.floor(invocations / subgroupSize) * subgroupSize;
  }
  let fullCount = 0;
  let partialCount = 0;
  for (let i = 0; i < compare.length; i++) {
    if (i % invocations === 0) {
      if (i !== 0) {
        // Check intermediate workgroup counts.
        if (fullCount !== fullSize) {
          return new Error(ErrorMsg(`Unexpected number of full invocations`, fullCount, fullSize));
        }
        if (partialCount !== partialSize) {
          return new Error(
            ErrorMsg(`Unexpected number of partial invocations`, partialCount, partialSize)
          );
        }
      }

      // Reset for new workgroup.
      fullCount = 0;
      partialCount = 0;
    }

    if (compare[i] === subgroupSize) {
      fullCount++;
    } else {
      partialCount++;

      // Check that all partial invocations are consistent.
      if (compare[i] !== partialSize) {
        return new Error(ErrorMsg(`Partial subgroup size incorrect`, compare[i], partialSize));
      }
    }
  }

  // Check final workgroup counts.
  if (fullCount !== fullSize) {
    return new Error(ErrorMsg(`Unexpected number of full invocations`, fullCount, fullSize));
  }
  if (partialCount !== partialSize) {
    return new Error(
      ErrorMsg(`Unexpected number of partial invocations`, partialCount, partialSize)
    );
  }

  return undefined;
}

const kWGSizes = [
  [1, 1, 1],
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

g.test('subgroup_size')
  .desc('Tests subgroup_size values')
  .params(u =>
    u
      .combine('sizes', kWGSizes)
      .beginSubcases()
      .combine('numWGs', [1, 2] as const)
  )
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase('subgroups' as GPUFeatureName);
  })
  .fn(async t => {
    // Replace these with the limits when they are wired up.
    const minSize = 4;
    const maxSize = 128;

    const wgThreads = t.params.sizes[0] * t.params.sizes[1] * t.params.sizes[2];
    const wgsl = `
enable subgroups;

const stride = ${wgThreads};

@group(0) @binding(0)
var<storage, read_write> output : array<u32>;

@group(0) @binding(1)
var<storage, read_write> compare : array<u32>;

@compute @workgroup_size(${t.params.sizes[0]}, ${t.params.sizes[1]}, ${t.params.sizes[2]})
fn main(@builtin(subgroup_size) size : u32,
        @builtin(workgroup_id) wgid : vec3u,
        @builtin(local_invocation_index) lid : u32) {
  output[lid + wgid.x * stride] = size;
  let ballot = countOneBits(subgroupBallot());
  let ballotSize = ballot[0] + ballot[1] + ballot[2] + ballot[3];
  compare[lid + wgid.x * stride] = ballotSize;
}`;

    const numInvocations = wgThreads * t.params.numWGs;
    const sizesBuffer = t.makeBufferWithContents(
      new Uint32Array([...iterRange(numInvocations, x => 0)]),
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    );
    t.trackForCleanup(sizesBuffer);
    const compareBuffer = t.makeBufferWithContents(
      new Uint32Array([...iterRange(numInvocations, x => 0)]),
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    );
    t.trackForCleanup(compareBuffer);

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
            buffer: sizesBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: compareBuffer,
          },
        },
      ],
    });

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(t.params.numWGs, 1, 1);
    pass.end();
    t.queue.submit([encoder.finish()]);

    const sizesReadback = await t.readGPUBufferRangeTyped(sizesBuffer, {
      srcByteOffset: 0,
      type: Uint32Array,
      typedLength: numInvocations,
      method: 'copy',
    });
    const sizesData: Uint32Array = sizesReadback.data;

    const compareReadback = await t.readGPUBufferRangeTyped(compareBuffer, {
      srcByteOffset: 0,
      type: Uint32Array,
      typedLength: numInvocations,
      method: 'copy',
    });
    const compareData: Uint32Array = compareReadback.data;

    t.expectOK(checkSubgroupSizeConsistency(sizesData, compareData, minSize, maxSize, wgThreads));
  });

/**
 * Checks that subgroup_invocation_id values are consistent.
 *
 * For each workgroup checks the following:
 * 1. No id is greater subgroup size
 * 2. Subgroups are packed such that the number of subgroups with a given id is:
 *  - number of full subgroups
 *  - plus 1 if the id is included in the single partial subgroup
 *
 * @param data The subgroup_invocation_id buffer
 * @param subgroupSize The subgroup size
 * @param wgSize Number of invocations per workgroup
 * @param numWGs Number of workgroups
 */
function checkSubgroupInvocationIdConsistency(
  data: Uint32Array,
  subgroupSize: number,
  wgSize: number,
  numWGs: number
): Error | undefined {
  const partialSize = wgSize % subgroupSize;
  const numFullSubgroups = Math.floor(wgSize / subgroupSize);

  for (let wg = 0; wg < numWGs; wg++) {
    const ids = [...iterRange(subgroupSize, x => 0)];
    for (let i = 0; i < wgSize; i++) {
      const idx = i + wg * wgSize;
      const id = data[idx];
      if (subgroupSize <= data[idx]) {
        return new Error(`Subgroup invocation id '${id}' exceeded subgroup size '${subgroupSize}'`);
      }
      ids[id]++;
    }
    for (let i = 0; i < ids.length; i++) {
      let expect = numFullSubgroups;
      if (i < partialSize) {
        expect++;
      }
      if (ids[i] !== expect) {
        return new Error(
          ErrorMsg(`Workgroup ${wg}: subgroup_invocation_id ${i} inconsistent`, ids[i], expect)
        );
      }
    }
  }

  return undefined;
}

g.test('subgroup_invocation_id')
  .desc(
    'Tests subgroup_invocation_id values. No mapping between local_invocation_index and subgroup_invocation_id can be relied upon.'
  )
  .params(u =>
    u
      .combine('sizes', kWGSizes)
      .beginSubcases()
      .combine('numWGs', [1, 2] as const)
  )
  .beforeAllSubcases(t => {
    t.selectDeviceOrSkipTestCase('subgroups' as GPUFeatureName);
  })
  .fn(async t => {
    const wgThreads = t.params.sizes[0] * t.params.sizes[1] * t.params.sizes[2];
    const wgsl = `
enable subgroups;

const stride = ${wgThreads};

@group(0) @binding(0)
var<storage, read_write> output : array<u32>;

@group(0) @binding(1)
var<storage, read_write> sizes : array<u32>;

@compute @workgroup_size(${t.params.sizes[0]}, ${t.params.sizes[1]}, ${t.params.sizes[2]})
fn main(@builtin(subgroup_size) size : u32,
        @builtin(subgroup_invocation_id) id : u32,
        @builtin(workgroup_id) wgid : vec3u,
        @builtin(local_invocation_index) lid : u32) {
  output[lid + stride * wgid.x] = id;
  if (lid == 0) {
    sizes[0] = size;
  }
}`;

    const numInvocations = wgThreads * t.params.numWGs;
    const outputBuffer = t.makeBufferWithContents(
      new Uint32Array([...iterRange(numInvocations, x => 0)]),
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    );
    t.trackForCleanup(outputBuffer);
    const sizeBuffer = t.makeBufferWithContents(
      new Uint32Array([0]),
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    );
    t.trackForCleanup(sizeBuffer);

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
            buffer: outputBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: sizeBuffer,
          },
        },
      ],
    });

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(t.params.numWGs, 1, 1);
    pass.end();
    t.queue.submit([encoder.finish()]);

    const sizeReadback = await t.readGPUBufferRangeTyped(sizeBuffer, {
      srcByteOffset: 0,
      type: Uint32Array,
      typedLength: 1,
      method: 'copy',
    });
    const sizeData: Uint32Array = sizeReadback.data;

    const outputReadback = await t.readGPUBufferRangeTyped(outputBuffer, {
      srcByteOffset: 0,
      type: Uint32Array,
      typedLength: numInvocations,
      method: 'copy',
    });
    const outputData: Uint32Array = outputReadback.data;

    t.expectOK(
      checkSubgroupInvocationIdConsistency(outputData, sizeData[0], wgThreads, t.params.numWGs)
    );
  });
