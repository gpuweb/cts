/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/import { unreachable } from '../../common/util/util.js';
export const kAllCanvasTypes = ['onscreen', 'offscreen'];


/** Valid contextId for HTMLCanvasElement/OffscreenCanvas,
 *  spec: https://html.spec.whatwg.org/multipage/canvas.html#dom-canvas-getcontext
 */
export const kValidCanvasContextIds = [
'2d',
'bitmaprenderer',
'webgl',
'webgl2',
'webgpu'];



/** Helper(s) to determine if context is copyable. */
export function canCopyFromCanvasContext(contextName) {
  switch (contextName) {
    case '2d':
    case 'webgl':
    case 'webgl2':
    case 'webgpu':
      return true;
    default:
      return false;}

}

/** Create HTMLCanvas/OffscreenCanvas. */
export function createCanvas(
test,
canvasType,
width,
height)
{
  let canvas;
  if (canvasType === 'onscreen') {
    if (typeof document !== 'undefined') {
      canvas = createOnscreenCanvas(test, width, height);
    } else {
      test.skip('Cannot create HTMLCanvasElement');
    }
  } else if (canvasType === 'offscreen') {
    canvas = createOffscreenCanvas(test, width, height);
  } else {
    unreachable();
  }

  return canvas;
}

/** Create HTMLCanvasElement. */
export function createOnscreenCanvas(
test,
width,
height)
{
  let canvas;
  if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
  } else {
    test.skip('Cannot create HTMLCanvasElement');
  }
  return canvas;
}

/** Create OffscreenCanvas. */
export function createOffscreenCanvas(
test,
width,
height)
{
  if (typeof OffscreenCanvas === 'undefined') {
    test.skip('OffscreenCanvas is not supported');
  }

  return new OffscreenCanvas(width, height);
}
//# sourceMappingURL=create_elements.js.map