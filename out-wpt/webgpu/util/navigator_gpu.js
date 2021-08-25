/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ /// <reference types="@webgpu/types" />
import { assert } from '../../common/util/util.js';
let impl = undefined;

/**
 * Finds and returns the `navigator.gpu` object (or equivalent, for non-browser implementations).
 * Throws an exception if not found.
 */
export function getGPU() {
  if (impl) {
    return impl;
  }

  assert(
    typeof navigator !== 'undefined' && navigator.gpu !== undefined,
    'No WebGPU implementation found'
  );

  impl = navigator.gpu;
  return impl;
}
