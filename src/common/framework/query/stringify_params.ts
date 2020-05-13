import {
  CaseParams,
  extractPublicParams,
  ParamArgument,
  badParamValueChars,
} from '../params_utils.js';
import { assert } from '../util/util.js';

export function stringifyPublicParams(p: CaseParams): string[] {
  const pub = extractPublicParams(p);
  return Object.entries(pub).map(([k, v]) => stringifySingleParam(k, v));
}

export function stringifySingleParam(k: string, v: ParamArgument) {
  return `${k}=${stringifySingleParamValue(v)}`;
}

function stringifySingleParamValue(v: ParamArgument): string {
  const s = v === undefined ? 'undefined' : JSON.stringify(v);
  assert(
    !badParamValueChars.test(s),
    `JSON.stringified param value must not match ${badParamValueChars} - was ${s}`
  );
  return s;
}
