import {
  CaseParamsRW,
  ParamArgument,
  badParamValueChars,
  paramKeyIsPublic,
} from '../params_utils.js';
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
  try {
    return parseQueryImpl(s);
  } catch (ex) {
    ex.message += '\n  on: ' + s;
    throw ex;
  }
}

function parseQueryImpl(s: string): TestQuery {
  // Undo encodeURIComponentSelectively
  s = decodeURIComponent(s);

  // bigParts are: suite, group, test, params (note kBigSeparator could appear in params)
  const bigParts = s.split(kBigSeparator, 4);
  assert(bigParts.length >= 2, `filter string must have at least one ${kBigSeparator}`);
  assert(bigParts.length <= 4);
  const suite = bigParts[0];

  const { parts: file, wildcard: filePathHasWildcard } = parseBigPart(bigParts[1], kPathSeparator);

  if (bigParts.length === 2) {
    // Query is file-level
    assert(
      filePathHasWildcard,
      `File-level query without wildcard ${kWildcard}. Did you want a file-level query \
(append ${kPathSeparator}${kWildcard}) or test-level query (append ${kBigSeparator}${kWildcard})?`
    );
    return new TestQueryMultiFile(suite, file);
  }
  assert(!filePathHasWildcard, `Wildcard ${kWildcard} must be at the end of the query string`);

  const { parts: test, wildcard: testPathHasWildcard } = parseBigPart(bigParts[2], kPathSeparator);

  if (bigParts.length === 3) {
    // Query is test-level
    assert(
      testPathHasWildcard,
      `Test-level query without wildcard ${kWildcard}; did you want a test-level query \
(append ${kPathSeparator}${kWildcard}) or case-level query (append ${kBigSeparator}${kWildcard})?`
    );
    assert(file.length > 0, 'File part of test-level query was empty (::)');
    return new TestQueryMultiTest(suite, file, test);
  }

  // Query is case-level
  assert(!testPathHasWildcard, `Wildcard ${kWildcard} must be at the end of the query string`);

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
    // Remove the last element of the array (which is just the wildcard).
    parts.length = parts.length - 1;
  }
  return { parts, wildcard: endsWithWildcard };
}

function parseSingleParam(paramSubstring: string): [string, ParamArgument] {
  assert(paramSubstring !== '', 'Param in a query must not be blank (is there a trailing comma?)');
  const i = paramSubstring.indexOf('=');
  assert(i !== -1, 'Param in a query must be of form key=value');
  const k = paramSubstring.substring(0, i);
  assert(paramKeyIsPublic(k), 'Param in a query must not be private (start with _)');
  const v = paramSubstring.substring(i + 1);
  return [k, parseSingleParamValue(v)];
}

function parseSingleParamValue(s: string): ParamArgument {
  assert(
    !badParamValueChars.test(s),
    `param value must not match ${badParamValueChars} - was ${s}`
  );
  return s === 'undefined' ? undefined : JSON.parse(s);
}
