/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const workgroupSizes = [1, 2, 32, 64];
export const dispatchSizes = [1, 4, 8, 16];
export const kMapId = {
  passthrough: {
    f: (id, max) => id,
    wgsl: (max) => 'fn map_id(id: u32) -> u32 { return id; }'
  },
  remap: {
    f: (id, max) => ((id >>> 0) * 14957 ^ (id >>> 0) * 26561 >> 2) % max,
    wgsl: (max) =>
    `fn map_id(id: u32) -> u32 { return ((id * 14957) ^ ((id * 26561) >> 2)) % ${max}; }`
  }
};

export function runTest({
  t,
  workgroupSize, // Workgroup X-size
  dispatchSize, // Dispatch X-size
  bufferNumElements, // Number of 32-bit elements in output buffer
  initValue, // 32-bit initial value used to fill output buffer
  op, // Atomic op source executed by the compute shader
  expected, // Expected values array to compare against output buffer
  extra // Optional extra WGSL source









}) {
  const wgsl = `
    @group(0) @binding(0)
    var<storage, read_write> output: array<atomic<u32>>;
    
    @compute @workgroup_size(${workgroupSize})
    fn main(
        @builtin(global_invocation_id) global_invocation_id : vec3<u32>,
        ) {
      let id = global_invocation_id[0];
      ${op};
    }
    ${extra || ''}
    `;

  const pipeline = t.device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: t.device.createShaderModule({ code: wgsl }),
      entryPoint: 'main'
    }
  });

  const outputBuffer = t.device.createBuffer({
    size: bufferNumElements * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    mappedAtCreation: true
  });
  // Fill with initial value
  t.trackForCleanup(outputBuffer);
  const data = new Uint32Array(outputBuffer.getMappedRange());
  data.fill(initValue);
  outputBuffer.unmap();

  const bindGroup = t.device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: outputBuffer } }]
  });

  // Run the shader.
  const encoder = t.device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(dispatchSize);
  pass.end();
  t.queue.submit([encoder.finish()]);

  t.expectGPUBufferValuesEqual(outputBuffer, expected);
}
//# sourceMappingURL=harness.js.map