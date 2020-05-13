import { ParamArgument } from './params_utils.js';
import { unreachable } from './util/util.js';

export function encodeSelectively(s: string): string {
  let ret = encodeURIComponent(s);
  ret = ret.replace(/%22/g, '"'); // for JSON strings
  ret = ret.replace(/%2C/g, ','); // for path separator, and JSON arrays
  ret = ret.replace(/%3A/g, ':'); // for big separator
  ret = ret.replace(/%3B/g, ';'); // for param separator
  ret = ret.replace(/%3D/g, '='); // for params (k=v)
  ret = ret.replace(/%5B/g, '['); // for JSON arrays
  ret = ret.replace(/%5D/g, ']'); // for JSON arrays
  return ret;
}

export function checkPublicParamType(v: ParamArgument): void {
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' || v === undefined) {
    return;
  }
  if (v instanceof Array) {
    for (const x of v) {
      if (typeof x !== 'number') {
        break;
      }
    }
    return;
  }
  unreachable('Invalid type for test case params ' + v);
}
