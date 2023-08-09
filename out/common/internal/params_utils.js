/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/import { assert } from '../util/util.js';

import { comparePublicParamsPaths, Ordering } from './query/compare.js';
import { kWildcard, kParamSeparator, kParamKVSeparator } from './query/separators.js';















export function paramKeyIsPublic(key) {
  return !key.startsWith('_');
}

export function extractPublicParams(params) {
  const publicParams = {};
  for (const k of Object.keys(params)) {
    if (paramKeyIsPublic(k)) {
      publicParams[k] = params[k];
    }
  }
  return publicParams;
}

/** Used to escape reserved characters in URIs */
const kPercent = '%';

export const badParamValueChars = new RegExp(
'[' + kParamKVSeparator + kParamSeparator + kWildcard + kPercent + ']');


export function publicParamsEquals(x, y) {
  return comparePublicParamsPaths(x, y) === Ordering.Equal;
}


























function typeAssert() {}
{






















  {
    typeAssert();
    typeAssert();
    typeAssert();
    typeAssert();
    typeAssert();

    typeAssert();

    typeAssert();
    typeAssert();
    typeAssert();
    typeAssert();
    typeAssert();

    // Unexpected test results - hopefully okay to ignore these
    typeAssert();
    typeAssert();
  }
}






/** Merges two objects into one `{ ...a, ...b }` and return it with a flattened type. */
export function mergeParams(a, b) {
  return { ...a, ...b };
}

/** Asserts that the result of a mergeParams didn't have overlap. This is not extremely fast. */
export function assertMergedWithoutOverlap([a, b], merged) {
  assert(
  Object.keys(merged).length === Object.keys(a).length + Object.keys(b).length,
  () => `Duplicate key between ${JSON.stringify(a)} and ${JSON.stringify(b)}`);

}
//# sourceMappingURL=params_utils.js.map