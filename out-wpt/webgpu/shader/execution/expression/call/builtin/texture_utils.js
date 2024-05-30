/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/import { assert, range, unreachable } from '../../../../../../common/util/util.js';import {
  isCompressedTextureFormat,
  kEncodableTextureFormats,
  kTextureFormatInfo } from
'../../../../../format_info.js';

import { float32ToUint32 } from '../../../../../util/conversion.js';
import {
  align,
  clamp,
  dotProduct,
  hashU32,
  lerp,
  quantizeToF32 } from
'../../../../../util/math.js';
import { physicalMipSizeFromTexture, virtualMipSize } from '../../../../../util/texture/base.js';
import {
  kTexelRepresentationInfo } from


'../../../../../util/texture/texel_data.js';
import { TexelView } from '../../../../../util/texture/texel_view.js';
import { createTextureFromTexelViews } from '../../../../../util/texture.js';
import { reifyExtent3D } from '../../../../../util/unions.js';

function getLimitValue(v) {
  switch (v) {
    case Number.POSITIVE_INFINITY:
      return 1000;
    case Number.NEGATIVE_INFINITY:
      return -1000;
    default:
      return v;
  }
}

function getValueBetweenMinAndMaxTexelValueInclusive(
rep,
normalized)
{
  return lerp(
    getLimitValue(rep.numericRange.min),
    getLimitValue(rep.numericRange.max),
    normalized
  );
}

/**
 * We need the software rendering to do the same interpolation as the hardware
 * rendered so for -srgb formats we set the TexelView to an -srgb format as
 * TexelView handles this case. Note: It might be nice to add rgba32float-srgb
 * or something similar to TexelView.
 */
export function getTexelViewFormatForTextureFormat(format) {
  return format.endsWith('-srgb') ? 'rgba8unorm-srgb' : 'rgba32float';
}

/**
 * Creates a TexelView filled with random values.
 */
export function createRandomTexelView(info)


{
  const rep = kTexelRepresentationInfo[info.format];
  const generator = (coords) => {
    const texel = {};
    for (const component of rep.componentOrder) {
      const rnd = hashU32(coords.x, coords.y, coords.z, component.charCodeAt(0));
      const normalized = clamp(rnd / 0xffffffff, { min: 0, max: 1 });
      texel[component] = getValueBetweenMinAndMaxTexelValueInclusive(rep, normalized);
    }
    return quantize(texel, rep);
  };
  return TexelView.fromTexelsAsColors(info.format, generator);
}

/**
 * Creates a mip chain of TexelViews filled with random values
 */
export function createRandomTexelViewMipmap(info)




{
  const mipLevelCount = info.mipLevelCount ?? 1;
  const dimension = info.dimension ?? '2d';
  const size = reifyExtent3D(info.size);
  const tSize = [size.width, size.height, size.depthOrArrayLayers];
  return range(mipLevelCount, (i) =>
  createRandomTexelView({
    format: info.format,
    size: virtualMipSize(dimension, tSize, i)
  })
  );
}







const kTextureCallArgNames = [
'coords',
'mipLevel',
'arrayIndex',
'ddx',
'ddy',
'offset'];
















function toArray(coords) {
  if (coords instanceof Array) {
    return coords;
  }
  return [coords];
}

function quantize(texel, repl) {
  return repl.bitsToNumber(repl.unpackBits(new Uint8Array(repl.pack(repl.encode(texel)))));
}

function apply(a, b, op) {
  assert(a.length === b.length, `apply(${a}, ${b}): arrays must have same length`);
  return a.map((v, i) => op(v, b[i]));
}

const add = (a, b) => apply(a, b, (x, y) => x + y);






/**
 * Returns the expect value for a WGSL builtin texture function for a single
 * mip level
 */
export function softwareTextureReadMipLevel(
call,
texture,
sampler,
mipLevel)
{
  const rep = kTexelRepresentationInfo[texture.texels[mipLevel].format];
  const tSize = reifyExtent3D(texture.descriptor.size);
  const textureSize = virtualMipSize(
    texture.descriptor.dimension || '2d',
    [tSize.width, tSize.height, tSize.depthOrArrayLayers],
    mipLevel
  );
  const addressMode = [
  sampler.addressModeU ?? 'clamp-to-edge',
  sampler.addressModeV ?? 'clamp-to-edge',
  sampler.addressModeW ?? 'clamp-to-edge'];


  const load = (at) =>
  texture.texels[mipLevel].color({
    x: Math.floor(at[0]),
    y: Math.floor(at[1] ?? 0),
    z: Math.floor(at[2] ?? 0)
  });

  switch (call.builtin) {
    case 'textureSample':{
        const coords = toArray(call.coords);

        // convert normalized to absolute texel coordinate
        // ┌───┬───┬───┬───┐
        // │ a │   │   │   │  norm: a = 1/8, b = 7/8
        // ├───┼───┼───┼───┤   abs: a = 0,   b = 3
        // │   │   │   │   │
        // ├───┼───┼───┼───┤
        // │   │   │   │   │
        // ├───┼───┼───┼───┤
        // │   │   │   │ b │
        // └───┴───┴───┴───┘
        let at = coords.map((v, i) => v * textureSize[i] - 0.5);

        // Apply offset in whole texel units
        // This means the offset is added at each mip level in texels. There's no
        // scaling for each level.
        if (call.offset !== undefined) {
          at = add(at, toArray(call.offset));
        }

        const samples = [];

        const filter = sampler.minFilter;
        switch (filter) {
          case 'linear':{
              // 'p0' is the lower texel for 'at'
              const p0 = at.map((v) => Math.floor(v));
              // 'p1' is the higher texel for 'at'
              const p1 = p0.map((v) => v + 1);

              // interpolation weights for p0 and p1
              const p1W = at.map((v, i) => v - p0[i]);
              const p0W = p1W.map((v) => 1 - v);

              switch (coords.length) {
                case 1:
                  samples.push({ at: p0, weight: p0W[0] });
                  samples.push({ at: p1, weight: p1W[0] });
                  break;
                case 2:{
                    samples.push({ at: p0, weight: p0W[0] * p0W[1] });
                    samples.push({ at: [p1[0], p0[1]], weight: p1W[0] * p0W[1] });
                    samples.push({ at: [p0[0], p1[1]], weight: p0W[0] * p1W[1] });
                    samples.push({ at: p1, weight: p1W[0] * p1W[1] });
                    break;
                  }
              }
              break;
            }
          case 'nearest':{
              const p = at.map((v) => Math.round(quantizeToF32(v)));
              samples.push({ at: p, weight: 1 });
              break;
            }
          default:
            unreachable();
        }

        const out = {};
        const ss = [];
        for (const sample of samples) {
          // Apply sampler address mode
          const c = sample.at.map((v, i) => {
            switch (addressMode[i]) {
              case 'clamp-to-edge':
                return clamp(v, { min: 0, max: textureSize[i] - 1 });
              case 'mirror-repeat':{
                  const n = Math.floor(v / textureSize[i]);
                  v = v - n * textureSize[i];
                  return (n & 1) !== 0 ? textureSize[i] - v - 1 : v;
                }
              case 'repeat':
                return v - Math.floor(v / textureSize[i]) * textureSize[i];
              default:
                unreachable();
            }
          });
          const v = load(c);
          ss.push(v);
          for (const component of rep.componentOrder) {
            out[component] = (out[component] ?? 0) + v[component] * sample.weight;
          }
        }

        return out;
      }
    case 'textureLoad':{
        return load(toArray(call.coords));
      }
  }
}

/**
 * The software version of a texture builtin (eg: textureSample)
 * Note that this is not a complete implementation. Rather it's only
 * what's needed to generate the correct expected value for the tests.
 */
export function softwareTextureRead(
call,
texture,
sampler)
{
  assert(call.ddx !== undefined);
  assert(call.ddy !== undefined);
  const rep = kTexelRepresentationInfo[texture.texels[0].format];
  const texSize = reifyExtent3D(texture.descriptor.size);
  const textureSize = [texSize.width, texSize.height];

  // ddx and ddy are the values that would be passed to textureSampleGrad
  // If we're emulating textureSample then they're the computed derivatives
  // such that if we passed them to textureSampleGrad they'd produce the
  // same result.
  const ddx = typeof call.ddx === 'number' ? [call.ddx] : call.ddx;
  const ddy = typeof call.ddy === 'number' ? [call.ddy] : call.ddy;

  // Compute the mip level the same way textureSampleGrad does
  const scaledDdx = ddx.map((v, i) => v * textureSize[i]);
  const scaledDdy = ddy.map((v, i) => v * textureSize[i]);
  const dotDDX = dotProduct(scaledDdx, scaledDdx);
  const dotDDY = dotProduct(scaledDdy, scaledDdy);
  const deltaMax = Math.max(dotDDX, dotDDY);
  // MAINTENANCE_TODO: handle texture view baseMipLevel and mipLevelCount?
  const mipLevel = 0.5 * Math.log2(deltaMax);

  const mipLevelCount = texture.texels.length;
  const maxLevel = mipLevelCount - 1;

  switch (sampler.mipmapFilter) {
    case 'linear':{
        const clampedMipLevel = clamp(mipLevel, { min: 0, max: maxLevel });
        const baseMipLevel = Math.floor(clampedMipLevel);
        const nextMipLevel = Math.ceil(clampedMipLevel);
        const t0 = softwareTextureReadMipLevel(call, texture, sampler, baseMipLevel);
        const t1 = softwareTextureReadMipLevel(call, texture, sampler, nextMipLevel);
        const mix = mipLevel % 1;
        const values = [
        { v: t0, weight: 1 - mix },
        { v: t1, weight: mix }];

        const out = {};
        for (const { v, weight } of values) {
          for (const component of rep.componentOrder) {
            out[component] = (out[component] ?? 0) + v[component] * weight;
          }
        }
        return out;
      }
    default:{
        const baseMipLevel = Math.floor(
          clamp(mipLevel + 0.5, { min: 0, max: texture.texels.length - 1 })
        );
        return softwareTextureReadMipLevel(call, texture, sampler, baseMipLevel);
      }
  }
}








/**
 * Checks the result of each call matches the expected result.
 */
export async function checkCallResults(
device,
texture,
sampler,
calls,
results)
{
  const errs = [];
  const rep = kTexelRepresentationInfo[texture.texels[0].format];
  const maxFractionalDiff = getMaxFractionalDiffForTextureFormat(texture.descriptor.format);
  for (let callIdx = 0; callIdx < calls.length; callIdx++) {
    const call = calls[callIdx];
    const got = results[callIdx];
    const expect = softwareTextureReadMipLevel(call, texture, sampler, 0);

    const gULP = rep.bitsToULPFromZero(rep.numberToBits(got));
    const eULP = rep.bitsToULPFromZero(rep.numberToBits(expect));
    for (const component of rep.componentOrder) {
      const g = got[component];
      const e = expect[component];
      const absDiff = Math.abs(g - e);
      const ulpDiff = Math.abs(gULP[component] - eULP[component]);
      const relDiff = absDiff / Math.max(Math.abs(g), Math.abs(e));
      if (ulpDiff > 3 && absDiff > maxFractionalDiff) {
        const desc = describeTextureCall(call);
        errs.push(`component was not as expected:
      call: ${desc}
 component: ${component}
       got: ${g}
  expected: ${e}
  abs diff: ${absDiff.toFixed(4)}
  rel diff: ${(relDiff * 100).toFixed(2)}%
  ulp diff: ${ulpDiff}
  sample points:
`);
        const expectedSamplePoints = [
        'expected:',
        ...(await identifySamplePoints(texture.descriptor, (texels) => {
          return Promise.resolve(
            softwareTextureReadMipLevel(
              call,
              { texels: [texels], descriptor: texture.descriptor },
              sampler,
              0
            )
          );
        }))];

        const gotSamplePoints = [
        'got:',
        ...(await identifySamplePoints(texture.descriptor, async (texels) => {
          const gpuTexture = createTextureFromTexelViews(device, [texels], texture.descriptor);
          const result = (await doTextureCalls(device, gpuTexture, sampler, [call]))[0];
          gpuTexture.destroy();
          return result;
        }))];

        errs.push(layoutTwoColumns(expectedSamplePoints, gotSamplePoints).join('\n'));
        errs.push('', '');
      }
    }
  }

  return errs.length > 0 ? new Error(errs.join('\n')) : undefined;
}

/**
 * "Renders a quad" to a TexelView with the given parameters,
 * sampling from the given Texture.
 */
export function softwareRasterize(
texture,
sampler,
targetSize,
options)
{
  const [width, height] = targetSize;
  const { ddx = 1, ddy = 1, uvwStart = [0, 0] } = options;
  const format = 'rgba32float';

  const textureSize = reifyExtent3D(texture.descriptor.size);

  // MAINTENANCE_TODO: Consider passing these in as a similar computation
  // happens in putDataInTextureThenDrawAndCheckResultsComparedToSoftwareRasterizer.
  // The issue is there, the calculation is "what do we need to multiply the unitQuad
  // by to get the derivatives we want". The calculation here is "what coordinate
  // will we get for a given frag coordinate". It turns out to be the same calculation
  // but needs rephrasing them so they are more obviously the same would help
  // consolidate them into one calculation.
  const screenSpaceUMult = ddx * width / textureSize.width;
  const screenSpaceVMult = ddy * height / textureSize.height;

  const rep = kTexelRepresentationInfo[format];

  const expData = new Float32Array(width * height * 4);
  for (let y = 0; y < height; ++y) {
    const fragY = height - y - 1 + 0.5;
    for (let x = 0; x < width; ++x) {
      const fragX = x + 0.5;
      // This code calculates the same value that will be passed to
      // `textureSample` in the fragment shader for a given frag coord (see the
      // WGSL code which uses the same formula, but using interpolation). That
      // shader renders a clip space quad and includes a inter-stage "uv"
      // coordinates that start with a unit quad (0,0) to (1,1) and is
      // multiplied by ddx,ddy and as added in uStart and vStart
      //
      // uv = unitQuad * vec2(ddx, ddy) + vec2(vStart, uStart);
      //
      // softwareTextureRead<T> simulates a single call to `textureSample` so
      // here we're computing the `uv` value that will be passed for a
      // particular fragment coordinate. fragX / width, fragY / height provides
      // the unitQuad value.
      //
      // ddx and ddy in this case are the derivative values we want to test. We
      // pass those into the softwareTextureRead<T> as they would normally be
      // derived from the change in coord.
      const coords = [
      fragX / width * screenSpaceUMult + uvwStart[0],
      fragY / height * screenSpaceVMult + uvwStart[1]];

      const call = {
        builtin: 'textureSample',
        coordType: 'f',
        coords,
        ddx: [ddx / textureSize.width, 0],
        ddy: [0, ddy / textureSize.height],
        offset: options.offset
      };
      const sample = softwareTextureRead(call, texture, sampler);
      const rgba = { R: 0, G: 0, B: 0, A: 1, ...sample };
      const asRgba32Float = new Float32Array(rep.pack(rgba));
      expData.set(asRgba32Float, (y * width + x) * 4);
    }
  }

  return TexelView.fromTextureDataByReference(format, new Uint8Array(expData.buffer), {
    bytesPerRow: width * 4 * 4,
    rowsPerImage: height,
    subrectOrigin: [0, 0, 0],
    subrectSize: targetSize
  });
}

/**
 * Render textured quad to an rgba32float texture.
 */
export function drawTexture(
t,
texture,
samplerDesc,
options)
{
  const device = t.device;
  const { ddx = 1, ddy = 1, uvwStart = [0, 0, 0], offset } = options;

  const format = 'rgba32float';
  const renderTarget = device.createTexture({
    format,
    size: [32, 32],
    usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT
  });
  t.trackForCleanup(renderTarget);

  // Compute the amount we need to multiply the unitQuad by get the
  // derivatives we want.
  const uMult = ddx * renderTarget.width / texture.width;
  const vMult = ddy * renderTarget.height / texture.height;

  const offsetWGSL = offset ? `, vec2i(${offset[0]},${offset[1]})` : '';

  const code = `
struct InOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

@vertex fn vs(@builtin(vertex_index) vertex_index : u32) -> InOut {
  let positions = array(
    vec2f(-1,  1), vec2f( 1,  1),
    vec2f(-1, -1), vec2f( 1, -1),
  );
  let pos = positions[vertex_index];
  return InOut(
    vec4f(pos, 0, 1),
    (pos * 0.5 + 0.5) * vec2f(${uMult}, ${vMult}) + vec2f(${uvwStart[0]}, ${uvwStart[1]}),
  );
}

@group(0) @binding(0) var          T    : texture_2d<f32>;
@group(0) @binding(1) var          S    : sampler;

@fragment fn fs(v: InOut) -> @location(0) vec4f {
  return textureSample(T, S, v.uv${offsetWGSL});
}
`;

  const shaderModule = device.createShaderModule({ code });

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: shaderModule },
    fragment: {
      module: shaderModule,
      targets: [{ format }]
    },
    primitive: { topology: 'triangle-strip' }
  });

  const sampler = device.createSampler(samplerDesc);

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
    { binding: 0, resource: texture.createView() },
    { binding: 1, resource: sampler }]

  });

  const encoder = device.createCommandEncoder();

  const renderPass = encoder.beginRenderPass({
    colorAttachments: [{ view: renderTarget.createView(), loadOp: 'clear', storeOp: 'store' }]
  });

  renderPass.setPipeline(pipeline);
  renderPass.setBindGroup(0, bindGroup);
  renderPass.draw(4);
  renderPass.end();
  device.queue.submit([encoder.finish()]);

  return renderTarget;
}

function getMaxFractionalDiffForTextureFormat(format) {
  // Note: I'm not sure what we should do here. My assumption is, given texels
  // have random values, the difference between 2 texels can be very large. In
  // the current version, for a float texture they can be +/- 1000 difference.
  // Sampling is very GPU dependent. So if one pixel gets a random value of
  // -1000 and the neighboring pixel gets +1000 then any slight variation in how
  // sampling is applied will generate a large difference when interpolating
  // between -1000 and +1000.
  //
  // We could make some entry for every format but for now I just put the
  // tolerances here based on format texture suffix.
  //
  // It's possible the math in the software rasterizer is just bad but the
  // results certainly seem close.
  //
  // These tolerances started from the OpenGL ES dEQP tests.
  // Those tests always render to an rgba8unorm texture. The shaders do effectively
  //
  //   result = textureSample(...) * scale + bias
  //
  // to get the results in a 0.0 to 1.0 range. After reading the values back they
  // expand them to their original ranges with
  //
  //   value = (result - bias) / scale;
  //
  // Tolerances from dEQP
  // --------------------
  // 8unorm: 3.9 / 255
  // 8snorm: 7.9 / 128
  // 2unorm: 7.9 / 512
  // ufloat: 156.249
  //  float: 31.2498
  //
  // The numbers below have been set empirically to get the tests to pass on all
  // devices. The devices with the most divergence from the calculated expected
  // values are MacOS Intel and AMD.
  //
  // MAINTENANCE_TODO: Double check the software rendering math and lower these
  // tolerances if possible.

  if (format.includes('8unorm')) {
    return 7 / 255;
  } else if (format.includes('2unorm')) {
    return 9 / 512;
  } else if (format.includes('unorm')) {
    return 7 / 255;
  } else if (format.includes('8snorm')) {
    return 7.9 / 128;
  } else if (format.includes('snorm')) {
    return 7.9 / 128;
  } else if (format.endsWith('ufloat')) {
    return 156.249;
  } else if (format.endsWith('float')) {
    return 44;
  } else {
    unreachable();
  }
}

export function checkTextureMatchesExpectedTexelView(
t,
format,
actualTexture,
expectedTexelView)
{
  const maxFractionalDiff = getMaxFractionalDiffForTextureFormat(format);
  t.expectTexelViewComparisonIsOkInTexture(
    { texture: actualTexture },
    expectedTexelView,
    [actualTexture.width, actualTexture.height],
    { maxFractionalDiff }
  );
}

/**
 * Puts data in a texture. Renders a quad to a rgba32float. Then "software renders"
 * to a TexelView the expected result and compares the rendered texture to the
 * expected TexelView.
 */
export async function putDataInTextureThenDrawAndCheckResultsComparedToSoftwareRasterizer(


t,
descriptor,
samplerDesc,
options)
{
  const { texture, texels } = await createTextureWithRandomDataAndGetTexels(t, descriptor);

  const actualTexture = drawTexture(t, texture, samplerDesc, options);
  const expectedTexelView = softwareRasterize(
    { descriptor, texels },
    samplerDesc,
    [actualTexture.width, actualTexture.height],
    options
  );

  checkTextureMatchesExpectedTexelView(t, texture.format, actualTexture, expectedTexelView);
}

const sumOfCharCodesOfString = (s) =>
String(s).
split('').
reduce((sum, c) => sum + c.charCodeAt(0), 0);

/**
 * Makes a function that fills a block portion of a Uint8Array with random valid data
 * for an astc block.
 *
 * The astc format is fairly complicated. For now we do the simplest thing.
 * which is to set the block as a "void-extent" block (a solid color).
 * This makes our test have far less precision.
 *
 * MAINTENANCE_TODO: generate other types of astc blocks. One option would
 * be to randomly select from set of pre-made blocks.
 *
 * See Spec:
 * https://registry.khronos.org/OpenGL/extensions/KHR/KHR_texture_compression_astc_hdr.txt
 */
function makeAstcBlockFiller(format) {
  const info = kTextureFormatInfo[format];
  const bytesPerBlock = info.color.bytes;
  return (data, offset, hashBase) => {
    // set the block to be a void-extent block
    data.set(
      [
      0b1111_1100, // 0
      0b1111_1101, // 1
      0b1111_1111, // 2
      0b1111_1111, // 3
      0b1111_1111, // 4
      0b1111_1111, // 5
      0b1111_1111, // 6
      0b1111_1111 // 7
      ],
      offset
    );
    // fill the rest of the block with random data
    const end = offset + bytesPerBlock;
    for (let i = offset + 8; i < end; ++i) {
      data[i] = hashU32(hashBase, i);
    }
  };
}

/**
 * Makes a function that fills a block portion of a Uint8Array with random bytes.
 */
function makeRandomBytesBlockFiller(format) {
  const info = kTextureFormatInfo[format];
  const bytesPerBlock = info.color.bytes;
  return (data, offset, hashBase) => {
    const end = offset + bytesPerBlock;
    for (let i = offset; i < end; ++i) {
      data[i] = hashU32(hashBase, i);
    }
  };
}

function getBlockFiller(format) {
  if (format.startsWith('astc')) {
    return makeAstcBlockFiller(format);
  } else {
    return makeRandomBytesBlockFiller(format);
  }
}

/**
 * Fills a texture with random data.
 */
export function fillTextureWithRandomData(device, texture) {
  const info = kTextureFormatInfo[texture.format];
  const hashBase =
  sumOfCharCodesOfString(texture.format) +
  sumOfCharCodesOfString(texture.dimension) +
  texture.width +
  texture.height +
  texture.depthOrArrayLayers +
  texture.mipLevelCount;
  const bytesPerBlock = info.color.bytes;
  const fillBlock = getBlockFiller(texture.format);
  for (let mipLevel = 0; mipLevel < texture.mipLevelCount; ++mipLevel) {
    const size = physicalMipSizeFromTexture(texture, mipLevel);
    const blocksAcross = Math.ceil(size[0] / info.blockWidth);
    const blocksDown = Math.ceil(size[1] / info.blockHeight);
    const bytesPerRow = blocksAcross * bytesPerBlock;
    const bytesNeeded = bytesPerRow * blocksDown * size[2];
    const data = new Uint8Array(bytesNeeded);
    for (let offset = 0; offset < bytesNeeded; offset += bytesPerBlock) {
      fillBlock(data, offset, hashBase);
    }
    device.queue.writeTexture(
      { texture, mipLevel },
      data,
      { bytesPerRow, rowsPerImage: blocksDown },
      size
    );
  }
}

const s_readTextureToRGBA32DeviceToPipeline = new WeakMap();

export async function readTextureToTexelViews(
t,
texture,
format)
{
  const device = t.device;
  let pipeline = s_readTextureToRGBA32DeviceToPipeline.get(device);
  if (!pipeline) {
    const module = device.createShaderModule({
      code: `
        @group(0) @binding(0) var<uniform> mipLevel: u32;
        @group(0) @binding(1) var tex: texture_2d<f32>;
        @group(0) @binding(2) var<storage, read_write> data: array<vec4f>;
        @compute @workgroup_size(1) fn cs(
          @builtin(global_invocation_id) global_invocation_id : vec3<u32>) {
          let size = textureDimensions(tex, mipLevel);
          let ndx = global_invocation_id.y * size.x + global_invocation_id.x;
          data[ndx] = textureLoad(tex, global_invocation_id.xy, mipLevel);
        }
      `
    });
    pipeline = device.createComputePipeline({ layout: 'auto', compute: { module } });
    s_readTextureToRGBA32DeviceToPipeline.set(device, pipeline);
  }

  const encoder = device.createCommandEncoder();

  const readBuffers = [];
  const textureSize = [texture.width, texture.height, texture.depthOrArrayLayers];
  for (let mipLevel = 0; mipLevel < texture.mipLevelCount; ++mipLevel) {
    const size = virtualMipSize(texture.dimension, textureSize, mipLevel);

    const uniformValues = new Uint32Array([mipLevel, 0, 0, 0]); // min size is 16 bytes
    const uniformBuffer = device.createBuffer({
      size: uniformValues.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    t.trackForCleanup(uniformBuffer);
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    const storageBuffer = device.createBuffer({
      size: size[0] * size[1] * size[2] * 4 * 4, // rgba32float
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });
    t.trackForCleanup(storageBuffer);

    const readBuffer = device.createBuffer({
      size: storageBuffer.size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
    t.trackForCleanup(readBuffer);
    readBuffers.push({ size, readBuffer });

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: texture.createView() },
      { binding: 2, resource: { buffer: storageBuffer } }]

    });

    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(...size);
    pass.end();
    encoder.copyBufferToBuffer(storageBuffer, 0, readBuffer, 0, readBuffer.size);
  }

  device.queue.submit([encoder.finish()]);

  const texelViews = [];

  for (const { readBuffer, size } of readBuffers) {
    await readBuffer.mapAsync(GPUMapMode.READ);

    // need a copy of the data since unmapping will nullify the typedarray view.
    const data = new Float32Array(readBuffer.getMappedRange()).slice();
    readBuffer.unmap();

    texelViews.push(
      TexelView.fromTexelsAsColors(format, (coord) => {
        const offset = (coord.z * size[0] * size[1] + coord.y * size[0] + coord.x) * 4;
        return {
          R: data[offset + 0],
          G: data[offset + 1],
          B: data[offset + 2],
          A: data[offset + 3]
        };
      })
    );
  }

  return texelViews;
}

/**
 * Fills a texture with random data and returns that data as
 * an array of TexelView.
 *
 * For compressed textures the texture is filled with random bytes
 * and then read back from the GPU by sampling so the GPU decompressed
 * the texture.
 *
 * For uncompressed textures the TexelViews are generated and then
 * copied to the texture.
 */
export async function createTextureWithRandomDataAndGetTexels(
t,
descriptor)
{
  if (isCompressedTextureFormat(descriptor.format)) {
    const texture = t.device.createTexture(descriptor);
    t.trackForCleanup(texture);

    fillTextureWithRandomData(t.device, texture);
    const texels = await readTextureToTexelViews(
      t,
      texture,
      getTexelViewFormatForTextureFormat(texture.format)
    );
    return { texture, texels };
  } else {
    const texels = createRandomTexelViewMipmap(descriptor);
    const texture = createTextureFromTexelViews(t.device, texels, descriptor);
    return { texture, texels };
  }
}

/**
 * Generates a text art grid showing which texels were sampled
 * followed by a list of the samples and the weights used for each
 * component.
 *
 * It works by making an index for every pixel in the texture. Then,
 * for each index it generates texture data using TexelView.fromTexelsAsColor
 * with a single [1, 1, 1, 1] texel at the texel for the current index.
 *
 * In then calls 'run' which renders a single `call`. `run` uses either
 * the software renderer or WebGPU. The result ends up being the weights
 * used when sampling that pixel. 0 = that texel was not sampled. > 0 =
 * it was sampled.
 *
 * This lets you see if the weights from the software renderer match the
 * weights from WebGPU.
 *
 * Example:
 *
 *     0   1   2   3   4   5   6   7
 *   ┌───┬───┬───┬───┬───┬───┬───┬───┐
 * 0 │   │   │   │   │   │   │   │   │
 *   ├───┼───┼───┼───┼───┼───┼───┼───┤
 * 1 │   │   │   │   │   │   │   │ a │
 *   ├───┼───┼───┼───┼───┼───┼───┼───┤
 * 2 │   │   │   │   │   │   │   │ b │
 *   ├───┼───┼───┼───┼───┼───┼───┼───┤
 * 3 │   │   │   │   │   │   │   │   │
 *   ├───┼───┼───┼───┼───┼───┼───┼───┤
 * 4 │   │   │   │   │   │   │   │   │
 *   ├───┼───┼───┼───┼───┼───┼───┼───┤
 * 5 │   │   │   │   │   │   │   │   │
 *   ├───┼───┼───┼───┼───┼───┼───┼───┤
 * 6 │   │   │   │   │   │   │   │   │
 *   ├───┼───┼───┼───┼───┼───┼───┼───┤
 * 7 │   │   │   │   │   │   │   │   │
 *   └───┴───┴───┴───┴───┴───┴───┴───┘
 * a: at: [7, 1], weights: [R: 0.75000]
 * b: at: [7, 2], weights: [R: 0.25000]
 */
async function identifySamplePoints(
info,
run)
{
  const textureSize = reifyExtent3D(info.size);
  const numTexels = textureSize.width * textureSize.height;
  // This isn't perfect. We already know there was an error. We're just
  // generating info so it seems okay it's not perfect. This format will
  // be used to generate weights by drawing with a texture of this format
  // with a specific pixel set to [1, 1, 1, 1]. As such, if the result
  // is > 0 then that pixel was sampled and the results are the weights.
  //
  // Ideally, this texture with a single pixel set to [1, 1, 1, 1] would
  // be the same format we were originally testing, the one we already
  // detected an error for. This way, whatever subtle issues there are
  // from that format will affect the weight values we're computing. But,
  // if that format is not encodable, for example if it's a compressed
  // texture format, then we have no way to build a texture so we use
  // rgba8unorm instead.
  const format =
  kEncodableTextureFormats.includes(info.format) ?
  info.format :
  'rgba8unorm';

  const rep = kTexelRepresentationInfo[format];

  // Identify all the texels that are sampled, and their weights.
  const sampledTexelWeights = new Map();
  const unclassifiedStack = [new Set(range(numTexels, (v) => v))];
  while (unclassifiedStack.length > 0) {
    // Pop the an unclassified texels stack
    const unclassified = unclassifiedStack.pop();

    // Split unclassified texels evenly into two new sets
    const setA = new Set();
    const setB = new Set();
    [...unclassified.keys()].forEach((t, i) => ((i & 1) === 0 ? setA : setB).add(t));

    // Push setB to the unclassified texels stack
    if (setB.size > 0) {
      unclassifiedStack.push(setB);
    }

    // See if any of the texels in setA were sampled.
    const results = await run(
      TexelView.fromTexelsAsColors(
        format,
        (coords) => {
          const isCandidate = setA.has(coords.x + coords.y * textureSize.width);
          const texel = {};
          for (const component of rep.componentOrder) {
            texel[component] = isCandidate ? 1 : 0;
          }
          return texel;
        }
      )
    );
    if (rep.componentOrder.some((c) => results[c] !== 0)) {
      // One or more texels of setA were sampled.
      if (setA.size === 1) {
        // We identified a specific texel was sampled.
        // As there was only one texel in the set, results holds the sampling weights.
        setA.forEach((texel) => sampledTexelWeights.set(texel, results));
      } else {
        // More than one texel in the set. Needs splitting.
        unclassifiedStack.push(setA);
      }
    }
  }

  // ┌───┬───┬───┬───┐
  // │ a │   │   │   │
  // ├───┼───┼───┼───┤
  // │   │   │   │   │
  // ├───┼───┼───┼───┤
  // │   │   │   │   │
  // ├───┼───┼───┼───┤
  // │   │   │   │ b │
  // └───┴───┴───┴───┘
  const letter = (idx) => String.fromCharCode(97 + idx); // 97: 'a'
  const orderedTexelIndices = [];
  const lines = [];
  {
    let line = '  ';
    for (let x = 0; x < textureSize.width; x++) {
      line += `  ${x.toString().padEnd(2)}`;
    }
    lines.push(line);
  }
  {
    let line = '  ┌';
    for (let x = 0; x < textureSize.width; x++) {
      line += x === textureSize.width - 1 ? '───┐' : '───┬';
    }
    lines.push(line);
  }
  for (let y = 0; y < textureSize.height; y++) {
    {
      let line = `${y.toString().padEnd(2)}│`;
      for (let x = 0; x < textureSize.width; x++) {
        const texelIdx = x + y * textureSize.height;
        const weight = sampledTexelWeights.get(texelIdx);
        if (weight !== undefined) {
          line += ` ${letter(orderedTexelIndices.length)} │`;
          orderedTexelIndices.push(texelIdx);
        } else {
          line += '   │';
        }
      }
      lines.push(line);
    }
    if (y < textureSize.height - 1) {
      let line = '  ├';
      for (let x = 0; x < textureSize.width; x++) {
        line += x === textureSize.width - 1 ? '───┤' : '───┼';
      }
      lines.push(line);
    }
  }
  {
    let line = '  └';
    for (let x = 0; x < textureSize.width; x++) {
      line += x === textureSize.width - 1 ? '───┘' : '───┴';
    }
    lines.push(line);
  }

  orderedTexelIndices.forEach((texelIdx, i) => {
    const weights = sampledTexelWeights.get(texelIdx);
    const y = Math.floor(texelIdx / textureSize.width);
    const x = texelIdx - y * textureSize.height;
    const w = rep.componentOrder.map((c) => `${c}: ${weights[c]?.toFixed(5)}`).join(', ');
    lines.push(`${letter(i)}: at: [${x}, ${y}], weights: [${w}]`);
  });
  return lines;
}

function layoutTwoColumns(columnA, columnB) {
  const widthA = Math.max(...columnA.map((l) => l.length));
  const lines = Math.max(columnA.length, columnB.length);
  const out = new Array(lines);
  for (let line = 0; line < lines; line++) {
    const a = columnA[line] ?? '';
    const b = columnB[line] ?? '';
    out[line] = `${a}${' '.repeat(widthA - a.length)} | ${b}`;
  }
  return out;
}

export const kSamplePointMethods = ['texel-centre', 'spiral'];


/**
 * Generates an array of coordinates at which to sample a texture.
 */
export function generateSamplePoints(
n,
nearest,
args)












{
  const out = [];
  switch (args.method) {
    case 'texel-centre':{
        for (let i = 0; i < n; i++) {
          const r = hashU32(i);
          const x = Math.floor(lerp(0, args.textureWidth - 1, (r & 0xffff) / 0xffff)) + 0.5;
          const y = Math.floor(lerp(0, args.textureHeight - 1, (r >>> 16) / 0xffff)) + 0.5;
          out.push([x / args.textureWidth, y / args.textureHeight]);
        }
        break;
      }
    case 'spiral':{
        for (let i = 0; i < n; i++) {
          const f = i / (Math.max(n, 2) - 1);
          const r = (args.radius ?? 1.5) * f;
          const a = (args.loops ?? 2) * 2 * Math.PI * f;
          out.push([0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)]);
        }
        break;
      }
  }
  // Samplers across devices use different methods to interpolate.
  // Quantizing the texture coordinates seems to hit coords that produce
  // comparable results to our computed results.
  // Note: This value works with 8x8 textures. Other sizes have not been tested.
  // Values that worked for reference:
  // Win 11, NVidia 2070 Super: 16
  // Linux, AMD Radeon Pro WX 3200: 256
  // MacOS, M1 Mac: 256
  const kSubdivisionsPerTexel = 4;
  const q = [args.textureWidth * kSubdivisionsPerTexel, args.textureHeight * kSubdivisionsPerTexel];
  return out.map(
    (c) =>
    c.map((v, i) => {
      // Quantize to kSubdivisionsPerPixel
      const v1 = Math.floor(v * q[i]);
      // If it's nearest and we're on the edge of a texel then move us off the edge
      // since the edge could choose one texel or another in nearest mode
      const v2 = nearest && v1 % kSubdivisionsPerTexel === 0 ? v1 + 1 : v1;
      // Convert back to texture coords
      return v2 / q[i];
    })
  );
}

function wgslTypeFor(data, type) {
  if (data instanceof Array) {
    switch (data.length) {
      case 2:
        return `vec2${type}`;
      case 3:
        return `vec3${type}`;
    }
  }
  return '${type}32';
}

function wgslExpr(data) {
  if (data instanceof Array) {
    switch (data.length) {
      case 2:
        return `vec2(${data.map((v) => v.toString()).join(', ')})`;
      case 3:
        return `vec3(${data.map((v) => v.toString()).join(', ')})`;
    }
  }
  return data.toString();
}

function binKey(call) {
  const keys = [];
  for (const name of kTextureCallArgNames) {
    const value = call[name];
    if (value !== undefined) {
      if (name === 'offset') {
        // offset must be a constant expression
        keys.push(`${name}: ${wgslExpr(value)}`);
      } else {
        keys.push(`${name}: ${wgslTypeFor(value, call.coordType)}`);
      }
    }
  }
  return `${call.builtin}(${keys.join(', ')})`;
}

function buildBinnedCalls(calls) {
  const args = ['T']; // All texture builtins take the texture as the first argument
  const fields = [];
  const data = [];

  const prototype = calls[0];
  if (prototype.builtin.startsWith('textureSample')) {
    // textureSample*() builtins take a sampler as the second argument
    args.push('S');
  }

  for (const name of kTextureCallArgNames) {
    const value = prototype[name];
    if (value !== undefined) {
      if (name === 'offset') {
        args.push(`/* offset */ ${wgslExpr(value)}`);
      } else {
        args.push(`args.${name}`);
        fields.push(`@align(16) ${name} : ${wgslTypeFor(value, prototype.coordType)}`);
      }
    }
  }

  for (const call of calls) {
    for (const name of kTextureCallArgNames) {
      const value = call[name];
      assert(
        prototype[name] === undefined === (value === undefined),
        'texture calls are not binned correctly'
      );
      if (value !== undefined && name !== 'offset') {
        const bitcastToU32 = (value) => {
          if (calls[0].coordType === 'f') {
            return float32ToUint32(value);
          }
          return value;
        };
        if (value instanceof Array) {
          for (const c of value) {
            data.push(bitcastToU32(c));
          }
        } else {
          data.push(bitcastToU32(value));
        }
        // All fields are aligned to 16 bytes.
        while ((data.length & 3) !== 0) {
          data.push(0);
        }
      }
    }
  }

  const expr = `${prototype.builtin}(${args.join(', ')})`;

  return { expr, fields, data };
}

function binCalls(calls) {
  const map = new Map(); // key to bin index
  const bins = [];
  calls.forEach((call, callIdx) => {
    const key = binKey(call);
    const binIdx = map.get(key);
    if (binIdx === undefined) {
      map.set(key, bins.length);
      bins.push([callIdx]);
    } else {
      bins[binIdx].push(callIdx);
    }
  });
  return bins;
}

export function describeTextureCall(call) {
  const args = ['texture: T'];
  if (call.builtin.startsWith('textureSample')) {
    args.push('sampler: S');
  }
  for (const name of kTextureCallArgNames) {
    const value = call[name];
    if (value !== undefined) {
      args.push(`${name}: ${wgslExpr(value)}`);
    }
  }
  return `${call.builtin}(${args.join(', ')})`;
}

/**
 * Given a list of "calls", each one of which has a texture coordinate,
 * generates a fragment shader that uses the fragment position as an index
 * (position.y * 256 + position.x) That index is then used to look up a
 * coordinate from a storage buffer which is used to call the WGSL texture
 * function to read/sample the texture, and then write to an rgba32float
 * texture.  We then read the rgba32float texture for the per "call" results.
 *
 * Calls are "binned" by call parameters. Each bin has its own structure and
 * field in the storage buffer. This allows the calls to be non-homogenous and
 * each have their own data type for coordinates.
 */
export async function doTextureCalls(
device,
gpuTexture,
sampler,
calls)
{
  let structs = '';
  let body = '';
  let dataFields = '';
  const data = [];
  let callCount = 0;
  const binned = binCalls(calls);
  binned.forEach((binCalls, binIdx) => {
    const b = buildBinnedCalls(binCalls.map((callIdx) => calls[callIdx]));
    structs += `struct Args${binIdx} {
  ${b.fields.join(',  \n')}
}
`;
    dataFields += `  args${binIdx} : array<Args${binIdx}, ${binCalls.length}>,
`;
    body += `
  {
    let is_active = (frag_idx >= ${callCount}) & (frag_idx < ${callCount + binCalls.length});
    let args = data.args${binIdx}[frag_idx - ${callCount}];
    let call = ${b.expr};
    result = select(result, call, is_active);
  }
`;
    callCount += binCalls.length;
    data.push(...b.data);
  });

  const dataBuffer = device.createBuffer({
    size: data.length * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
  });
  device.queue.writeBuffer(dataBuffer, 0, new Uint32Array(data));

  const rtWidth = 256;
  const renderTarget = device.createTexture({
    format: 'rgba32float',
    size: { width: rtWidth, height: Math.ceil(calls.length / rtWidth) },
    usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT
  });

  const code = `
${structs}

struct Data {
${dataFields}
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index : u32) -> @builtin(position) vec4f {
  let positions = array(
    vec4f(-1,  1, 0, 1), vec4f( 1,  1, 0, 1),
    vec4f(-1, -1, 0, 1), vec4f( 1, -1, 0, 1),
  );
  return positions[vertex_index];
}

@group(0) @binding(0) var          T    : texture_2d<f32>;
@group(0) @binding(1) var          S    : sampler;
@group(0) @binding(2) var<storage> data : Data;

@fragment
fn fs_main(@builtin(position) frag_pos : vec4f) -> @location(0) vec4f {
  let frag_idx = u32(frag_pos.x) + u32(frag_pos.y) * ${renderTarget.width};
  var result : vec4f;
${body}
  return result;
}
`;

  const shaderModule = device.createShaderModule({ code });

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: shaderModule },
    fragment: {
      module: shaderModule,
      targets: [{ format: renderTarget.format }]
    },
    primitive: { topology: 'triangle-strip' }
  });

  const gpuSampler = device.createSampler(sampler);

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
    { binding: 0, resource: gpuTexture.createView() },
    { binding: 1, resource: gpuSampler },
    { binding: 2, resource: { buffer: dataBuffer } }]

  });

  const bytesPerRow = align(16 * renderTarget.width, 256);
  const resultBuffer = device.createBuffer({
    size: renderTarget.height * bytesPerRow,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
  });
  const encoder = device.createCommandEncoder();

  const renderPass = encoder.beginRenderPass({
    colorAttachments: [
    {
      view: renderTarget.createView(),
      loadOp: 'clear',
      storeOp: 'store'
    }]

  });

  renderPass.setPipeline(pipeline);
  renderPass.setBindGroup(0, bindGroup);
  renderPass.draw(4);
  renderPass.end();
  encoder.copyTextureToBuffer(
    { texture: renderTarget },
    { buffer: resultBuffer, bytesPerRow },
    { width: renderTarget.width, height: renderTarget.height }
  );
  device.queue.submit([encoder.finish()]);

  await resultBuffer.mapAsync(GPUMapMode.READ);

  const view = TexelView.fromTextureDataByReference(
    renderTarget.format,
    new Uint8Array(resultBuffer.getMappedRange()),
    {
      bytesPerRow,
      rowsPerImage: renderTarget.height,
      subrectOrigin: [0, 0, 0],
      subrectSize: [renderTarget.width, renderTarget.height]
    }
  );

  let outIdx = 0;
  const out = new Array(calls.length);
  for (const bin of binned) {
    for (const callIdx of bin) {
      const x = outIdx % rtWidth;
      const y = Math.floor(outIdx / rtWidth);
      out[callIdx] = view.color({ x, y, z: 0 });
      outIdx++;
    }
  }

  renderTarget.destroy();
  resultBuffer.destroy();

  return out;
}