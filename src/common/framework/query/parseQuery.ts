import { parseSingleParam, CaseParamsRW } from '../params_utils.js';
import { assert } from '../util/util.js';

import {
  TestQuery,
  TestQueryMultiFile,
  TestQueryMultiTest,
  TestQueryMultiCase,
  TestQuerySingleCase,
} from './query.js';
import { kBigSeparator, kWildcard, kPathSeparator, kParamSeparator } from './separators.js';
import { validQueryPart } from './validQueryPart.js';

export function parseQuery(s: string): TestQuery {
  const bigParts = s.split(kBigSeparator, 4); // suite, group, test, params
  assert(bigParts.length >= 2, `filter string must have at least one ${kBigSeparator}`);
  const suite = bigParts[0];

  const { parts: file, wildcard: groupHasWildcard } = parseBigPart(bigParts[1], kPathSeparator);

  if (bigParts.length === 2) {
    // Query is file-level
    assert(
      groupHasWildcard,
      `File-level query without wildcard ${kWildcard}; did you want a test-level query? \
(Append ${kBigSeparator}${kWildcard})`
    );
    return new TestQueryMultiFile(suite, file);
  }
  assert(!groupHasWildcard, `Wildcard ${kWildcard} must be at the end of the query string`);

  const { parts: test, wildcard: testHasWildcard } = parseBigPart(bigParts[2], kPathSeparator);

  if (bigParts.length === 3) {
    // Query is test-level
    assert(
      testHasWildcard,
      `Test-level query without wildcard ${kWildcard}; did you want a case-level query? \
(Append ${kBigSeparator}${kWildcard})`
    );
    assert(file.length > 0, 'File part of test-level query was empty (::)');
    return new TestQueryMultiTest(suite, file, test);
  }

  // Query is case-level
  assert(!testHasWildcard, `Wildcard ${kWildcard} must be at the end of the query string`);

  const { parts: paramsParts, wildcard: paramsHasWildcard } = parseBigPart(
    bigParts[3],
    kParamSeparator
  );

  assert(test.length > 0, 'Test part of case-level query was empty (::)');

  const params: CaseParamsRW = {};
  for (const paramPart of paramsParts) {
    const [k, v] = parseSingleParam(paramPart);
    assert(validQueryPart.test(k), 'param key names must match ' + validQueryPart);
    params[k] = v;
  }
  if (paramsHasWildcard) {
    return new TestQueryMultiCase(suite, file, test, params);
  } else {
    return new TestQuerySingleCase(suite, file, test, params);
  }
}

// webgpu:a,b,* or webgpu:a,b,c:*
const kExampleQueries = `\
webgpu${kBigSeparator}a${kPathSeparator}b${kPathSeparator}${kWildcard} or \
webgpu${kBigSeparator}a${kPathSeparator}b${kPathSeparator}c${kBigSeparator}${kWildcard}`;

function parseBigPart(
  s: string,
  separator: typeof kParamSeparator | typeof kPathSeparator
): { parts: string[]; wildcard: boolean } {
  if (s === '') {
    return { parts: [], wildcard: false };
  }
  const parts = s.split(separator);

  let endsWithWildcard = false;
  for (const [i, part] of parts.entries()) {
    if (i === parts.length - 1) {
      endsWithWildcard = part === kWildcard;
    }
    assert(
      part.indexOf(kWildcard) === -1 || endsWithWildcard,
      `Wildcard ${kWildcard} must be complete last part of a path (e.g. ${kExampleQueries})`
    );
  }
  if (endsWithWildcard) {
    parts.length = parts.length - 1;
  }
  return { parts, wildcard: endsWithWildcard };
}
