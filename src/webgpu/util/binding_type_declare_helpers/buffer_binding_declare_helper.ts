import { unreachable } from '../../../common/util/util.js';

// Buffers:
//   - var<uniform> buf : Buf;
//   - var<storage, read_write> buf: Buf;
//   - var<storage, read> buf: Buf;
export function generateBufferBindingDeclare(binding: GPUBufferBindingLayout): string {
  let decoration: string;
  switch (binding.type ?? 'uniform') {
    case 'uniform': {
      decoration = 'uniform';
      break;
    }
    case 'storage': {
      decoration = 'storage';
      break;
    }
    case 'read-only-storage': {
      decoration = 'storage, read';
      break;
    }
    default:
      unreachable();
  }
  const declare = `var<${decoration}> buf: Buf`;
  return declare;
}
