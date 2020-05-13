import { kWildcard, kParamSeparator } from './query/separators.js';
import { objectEquals, assert } from './util/util.js';

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

const badParamValueChars = new RegExp('[=' + kParamSeparator + kWildcard + ']');
export function stringifySingleParamValue(v: ParamArgument): string {
  const s = v === undefined ? 'undefined' : JSON.stringify(v);
  assert(
    !badParamValueChars.test(s),
    `JSON.stringified param value must not match ${badParamValueChars} - was ${s}`
  );
  return s;
}

// TODO: possibly delete
export function parseParamsString(paramsString: string): CaseParams {
  if (paramsString === '') {
    return {};
  }

  const params: CaseParamsRW = {};
  for (const paramSubstring of paramsString.split(kParamSeparator)) {
    const [k, v] = parseSingleParam(paramSubstring);
    params[k] = v;
  }
  return params;
}

export function parseSingleParam(paramSubstring: string): [string, ParamArgument] {
  assert(paramSubstring !== '', 'Param in a query must not be blank (is there a trailing comma?)');
  const i = paramSubstring.indexOf('=');
  assert(i !== -1, 'Param in a query must be of form key=value');
  const k = paramSubstring.substring(0, i);
  const v = paramSubstring.substring(i + 1);
  return [k, parseSingleParamValue(v)];
}

export function parseSingleParamValue(s: string): ParamArgument {
  assert(
    !badParamValueChars.test(s),
    `param value must not match ${badParamValueChars} - was ${s}`
  );
  return s === 'undefined' ? undefined : JSON.parse(s);
}

export function paramsEquals(x: CaseParams | null, y: CaseParams | null): boolean {
  if (x === y) {
    return true;
  }
  if (x === null) {
    x = {};
  }
  if (y === null) {
    y = {};
  }

  for (const xk of Object.keys(x)) {
    if (x[xk] !== undefined && !(xk in y)) {
      return false;
    }
    if (!objectEquals(x[xk], y[xk])) {
      return false;
    }
  }

  for (const yk of Object.keys(y)) {
    if (y[yk] !== undefined && !(yk in x)) {
      return false;
    }
  }
  return true;
}

export function paramsSupersets(sup: CaseParams | null, sub: CaseParams | null): boolean {
  if (sub === null) {
    return true;
  }
  if (sup === null) {
    sup = {};
  }
  for (const k of Object.keys(sub)) {
    if (!(k in sup) || sup[k] !== sub[k]) {
      return false;
    }
  }
  return true;
}
