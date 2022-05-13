import { unreachable } from '../../common/util/util.js';

/**
 * Build a fragment shader based on output value and types
 * e.g. write to color target 0 a vec4<f32>(1.0, 0.0, 1.0, 1.0) and color target 2 a vec2<u32>(1, 2)
 * outputs: [
 *   {
 *     values: [1, 0, 1, 1],,
 *     sampleType: 'float',
 *     componentCount: 4,
 *   },
 *   null,
 *   {
 *     values: [1, 2],
 *     sampleType: 'uint',
 *     componentCount: 2,
 *   },
 * ]
 *
 * return:
 * struct Outputs {
 *     @location(0) o1 : vec4<f32>;
 *     @location(2) o3 : vec2<u32>;
 * }
 * @stage(fragment) fn main() -> Outputs {
 *     return Outputs(vec4<f32>(1.0, 0.0, 1.0, 1.0), vec4<u32>(1, 2));
 * }
 * @param outputs the shader outputs for each location attribute
 * @returns the fragment shader string
 */
export function getFragmentShaderCodeWithOutput(
  outputs: ({
    values: readonly number[];
    sampleType: GPUTextureSampleType;
    componentCount: number;
  } | null)[]
): string {
  if (outputs.length === 0) {
    return `
        @stage(fragment) fn main() {
        }`;
  }

  const resultStrings = [] as string[];
  let outputStructString = '';

  for (let i = 0; i < outputs.length; i++) {
    const o = outputs[i];
    if (o === null) {
      continue;
    }

    let fragColorType;
    let suffix;
    let fractionDigits = 0;
    switch (o.sampleType) {
      case 'sint':
        fragColorType = 'i32';
        suffix = '';
        break;
      case 'uint':
        fragColorType = 'u32';
        suffix = 'u';
        break;
      case 'float':
      case 'unfilterable-float':
      case 'depth':
        fragColorType = 'f32';
        suffix = '';
        fractionDigits = 4;
        break;
      default:
        unreachable();
    }

    let outputType;
    const v = o.values.map(n => n.toFixed(fractionDigits));
    switch (o.componentCount) {
      case 1:
        outputType = fragColorType;
        resultStrings.push(`${v[0]}${suffix}`);
        break;
      case 2:
        outputType = `vec2<${fragColorType}>`;
        resultStrings.push(`${outputType}(${v[0]}${suffix}, ${v[1]}${suffix})`);
        break;
      case 3:
        outputType = `vec3<${fragColorType}>`;
        resultStrings.push(`${outputType}(${v[0]}${suffix}, ${v[1]}${suffix}, ${v[2]}${suffix})`);
        break;
      case 4:
        outputType = `vec4<${fragColorType}>`;
        resultStrings.push(
          `${outputType}(${v[0]}${suffix}, ${v[1]}${suffix}, ${v[2]}${suffix}, ${v[3]}${suffix})`
        );
        break;
      default:
        unreachable();
    }

    outputStructString += `@location(${i}) o${i} : ${outputType},\n`;
  }

  return `
    struct Outputs {
      ${outputStructString}
    }

    @stage(fragment) fn main() -> Outputs {
        return Outputs(${resultStrings.join(',')});
    }`;
}
