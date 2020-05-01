import { TestCaseID, TestGroupID, TIDGroupOrTestOrCase } from './id.js';
import { ParamArgument, stringifyPublicParams } from './params_utils.js';
import { unreachable } from './util/util.js';

export function encodeSelectively(s: string): string {
  let ret = encodeURIComponent(s);
  ret = ret.replace(/%22/g, '"');
  ret = ret.replace(/%2C/g, ',');
  ret = ret.replace(/%2F/g, '/');
  ret = ret.replace(/%3A/g, ':');
  ret = ret.replace(/%3B/g, ';');
  ret = ret.replace(/%3D/g, '=');
  ret = ret.replace(/%5B/g, '[');
  ret = ret.replace(/%5D/g, ']');
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

export function makeQueryString(spec: TestGroupID, testcase?: TestCaseID): string {
  return makeQueryString2({ group: spec, ...testcase });
}

// TODO: delete
export function makeTestCaseString(id: TIDGroupOrTestOrCase): string {
  let s = '';
  if ('test' in id) {
    s += id.test + ':';
    if ('params' in id) {
      s += stringifyPublicParams(id.params);
    }
  }
  return s;
}

// TODO: delete
export function makeQueryString2(id: TIDGroupOrTestOrCase): string {
  let s = id.group.suite + ':';
  s += id.group.group + ':';
  s += makeTestCaseString(id);
  return encodeSelectively(s);
}
