export const description = `
Validate immediate data usage in RenderPassEncoder, ComputePassEncoder, and RenderBundleEncoder.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { getGPU } from '../../../../../common/util/navigator_gpu.js';
import { AllFeaturesMaxLimitsGPUTest } from '../../../../gpu_test.js';
import {
  kProgrammableEncoderTypes,
  ProgrammableEncoderType,
} from '../../../../util/command_buffer_maker.js';

interface EncoderWithImmediates {
  setImmediates(offset: number, data: Uint8Array, srcOffset: number, size: number): void;
}

class PipelineImmediateTest extends AllFeaturesMaxLimitsGPUTest {
  override async init() {
    await super.init();
    const supportsRenderPass =
      typeof GPURenderPassEncoder !== 'undefined' &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'setImmediates' in (GPURenderPassEncoder.prototype as any);
    const supportsComputePass =
      typeof GPUComputePassEncoder !== 'undefined' &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'setImmediates' in (GPUComputePassEncoder.prototype as any);
    const supportsRenderBundle =
      typeof GPURenderBundleEncoder !== 'undefined' &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'setImmediates' in (GPURenderBundleEncoder.prototype as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supportsLimit = (this.device.limits as any).maxImmediateSize !== undefined;
    const supportsWgslFeature = getGPU(this.rec).wgslLanguageFeatures.has(
      'immediate_address_space'
    );

    if (
      !supportsRenderPass &&
      !supportsComputePass &&
      !supportsRenderBundle &&
      !supportsLimit &&
      !supportsWgslFeature
    ) {
      this.skip('setImmediates not supported');
    }
  }

  createPipeline(
    encoderType: ProgrammableEncoderType,
    code: string,
    immediateSize: number
  ): GPURenderPipeline | GPUComputePipeline {
    const layout = this.device.createPipelineLayout({
      bindGroupLayouts: [],
      immediateSize,
    });

    if (encoderType === 'compute pass') {
      return this.device.createComputePipeline({
        layout,
        compute: {
          module: this.device.createShaderModule({ code }),
          entryPoint: 'main_compute',
        },
      });
    } else {
      return this.device.createRenderPipeline({
        layout,
        vertex: {
          module: this.device.createShaderModule({ code }),
          entryPoint: 'main_vertex',
        },
        fragment: {
          module: this.device.createShaderModule({ code }),
          entryPoint: 'main_fragment',
          targets: [{ format: 'rgba8unorm' }],
        },
      });
    }
  }

  runPass(
    encoderType: ProgrammableEncoderType,
    encoder: GPUComputePassEncoder | GPURenderPassEncoder | GPURenderBundleEncoder,
    pipeline: GPURenderPipeline | GPUComputePipeline
  ) {
    if (encoderType === 'compute pass') {
      (encoder as GPUComputePassEncoder).setPipeline(pipeline as GPUComputePipeline);
      (encoder as GPUComputePassEncoder).dispatchWorkgroups(1);
    } else if (encoderType === 'render pass') {
      (encoder as GPURenderPassEncoder).setPipeline(pipeline as GPURenderPipeline);
      (encoder as GPURenderPassEncoder).draw(3);
    } else if (encoderType === 'render bundle') {
      (encoder as GPURenderBundleEncoder).setPipeline(pipeline as GPURenderPipeline);
      (encoder as GPURenderBundleEncoder).draw(3);
    }
  }
}

export const g = makeTestGroup(PipelineImmediateTest);

g.test('required_slots_set')
  .desc(
    `
    Validate that all immediate data slots required by the pipeline are set on the encoder.
    - For each immediate data variable statically used by the pipeline:
      - All accessible slots (4-byte words) must be set via setImmediates.
    - Scenarios:
      - scalar: Simple u32 usage.
      - vector: Simple vec4<u32> usage.
      - struct_padding: Struct with padding. Padding bytes do not need to be set.
        When a struct variable is statically used, all non-padding bytes of the entire struct must be set,
        even if only one member is accessed. In this test, data.b.v is accessed, but both data.a and data.b
        must be set (excluding padding).
      - functions: Immediate data used in a function called by entry point.
      - dynamic_indexing: Array with dynamic indexing.
    - Usage:
      - full: Set all declared bytes.
      - split: Set all declared bytes in multiple calls.
      - partial: Set only a subset of bytes.
        - For struct_padding, this means setting only members (no padding), which is valid.
        - For others, this means missing required data, which is invalid.
    `
  )
  .params(u =>
    u
      .combine('encoderType', kProgrammableEncoderTypes)
      .combine('scenario', [
        'scalar',
        'vector',
        'struct_padding',
        'functions',
        'function_unused',
        'dynamic_indexing',
      ] as const)
      .combine('usage', ['full', 'partial', 'split', 'overprovision'] as const)
      .filter(t => {
        if (t.scenario === 'scalar' && t.usage === 'split') return false;
        return true;
      })
  )
  .fn(t => {
    const { encoderType, scenario, usage } = t.params;

    let code = '';
    let kRequiredSize = 0;

    switch (scenario) {
      case 'scalar':
        kRequiredSize = 4;
        code = `
          var<immediate> data: u32;
          @compute @workgroup_size(1) fn main_compute() { _ = data; }
          @vertex fn main_vertex() -> @builtin(position) vec4<f32> { _ = data; return vec4<f32>(0.0, 0.0, 0.0, 1.0); }
          @fragment fn main_fragment() -> @location(0) vec4<f32> { _ = data; return vec4<f32>(0.0, 1.0, 0.0, 1.0); }
        `;
        break;
      case 'vector':
        kRequiredSize = 16;
        code = `
          var<immediate> data: vec4<u32>;
          @compute @workgroup_size(1) fn main_compute() { _ = data; }
          @vertex fn main_vertex() -> @builtin(position) vec4<f32> { _ = data; return vec4<f32>(0.0, 0.0, 0.0, 1.0); }
          @fragment fn main_fragment() -> @location(0) vec4<f32> { _ = data; return vec4<f32>(0.0, 1.0, 0.0, 1.0); }
        `;
        break;
      case 'struct_padding':
        kRequiredSize = 64;
        code = `
          struct A { v: vec3<u32>, }
          struct B { v: vec2<u32>, }
          struct Data { a: A, @align(32) b: B, }
          var<immediate> data: Data;
          @compute @workgroup_size(1) fn main_compute() { _ = data.b.v; }
          @vertex fn main_vertex() -> @builtin(position) vec4<f32> { _ = data.b.v; return vec4<f32>(0.0, 0.0, 0.0, 1.0); }
          @fragment fn main_fragment() -> @location(0) vec4<f32> { _ = data.b.v; return vec4<f32>(0.0, 1.0, 0.0, 1.0); }
        `;
        break;
      case 'functions':
        kRequiredSize = 16;
        code = `
          var<immediate> data: vec4<u32>;
          fn use_data() { _ = data; }
          @compute @workgroup_size(1) fn main_compute() { use_data(); }
          @vertex fn main_vertex() -> @builtin(position) vec4<f32> { use_data(); return vec4<f32>(0.0, 0.0, 0.0, 1.0); }
          @fragment fn main_fragment() -> @location(0) vec4<f32> { use_data(); return vec4<f32>(0.0, 1.0, 0.0, 1.0); }
        `;
        break;
      case 'function_unused':
        kRequiredSize = 16;
        code = `
          var<immediate> data: vec4<u32>;
          fn use_data() { _ = data; }
          @compute @workgroup_size(1) fn main_compute() { }
          @vertex fn main_vertex() -> @builtin(position) vec4<f32> { return vec4<f32>(0.0, 0.0, 0.0, 1.0); }
          @fragment fn main_fragment() -> @location(0) vec4<f32> { return vec4<f32>(0.0, 1.0, 0.0, 1.0); }
        `;
        break;
      case 'dynamic_indexing':
        kRequiredSize = 16;
        code = `
          var<immediate> data: array<u32, 4>;
          @compute @workgroup_size(1) fn main_compute(@builtin(local_invocation_index) i: u32) { _ = data[i]; }
          @vertex fn main_vertex(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> { _ = data[i]; return vec4<f32>(0.0, 0.0, 0.0, 1.0); }
          @fragment fn main_fragment(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
            let i = u32(pos.x);
            _ = data[i];
            return vec4<f32>(0.0, 1.0, 0.0, 1.0);
          }
        `;
        break;
    }

    const layoutSize = usage === 'overprovision' ? kRequiredSize + 4 : kRequiredSize;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (layoutSize > (t.device.limits as any).maxImmediateSize) {
      t.skip('maxImmediateSize not large enough for overprovision test');
    }

    const pipeline = t.createPipeline(encoderType, code, layoutSize);
    const { encoder, validateFinishAndSubmit } = t.createEncoder(encoderType);

    const setImmediates = (offset: number, size: number) => {
      const data = new Uint8Array(size);
      (encoder as unknown as EncoderWithImmediates).setImmediates(offset, data, 0, size);
    };

    if (scenario === 'struct_padding') {
      // Actual data ends at byte 40. A.v: 0-12. Padding: 12-32 (includes A padding 12-16 and inter-member padding 16-32). B.v: 32-40. Total struct size: 64.
      if (usage === 'full') {
        setImmediates(0, 40);
      } else if (usage === 'split') {
        setImmediates(0, 32);
        setImmediates(32, 8);
      } else if (usage === 'partial') {
        // Set members only
        setImmediates(0, 12);
        setImmediates(32, 8);
      } else if (usage === 'overprovision') {
        setImmediates(0, kRequiredSize + 4);
      }
    } else if (scenario === 'scalar') {
      // Size 4.
      if (usage === 'full') {
        setImmediates(0, 4);
      } else if (usage === 'partial') {
        // Set nothing
      } else if (usage === 'overprovision') {
        setImmediates(0, kRequiredSize + 4);
      }
    } else {
      // Vector (size 16), functions (size 16), dynamic_indexing (size 16)
      if (usage === 'full') {
        setImmediates(0, 16);
      } else if (usage === 'split') {
        setImmediates(0, 8);
        setImmediates(8, 8);
      } else if (usage === 'partial') {
        setImmediates(0, 8); // Missing last 8 bytes
      } else if (usage === 'overprovision') {
        setImmediates(0, kRequiredSize + 4);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t.runPass(encoderType, encoder as any, pipeline);

    const shouldSucceed =
      usage === 'full' ||
      usage === 'split' ||
      usage === 'overprovision' ||
      scenario === 'function_unused' ||
      (scenario === 'struct_padding' && usage === 'partial');
    validateFinishAndSubmit(shouldSucceed, true);
  });

g.test('unused_variable')
  .desc(
    `
    Validate that if an immediate data variable is declared but not statically used,
    it does not require slots to be set.
    `
  )
  .params(u =>
    u
      .combine('encoderType', kProgrammableEncoderTypes)
      .combine('usage', ['none', 'full', 'partial_start'] as const)
      .combine('scenario', ['not_referenced', 'referenced_in_unused_function'] as const)
  )
  .fn(t => {
    const { encoderType, usage, scenario } = t.params;
    const kImmediateSize = 16;

    const code =
      scenario === 'not_referenced'
        ? `
      var<immediate> data: vec4<u32>;

      @compute @workgroup_size(1) fn main_compute() {
        // data is not used
      }

      @vertex fn main_vertex() -> @builtin(position) vec4<f32> {
        return vec4<f32>(0.0, 0.0, 0.0, 1.0);
      }

      @fragment fn main_fragment() -> @location(0) vec4<f32> {
        return vec4<f32>(0.0, 1.0, 0.0, 1.0);
      }
    `
        : `
      var<immediate> data: vec4<u32>;
      fn unused_helper() { _ = data; }

      @compute @workgroup_size(1) fn main_compute() {
        // unused_helper is not called
      }

      @vertex fn main_vertex() -> @builtin(position) vec4<f32> {
        return vec4<f32>(0.0, 0.0, 0.0, 1.0);
      }

      @fragment fn main_fragment() -> @location(0) vec4<f32> {
        return vec4<f32>(0.0, 1.0, 0.0, 1.0);
      }
    `;

    const pipeline = t.createPipeline(encoderType, code, kImmediateSize);

    const { encoder, validateFinishAndSubmit } = t.createEncoder(encoderType);

    if (usage === 'full') {
      const data = new Uint8Array(16);
      (encoder as unknown as EncoderWithImmediates).setImmediates(0, data, 0, 16);
    } else if (usage === 'partial_start') {
      const data = new Uint8Array(8);
      (encoder as unknown as EncoderWithImmediates).setImmediates(0, data, 0, 8);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t.runPass(encoderType, encoder as any, pipeline);

    validateFinishAndSubmit(true, true);
  });

g.test('overprovisioned_immediate_data')
  .desc(
    `
    Validate that setting more immediate data than used by the shader (but within layout limits) is valid.
    `
  )
  .params(u => u.combine('encoderType', kProgrammableEncoderTypes))
  .fn(t => {
    const { encoderType } = t.params;
    const kLayoutSize = 32;
    // Shader only uses 16 bytes (vec4<u32>)
    const code = `
      var<immediate> data: vec4<u32>;
      @compute @workgroup_size(1) fn main_compute() { _ = data; }
      @vertex fn main_vertex() -> @builtin(position) vec4<f32> { _ = data; return vec4<f32>(0.0, 0.0, 0.0, 1.0); }
      @fragment fn main_fragment() -> @location(0) vec4<f32> { _ = data; return vec4<f32>(0.0, 1.0, 0.0, 1.0); }
    `;

    const pipeline = t.createPipeline(encoderType, code, kLayoutSize);
    const { encoder, validateFinishAndSubmit } = t.createEncoder(encoderType);

    // Set 32 bytes (valid per layout)
    const data = new Uint8Array(32);
    (encoder as unknown as EncoderWithImmediates).setImmediates(0, data, 0, 32);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t.runPass(encoderType, encoder as any, pipeline);

    validateFinishAndSubmit(true, true);
  });

g.test('pipeline_creation_immediate_size_mismatch')
  .desc(
    `
    Validate that creating a pipeline fails if the shader uses immediate data
    larger than the immediateSize specified in the pipeline layout.
    `
  )
  .params(u => u.combine('encoderType', kProgrammableEncoderTypes))
  .fn(t => {
    const { encoderType } = t.params;
    const kLayoutSize = 16;
    const kShaderSize = 32; // Larger than layout

    const layout = t.device.createPipelineLayout({
      bindGroupLayouts: [],
      immediateSize: kLayoutSize,
    });

    const code = `
      var<immediate> data: array<u32, ${kShaderSize / 4}>;
      @compute @workgroup_size(1) fn main_compute() { _ = data[0]; }
      @vertex fn main_vertex() -> @builtin(position) vec4<f32> { _ = data[0]; return vec4<f32>(0.0, 0.0, 0.0, 1.0); }
      @fragment fn main_fragment() -> @location(0) vec4<f32> { _ = data[0]; return vec4<f32>(0.0, 1.0, 0.0, 1.0); }
    `;

    t.expectValidationError(() => {
      if (encoderType === 'compute pass') {
        t.device.createComputePipeline({
          layout,
          compute: {
            module: t.device.createShaderModule({ code }),
            entryPoint: 'main_compute',
          },
        });
      } else {
        t.device.createRenderPipeline({
          layout,
          vertex: {
            module: t.device.createShaderModule({ code }),
            entryPoint: 'main_vertex',
          },
          fragment: {
            module: t.device.createShaderModule({ code }),
            entryPoint: 'main_fragment',
            targets: [{ format: 'rgba8unorm' }],
          },
        });
      }
    });
  });

g.test('render_bundle_execution_state_invalidation')
  .desc(
    `
    Validate that executeBundles invalidates the current pipeline and immediate data state
    in the RenderPassEncoder.
    - Pipeline must be re-set after executeBundles.
    - Immediate data must be re-set after executeBundles.
    - setImmediates in bundle does not leak to pass.
    `
  )
  .params(u =>
    u.combine('check', [
      'pipeline_invalidated',
      'immediates_invalidated',
      'bundle_no_leak',
      'pipeline_and_immediates_reset',
    ] as const)
  )
  .fn(t => {
    const { check } = t.params;
    const kImmediateSize = 16;

    // Create a pipeline requiring immediate data
    const code = `
      var<immediate> data: vec4<u32>;
      @vertex fn main_vertex() -> @builtin(position) vec4<f32> { _ = data; return vec4<f32>(0.0, 0.0, 0.0, 1.0); }
      @fragment fn main_fragment() -> @location(0) vec4<f32> { _ = data; return vec4<f32>(0.0, 1.0, 0.0, 1.0); }
    `;
    const pipeline = t.createPipeline('render pass', code, kImmediateSize) as GPURenderPipeline;

    // Create an empty bundle (or one that sets immediates for the leak test)
    const bundleEncoder = t.device.createRenderBundleEncoder({
      colorFormats: ['rgba8unorm'],
    });
    if (check === 'bundle_no_leak') {
      bundleEncoder.setPipeline(pipeline);
      const immediateData = new Uint8Array(16);
      (bundleEncoder as unknown as EncoderWithImmediates).setImmediates(0, immediateData, 0, 16);
      bundleEncoder.draw(3);
    }
    const bundle = bundleEncoder.finish();

    const { encoder, validateFinishAndSubmit } = t.createEncoder('render pass');
    const pass = encoder;

    // Initial setup
    pass.setPipeline(pipeline);
    const immediateData = new Uint8Array(16);
    (pass as unknown as EncoderWithImmediates).setImmediates(0, immediateData, 0, 16);

    // Execute bundle - this should invalidate state
    pass.executeBundles([bundle]);

    // Try to draw
    if (check === 'pipeline_invalidated') {
      // Don't re-set pipeline. Should fail.
      pass.draw(3);
      validateFinishAndSubmit(false, true);
    } else if (check === 'immediates_invalidated') {
      // Re-set pipeline, but not immediates. Should fail.
      pass.setPipeline(pipeline);
      pass.draw(3);
      validateFinishAndSubmit(false, true);
    } else if (check === 'bundle_no_leak') {
      // Re-set pipeline. Bundle had setImmediates, but it shouldn't leak.
      // We didn't re-set immediates in the pass. Should fail.
      pass.setPipeline(pipeline);
      pass.draw(3);
      validateFinishAndSubmit(false, true);
    } else if (check === 'pipeline_and_immediates_reset') {
      // Re-set pipeline and immediates. Should succeed.
      pass.setPipeline(pipeline);
      (pass as unknown as EncoderWithImmediates).setImmediates(0, immediateData, 0, 16);
      pass.draw(3);
      validateFinishAndSubmit(true, true);
    }
  });
