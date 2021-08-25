/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ import { memcpy } from '../../common/util/util.js';
import { align } from './math.js';

/**
 * Creates a buffer with the contents of some TypedArray.
 */
export function makeBufferWithContents(device, dataArray, usage, opts = {}) {
  const buffer = device.createBuffer({
    mappedAtCreation: true,
    size: align(dataArray.byteLength, opts.padToMultipleOf4 ? 4 : 1),
    usage,
  });

  memcpy({ src: dataArray }, { dst: buffer.getMappedRange() });
  buffer.unmap();
  return buffer;
}
