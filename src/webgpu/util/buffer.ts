import { memcpy, TypedArrayBufferView } from '../../common/util/util.js';

/**
 * Creates a buffer with the contents of some TypedArray.
 */
export function makeBufferWithContents(
  device: GPUDevice,
  dataArray: TypedArrayBufferView,
  usage: GPUBufferUsageFlags
): GPUBuffer {
  const buffer = device.createBuffer({
    mappedAtCreation: true,
    size: dataArray.byteLength,
    usage,
  });
  memcpy({ src: dataArray }, { dst: buffer.getMappedRange() });
  buffer.unmap();
  return buffer;
}
