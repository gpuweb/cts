import { ParamSpec, parseSingleParam } from '../params_utils.js';
import { assert } from '../util/util.js';

import { TestQuery, validQueryPart } from './query.js';

export function parseQuery(s: string): TestQuery {
  const bigparts = s.split(':', 4); // suite, group, test, params
  assert(bigparts.length >= 2, 'filter string must have at least one :');
  const suite = bigparts[0];

  const { parts: group, endsWithWildcard: groupHasWildcard } = parseBigPart(bigparts[1]);

  if (bigparts.length <= 2) {
    return { suite, group, endsWithWildcard: groupHasWildcard };
  }
  assert(!groupHasWildcard, 'Wildcard * must be at the end of the query string');

  const { parts: test, endsWithWildcard: testHasWildcard } = parseBigPart(bigparts[2]);

  if (bigparts.length <= 3) {
    return { suite, group, test, endsWithWildcard: testHasWildcard };
  }
  assert(!testHasWildcard, 'Wildcard * must be at the end of the query string');

  const { parts: paramsParts, endsWithWildcard: paramsHasWildcard } = parseBigPart(bigparts[3]);

  const params: ParamSpec = {};
  for (const paramPart of paramsParts) {
    const [k, v] = parseSingleParam(paramPart);
    assert(validQueryPart.test(k), 'param key names must match ' + validQueryPart);
    params[k] = v;
  }
  return { suite, group, test, params, endsWithWildcard: paramsHasWildcard };
}

function parseBigPart(s: string): { parts: string[]; endsWithWildcard: boolean } {
  const parts = s.split(';');
  for (let i = 0; i < parts.length; ++i) {
    const part = parts[i];
    if (part === '*') {
      assert(i === parts.length - 1, 'Wildcard * must the last part of a path (e.g. `a;b;*`)');
    } else {
      assert(part.indexOf('*') === -1, 'Wildcard * must be an entire path part (e.g. `a;b;*`)');
    }
  }
  throw 0;
}
