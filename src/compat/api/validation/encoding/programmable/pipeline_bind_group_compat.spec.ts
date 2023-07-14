export const description = `
Tests limitations of bind group usage in a pipeline in compat mode.
`;

import { makeTestGroup } from '../../../../../common/internal/test_group.js';
import { keysOf } from '../../../../../common/util/data_tables.js';
import { ValidationTest } from '../../../../../webgpu/api/validation/validation_test.js';
import { kRenderEncodeTypes } from '../../../../../webgpu/util/command_buffer_maker.js';

const kTextureTypes = ['regular', 'storage'];
type TextureType = typeof kTextureTypes[number];

function getTextureTypeWGSL(textureType: TextureType) {
  return textureType === 'storage' ? 'texture_storage_2d<rgba8unorm, write>' : 'texture_2d<f32>';
}

type kBindConfigs = ['one bindgroup', 'two bindgroups'];
type BindConfig = kBindConfigs[number];

/**
 * Gets the WGSL needed for testing a render pipeline using texture_2d or texture_storage_2d
 * and either 2 bindgroups or 1
 */
function getRenderPipelineWGSL(textureType: TextureType, bindConfig: BindConfig) {
  const textureTypeWGSL = getTextureTypeWGSL(textureType);
  const secondGroup = bindConfig === 'one bindgroup' ? 0 : 1;
  const secondBinding = secondGroup === 0 ? 1 : 0;
  return `
  @vertex
  fn vs(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4f {
    var pos = array(
      vec4f(-1,  3, 0, 1),
      vec4f( 3, -1, 0, 1),
      vec4f(-1, -1, 0, 1));
    return pos[VertexIndex];
  }

  @group(0) @binding(0) var tex0 : ${textureTypeWGSL};
  @group(${secondGroup}) @binding(${secondBinding}) var tex1 : ${textureTypeWGSL};

  @fragment
  fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    _ = tex0;
    _ = tex1;
    return vec4f(0);
  }
  `;
}

/**
 * Gets the WGSL needed for testing a compute pipeline using texture_2d or texture_storage_2d
 * and either 2 bindgroups or 1
 */
function getComputePipelineWGSL(textureType: TextureType, bindConfig: BindConfig) {
  const textureTypeWGSL = getTextureTypeWGSL(textureType);
  const secondGroup = bindConfig === 'one bindgroup' ? 0 : 1;
  const secondBinding = secondGroup === 0 ? 1 : 0;
  return `
  @group(0) @binding(0) var tex0 : ${textureTypeWGSL};
  @group(${secondGroup}) @binding(${secondBinding}) var tex1 : ${textureTypeWGSL};

  @compute @workgroup_size(1)
  fn cs() {
    _ = tex0;
    _ = tex1;
  }
  `;
}

type GPUEncoderType = GPURenderPassEncoder | GPUComputePassEncoder | GPURenderBundleEncoder;

const kBindCases: {
  [key: string]: {
    bindConfig: BindConfig;
    fn: (
      device: GPUDevice,
      pipeline: GPUPipelineBase,
      encoder: GPUEncoderType,
      texture: GPUTexture
    ) => {
      shouldSucceed: boolean;
      use: boolean;
    };
  };
} = {
  'incompatible views in the same bindGroup': {
    bindConfig: 'one bindgroup',
    fn(device: GPUDevice, pipeline: GPUPipelineBase, encoder: GPUEncoderType, texture: GPUTexture) {
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: texture.createView({ baseMipLevel: 0, mipLevelCount: 1 }) },
          { binding: 1, resource: texture.createView({ baseMipLevel: 1, mipLevelCount: 1 }) },
        ],
      });
      encoder.setBindGroup(0, bindGroup);
      return { shouldSucceed: false, use: true };
    },
  },
  'incompatible views in different bindGroups': {
    bindConfig: 'two bindgroups',
    fn(device: GPUDevice, pipeline: GPUPipelineBase, encoder: GPUEncoderType, texture: GPUTexture) {
      const bindGroup0 = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: texture.createView({ baseMipLevel: 0, mipLevelCount: 1 }) },
        ],
      });
      const bindGroup1 = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: texture.createView({ baseMipLevel: 1, mipLevelCount: 1 }) },
        ],
      });
      encoder.setBindGroup(0, bindGroup0);
      encoder.setBindGroup(1, bindGroup1);
      return { shouldSucceed: false, use: true };
    },
  },
  'can bind same view in different bindGroups': {
    bindConfig: 'two bindgroups',
    fn(device: GPUDevice, pipeline: GPUPipelineBase, encoder: GPUEncoderType, texture: GPUTexture) {
      const bindGroup0 = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: texture.createView({ baseMipLevel: 1, mipLevelCount: 1 }) },
        ],
      });
      const bindGroup1 = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: texture.createView({ baseMipLevel: 1, mipLevelCount: 1 }) },
        ],
      });
      encoder.setBindGroup(0, bindGroup0);
      encoder.setBindGroup(1, bindGroup1);
      return { shouldSucceed: true, use: true };
    },
  },
  'binding incompatible bindGroups then fix': {
    bindConfig: 'one bindgroup',
    fn(device: GPUDevice, pipeline: GPUPipelineBase, encoder: GPUEncoderType, texture: GPUTexture) {
      const badBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: texture.createView({ baseMipLevel: 0, mipLevelCount: 1 }) },
          { binding: 1, resource: texture.createView({ baseMipLevel: 1, mipLevelCount: 1 }) },
        ],
      });
      const goodBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: texture.createView({ baseMipLevel: 1, mipLevelCount: 1 }) },
          { binding: 1, resource: texture.createView({ baseMipLevel: 1, mipLevelCount: 1 }) },
        ],
      });
      encoder.setBindGroup(0, badBindGroup);
      encoder.setBindGroup(0, goodBindGroup);
      return { shouldSucceed: true, use: true };
    },
  },
  'binding incompatible bindGroups without using': {
    bindConfig: 'two bindgroups',
    fn(device: GPUDevice, pipeline: GPUPipelineBase, encoder: GPUEncoderType, texture: GPUTexture) {
      const bindGroup0 = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: texture.createView({ baseMipLevel: 0, mipLevelCount: 1 }) },
        ],
      });
      const bindGroup1 = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: texture.createView({ baseMipLevel: 1, mipLevelCount: 1 }) },
        ],
      });
      encoder.setBindGroup(0, bindGroup0);
      encoder.setBindGroup(1, bindGroup1);
      return { shouldSucceed: true, use: false };
    },
  },
};
const kBindCaseNames = keysOf(kBindCases);

const kDrawUseCases: {
  [key: string]: (t: ValidationTest, encoder: GPURenderCommandsMixin) => void;
} = {
  draw: (t: ValidationTest, encoder: GPURenderCommandsMixin) => {
    encoder.draw(3);
  },
  drawIndexed: (t: ValidationTest, encoder: GPURenderCommandsMixin) => {
    const indexBuffer = t.makeBufferWithContents(new Uint16Array([0, 1, 2]), GPUBufferUsage.INDEX);
    encoder.setIndexBuffer(indexBuffer, 'uint16');
    encoder.drawIndexed(3);
  },
  drawIndirect(t: ValidationTest, encoder: GPURenderCommandsMixin) {
    const indirectBuffer = t.makeBufferWithContents(
      new Uint32Array([3, 1, 0, 0]),
      GPUBufferUsage.INDIRECT
    );
    encoder.drawIndirect(indirectBuffer, 0);
  },
  drawIndexedIndirect(t: ValidationTest, encoder: GPURenderCommandsMixin) {
    const indexBuffer = t.makeBufferWithContents(new Uint16Array([0, 1, 2]), GPUBufferUsage.INDEX);
    encoder.setIndexBuffer(indexBuffer, 'uint16');
    const indirectBuffer = t.makeBufferWithContents(
      new Uint32Array([3, 1, 0, 0, 0]),
      GPUBufferUsage.INDIRECT
    );
    encoder.drawIndexedIndirect(indirectBuffer, 0);
  },
};
const kDrawCaseNames = keysOf(kDrawUseCases);

const kDispatchUseCases: {
  [key: string]: (t: ValidationTest, encoder: GPUComputePassEncoder) => void;
} = {
  dispatchWorkgroups(t: ValidationTest, encoder: GPUComputePassEncoder) {
    encoder.dispatchWorkgroups(1);
  },
  dispatchWorkgroupsIndirect(t: ValidationTest, encoder: GPUComputePassEncoder) {
    const indirectBuffer = t.makeBufferWithContents(
      new Uint32Array([1, 1, 1]),
      GPUBufferUsage.INDIRECT
    );
    encoder.dispatchWorkgroupsIndirect(indirectBuffer, 0);
  },
};
const kDispatchCaseNames = keysOf(kDispatchUseCases);

export const g = makeTestGroup(ValidationTest);

g.test('twoDifferentTextureViews,render_pass')
  .desc(
    `
Tests that you can not use 2 different views of the same texture in a render pass in compat mode..

- Test you can not use incompatible views in the same bindGroup
- Test you can not use incompatible views in different bindGroups
- Test you can bind the same view in different bindGroups
- Test binding incompatible bindGroups is ok as long as they are fixed before draw/dispatch
- Test binding incompatible bindGroups is ok if there's no draw/dispatch

  The last 2 tests are to check validation happens at the correct time (draw/dispatch) and not
  at finish or setBindGroup.
    `
  )
  .params(u =>
    u
      .combine('encoderType', kRenderEncodeTypes)
      .combine('bindCase', kBindCaseNames)
      .combine('useCase', kDrawCaseNames)
      .combine('textureType', kTextureTypes)
      .filter(
        // storage textures can't have 2 bind groups point to the same
        // view even in non-compat. They can have different views in
        // non-compat but not compat.
        p =>
          !(
            p.textureType === 'storage' &&
            (p.bindCase === 'can bind same view in different bindGroups' ||
              p.bindCase === 'binding incompatible bindGroups then fix')
          )
      )
  )
  .fn(t => {
    const { encoderType, bindCase, useCase, textureType } = t.params;
    const { bindConfig, fn } = kBindCases[bindCase];

    const texture = t.device.createTexture({
      size: [2, 1, 1],
      mipLevelCount: 2,
      format: 'rgba8unorm',
      usage:
        textureType === 'storage'
          ? GPUTextureUsage.STORAGE_BINDING
          : GPUTextureUsage.TEXTURE_BINDING,
    });
    t.trackForCleanup(texture);

    const code = getRenderPipelineWGSL(textureType, bindConfig);
    const module = t.device.createShaderModule({ code });

    const pipeline = t.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs',
      },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [{ format: 'rgba8unorm' }],
      },
    });

    const { encoder, validateFinish } = t.createEncoder(encoderType);
    encoder.setPipeline(pipeline);

    const { shouldSucceed, use } = fn(t.device, pipeline, encoder, texture);
    if (use) {
      kDrawUseCases[useCase](t, encoder as GPURenderCommandsMixin);
    }
    validateFinish(shouldSucceed);
  });

g.test('twoDifferentTextureViews,compute_pass')
  .desc(
    `
Tests that you can not use 2 different views of the same texture in a compute pass in compat mode..

- Test you can not use incompatible views in the same bindGroup
- Test you can not use incompatible views in different bindGroups
- Test can bind the same view in different bindGroups
- Test that binding incompatible bindGroups is ok as long as they are fixed before draw/dispatch
- Test that binding incompatible bindGroups is ok if there's no draw/dispatch

  The last 2 tests are to check validation happens at the correct time (draw/dispatch) and not
  at finish or setBindGroup.
    `
  )
  .params(u =>
    u
      .combine('bindCase', kBindCaseNames)
      .combine('useCase', kDispatchCaseNames)
      .combine('textureType', kTextureTypes)
      .filter(
        // storage textures can't have 2 bind groups point to the same
        // view even in non-compat. They can have different views in
        // non-compat but not compat.
        p =>
          !(
            p.textureType === 'storage' &&
            (p.bindCase === 'can bind same view in different bindGroups' ||
              p.bindCase === 'binding incompatible bindGroups then fix')
          )
      )
  )
  .fn(t => {
    const { bindCase, useCase, textureType } = t.params;
    const { bindConfig, fn } = kBindCases[bindCase];

    const texture = t.device.createTexture({
      size: [2, 1, 1],
      mipLevelCount: 2,
      format: 'rgba8unorm',
      usage:
        textureType === 'storage'
          ? GPUTextureUsage.STORAGE_BINDING
          : GPUTextureUsage.TEXTURE_BINDING,
    });
    t.trackForCleanup(texture);

    const code = getComputePipelineWGSL(textureType, bindConfig);
    const module = t.device.createShaderModule({ code });

    const pipeline = t.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module,
        entryPoint: 'cs',
      },
    });

    const { encoder, validateFinish } = t.createEncoder('compute pass');
    encoder.setPipeline(pipeline);

    const { shouldSucceed, use } = fn(t.device, pipeline, encoder, texture);
    if (use) {
      kDispatchUseCases[useCase](t, encoder);
    }
    validateFinish(shouldSucceed);
  });
