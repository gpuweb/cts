import { comparePublicParamsPaths, Ordering } from './query/compare.js';
import { kWildcard, kParamSeparator, kParamKVSeparator } from './query/separators.js';

// Consider adding more types here if needed
export type ParamArgument = void | undefined | number | string | boolean | number[];
export interface CaseParams {
  readonly [k: string]: ParamArgument;
}
export interface CaseParamsRW {
  [k: string]: ParamArgument;
}
export type CaseParamsIterable = Iterable<CaseParams>;

export function paramKeyIsPublic(key: string): boolean {
  return !key.startsWith('_');
}

export function extractPublicParams(params: CaseParams): CaseParams {
  const publicParams: CaseParamsRW = {};
  for (const k of Object.keys(params)) {
    if (paramKeyIsPublic(k)) {
      publicParams[k] = params[k];
    }
  }
  return publicParams;
}

export const badParamValueChars = new RegExp(
  '[' + kParamKVSeparator + kParamSeparator + kWildcard + ']'
);

export function publicParamsEquals(x: CaseParams, y: CaseParams): boolean {
  return comparePublicParamsPaths(x, y) === Ordering.Equal;
}
