import { compareParamsPaths, Ordering } from './query/compare.js';
import { kWildcard, kParamSeparator } from './query/separators.js';
import { assert, unreachable } from './util/util.js';

// Consider adding more types here if needed
export type ParamArgument = void | undefined | number | string | boolean | number[];
export interface CaseParams {
  readonly [k: string]: ParamArgument;
}
export interface CaseParamsRW {
  [k: string]: ParamArgument;
}
export type CaseParamsIterable = Iterable<CaseParams>;

export function extractPublicParams(params: CaseParams): CaseParams {
  const publicParams: CaseParamsRW = {};
  for (const k of Object.keys(params)) {
    if (!k.startsWith('_')) {
      publicParams[k] = params[k];
    }
  }
  return publicParams;
}

export function stringifyPublicParams(p: CaseParams): string[] {
  const pub = extractPublicParams(p);
  return Object.entries(pub).map(([k, v]) => stringifySingleParam(k, v));
}

export function stringifySingleParam(k: string, v: ParamArgument) {
  return `${k}=${stringifySingleParamValue(v)}`;
}

export const badParamValueChars = new RegExp('[=' + kParamSeparator + kWildcard + ']');
function stringifySingleParamValue(v: ParamArgument): string {
  const s = v === undefined ? 'undefined' : JSON.stringify(v);
  assert(
    !badParamValueChars.test(s),
    `JSON.stringified param value must not match ${badParamValueChars} - was ${s}`
  );
  return s;
}

export function paramsEquals(x: CaseParams, y: CaseParams): boolean {
  return compareParamsPaths(x, y) === Ordering.Equal;
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
