import { stringifyPublicParams } from '../params_utils.js';
import { assert } from '../util/util.js';

import { TestQuery, validQueryPart } from './query.js';
import { kBigSeparator, kSmallSeparator, kWildcard } from './separators.js';

export function stringifyQuery(query: TestQuery): string {
  const q = bakeInWildcard(query);
  let s = q.suite;

  s += kBigSeparator + q.group.join(kSmallSeparator);
  if (!('test' in q)) {
    return s;
  }

  s += kBigSeparator + q.test.join(kSmallSeparator);
  if (!('params' in q)) {
    return s;
  }

  s += kBigSeparator + q.params.join(kSmallSeparator);
  return s;
}

interface TestQueryL1WithBakedWildcard {
  readonly suite: string;
  readonly group: readonly string[];
}
interface TestQueryL2WithBakedWildcard extends TestQueryL1WithBakedWildcard {
  readonly test: readonly string[];
}
interface TestQueryL3WithBakedWildcard extends TestQueryL2WithBakedWildcard {
  readonly params: readonly string[];
}
type TestQueryWithBakedWildcard =
  | TestQueryL1WithBakedWildcard
  | TestQueryL2WithBakedWildcard
  | TestQueryL3WithBakedWildcard;

function bakeInWildcard(f: TestQuery): TestQueryWithBakedWildcard {
  assert(validQueryPart.test(f.suite), 'suite must match ' + validQueryPart);

  assert(
    f.group.every(part => validQueryPart.test(part)),
    `group path part must match ${validQueryPart} - in ${JSON.stringify(f.group)}`
  );
  if (!('test' in f)) {
    return { ...f, group: [...f.group, kWildcard] };
  }

  assert(
    f.test.every(part => validQueryPart.test(part)),
    `test path part must match ${validQueryPart} - in ${JSON.stringify(f.test)}`
  );
  if (!('params' in f)) {
    return { ...f, test: [...f.test, kWildcard] };
  }

  const params = stringifyPublicParams(f.params);
  if (f.endsWithWildcard) params.push(kWildcard);
  return { ...f, params };
}
