import { TestGroupID } from '../id.js';
import { stringifyPublicParams } from '../params_utils.js';
import { assert } from '../util/util.js';

import { TestQuery } from './query.js';
import { kBigSeparator, kSmallSeparator, kWildcard } from './separators.js';
import { validQueryPart } from './validQueryPart.js';

export function stringifyQuery(query: TestQuery): string {
  const q = bakeInWildcard(query);
  let s = q.suite;

  s += kBigSeparator + q.file.join(kSmallSeparator);
  if (!('test' in q)) {
    return s;
  }

  s += kBigSeparator + q.test.join(kSmallSeparator);
  if (!('caseParams' in q)) {
    return s;
  }

  s += kBigSeparator + q.caseParams.join(kSmallSeparator);
  return s;
}

type TestQueryL1WithBakedWildcard = TestGroupID;
interface TestQueryL2WithBakedWildcard extends TestQueryL1WithBakedWildcard {
  readonly test: readonly string[];
}
interface TestQueryL3WithBakedWildcard extends TestQueryL2WithBakedWildcard {
  readonly caseParams: readonly string[];
}
type TestQueryWithBakedWildcard =
  | TestQueryL1WithBakedWildcard
  | TestQueryL2WithBakedWildcard
  | TestQueryL3WithBakedWildcard;

function bakeInWildcard(f: TestQuery): TestQueryWithBakedWildcard {
  assert(validQueryPart.test(f.suite), 'suite must match ' + validQueryPart);

  assert(
    f.file.every(part => validQueryPart.test(part)),
    `file path part must match ${validQueryPart} - in ${JSON.stringify(f.file)}`
  );
  if (!('test' in f)) {
    return { ...f, file: [...f.file, kWildcard] };
  }

  assert(
    f.test.every(part => validQueryPart.test(part)),
    `test path part must match ${validQueryPart} - in ${JSON.stringify(f.test)}`
  );
  if (!('params' in f)) {
    return { ...f, test: [...f.test, kWildcard] };
  }

  const caseParams = stringifyPublicParams(f.params);
  if (f.endsWithWildcard) caseParams.push(kWildcard);
  return { ...f, caseParams };
}
