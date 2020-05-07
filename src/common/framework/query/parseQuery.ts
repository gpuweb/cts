import { ParamSpec, parseSingleParam } from '../params_utils.js';
import { assert } from '../util/util.js';

import { TestQuery, validQueryPart } from './query.js';
import { kBigSeparator, kWildcard, kSmallSeparator } from './separators.js';

export function parseQuery(s: string): TestQuery {
  const bigParts = s.split(kBigSeparator, 4); // suite, group, test, params
  assert(bigParts.length >= 2, `filter string must have at least one ${kBigSeparator}`);
  const suite = bigParts[0];

  const { parts: group, endsWithWildcard: groupHasWildcard } = parseBigPart(bigParts[1]);

  if (bigParts.length === 2) {
    assert(
      groupHasWildcard,
      `Group-level query without wildcard ${kWildcard}; did you want a test-level query? \
(Append ${kBigSeparator}${kWildcard})`
    );
    return { suite, group, endsWithWildcard: true };
  }
  assert(!groupHasWildcard, `Wildcard ${kWildcard} must be at the end of the query string`);

  const { parts: test, endsWithWildcard: testHasWildcard } = parseBigPart(bigParts[2]);

  if (bigParts.length === 3) {
    assert(
      testHasWildcard,
      `Test-level query without wildcard ${kWildcard}; did you want a case-level query? \
(Append ${kBigSeparator}${kWildcard})`
    );
    return { suite, group, test, endsWithWildcard: true };
  }
  assert(!testHasWildcard, `Wildcard ${kWildcard} must be at the end of the query string`);

  const { parts: paramsParts, endsWithWildcard: paramsHasWildcard } = parseBigPart(bigParts[3]);

  const params: ParamSpec = {};
  for (const paramPart of paramsParts) {
    const [k, v] = parseSingleParam(paramPart);
    assert(validQueryPart.test(k), 'param key names must match ' + validQueryPart);
    params[k] = v;
  }
  return { suite, group, test, params, endsWithWildcard: paramsHasWildcard };
}

// webgpu:a,b,*
// webgpu:a,b,c:*
const kExampleQuery = `\
webgpu${kBigSeparator}a${kSmallSeparator}b${kSmallSeparator}${kWildcard} or \
webgpu${kBigSeparator}a${kSmallSeparator}b${kSmallSeparator}c${kBigSeparator}${kWildcard}`;

function parseBigPart(s: string): { parts: string[]; endsWithWildcard: boolean } {
  const parts = s.split(kSmallSeparator);
  let endsWithWildcard = false;
  for (const [i, part] of parts.entries()) {
    if (i === parts.length - 1) {
      endsWithWildcard = part === kWildcard;
    }
    assert(
      part.indexOf(kWildcard) === -1 || endsWithWildcard,
      `Wildcard ${kWildcard} must be complete last part of a path (e.g. ${kExampleQuery})`
    );
  }
  if (endsWithWildcard) {
    parts.length = parts.length - 1;
  }
  return { parts, endsWithWildcard };
}
