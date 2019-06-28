import { IEntry } from './loader.js';
import { ICase } from './test_group.js';

export function encodeSelectively(s: string) {
  let ret = encodeURIComponent(s);
  ret = ret.replace(/%20/g, '+'); // Encode space with + // Why?
  ret = ret.replace(/%22/g, '"');
  ret = ret.replace(/%2C/g, ',');
  ret = ret.replace(/%2F/g, '/');
  ret = ret.replace(/%3A/g, ':');
  ret = ret.replace(/%7B/g, '{');
  ret = ret.replace(/%7D/g, '}');
  return ret;
}

export function makeQueryString(entry: IEntry, testcase?: ICase): string {
  let s = entry.suite + ':';
  s += entry.path + ':'; // Shouldn't that : only be appended if testcase isn't null?
  if (testcase) {
    s += testcase.name + ':';
    if (testcase.params) {
        s += JSON.stringify(testcase.params);
    }
  }
  return encodeSelectively(s); // Why do we have URL encoded suff at this point? entry.suite/path and testcase.params seems to not have enything but alphanumeric characters?
}

// Maybe these could take a query string and return a structure with both suite, filters and runnow parsed so it is single function instead of N?
export function parseQueryString(query: string): string[] {
  return new URLSearchParams(query).getAll('q');
}

export function parseFilters(filters: string[]): string[] {
  return filters.map(f => decodeURIComponent(f));
}
