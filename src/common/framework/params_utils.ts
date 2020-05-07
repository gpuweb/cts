import { kSmallSeparator } from './query/separators.js';
import { objectEquals, assert } from './util/util.js';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type ParamArgument = any;
export interface ParamSpec {
  [k: string]: ParamArgument;
}
export type ParamSpecIterable = Iterable<ParamSpec>;
export type ParamSpecIterator = IterableIterator<ParamSpec>;

export function extractPublicParams(params: ParamSpec): ParamSpec {
  const publicParams: ParamSpec = {};
  for (const k of Object.keys(params)) {
    if (!k.startsWith('_')) {
      publicParams[k] = params[k];
    }
  }
  return publicParams;
}

export function stringifyPublicParams(p: ParamSpec): string[] {
  const pub = extractPublicParams(p);
  return Object.entries(pub).map(([k, v]) => stringifySingleParam(k, v));
}

export function stringifySingleParam(k: string, v: ParamArgument) {
  return `${k}=${stringifySingleParamValue(v)}`;
}

export function stringifySingleParamValue(v: ParamArgument): string {
  const s = v === undefined ? 'undefined' : JSON.stringify(v);
  assert(!/[;:=]/.test(s), 'JSON.stringified param value must not have [;:=] - was ' + s);
  return s;
}

// TODO: possibly delete
export function parseParamsString(paramsString: string): ParamSpec {
  if (paramsString === '') {
    return {};
  }

  const params: ParamSpec = {};
  for (const paramSubstring of paramsString.split(kSmallSeparator)) {
    const [k, v] = parseSingleParam(paramSubstring);
    params[k] = v;
  }
  return params;
}

export function parseSingleParam(paramSubstring: string): [string, ParamArgument] {
  const i = paramSubstring.indexOf('=');
  assert(i !== -1, 'Should only be one = in a param in a query');
  const k = paramSubstring.substring(0, i);
  const v = paramSubstring.substring(i + 1);
  return [k, parseSingleParamValue(v)];
}

export function parseSingleParamValue(s: string): ParamArgument {
  return s === 'undefined' ? undefined : JSON.parse(s);
}

export function paramsEquals(x: ParamSpec | null, y: ParamSpec | null): boolean {
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

export function paramsSupersets(sup: ParamSpec | null, sub: ParamSpec | null): boolean {
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
