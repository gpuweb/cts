import {
  CaseParams,
  ParamArgument,
  badParamValueChars,
  paramKeyIsPublic,
} from '../params_utils.js';
import { assert } from '../util/util.js';

import { stringifyParamValue } from './json_param_value.js';
import { kParamKVSeparator } from './separators.js';

export function stringifyPublicParams(p: CaseParams): string[] {
  return Object.keys(p)
    .filter(k => paramKeyIsPublic(k))
    .map(k => stringifySingleParam(k, p[k]));
}

export function stringifySingleParam(k: string, v: ParamArgument) {
  return `${k}${kParamKVSeparator}${stringifySingleParamValue(v)}`;
}

function stringifySingleParamValue(v: ParamArgument): string {
  const s = stringifyParamValue(v);
  assert(
    !badParamValueChars.test(s),
    `JSON.stringified param value must not match ${badParamValueChars} - was ${s}`
  );
  return s;
}
