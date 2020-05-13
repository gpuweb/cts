import { compareParamsPaths, Ordering } from './query/compare.js';
import { kWildcard, kParamSeparator } from './query/separators.js';

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

export const badParamValueChars = new RegExp('[=' + kParamSeparator + kWildcard + ']');

export function paramsEquals(x: CaseParams, y: CaseParams): boolean {
  return compareParamsPaths(x, y) === Ordering.Equal;
}
