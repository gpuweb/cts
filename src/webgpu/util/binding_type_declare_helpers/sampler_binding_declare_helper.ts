import { unreachable } from '../../../common/util/util.js';

// Sampler:
//   - var samp : sampler;
//   - var samp : sampler_comparison;
export function generateSamplerBindingDeclare(binding: GPUSamplerBindingLayout): string {
  let suffix: string;
  switch (binding.type) {
    case 'filtering':
    case 'non-filtering': {
      suffix = 'sampler';
      break;
    }
    case 'comparison': {
      suffix = 'sampler_comparison';
      break;
    }
    default:
      unreachable();
  }
  const declare = `var samp: ${suffix}`;
  return declare;
}
