import { stringifyPublicParams } from '../params_utils.js';
import { assert } from '../util/util.js';

import { TestQuery, validQueryPart } from './query.js';
import { kBigSeparator, kSmallSeparator, kWildcard } from './separators.js';

export function stringifyQuery(f: TestQuery): string {
  assert(validQueryPart.test(f.suite), 'suite must match ' + validQueryPart);
  let s = f.suite;

  // One or more group
  s += kBigSeparator;
  for (const part of f.group) {
    assert(
      validQueryPart.test(part),
      `group path part must match ${validQueryPart} - in ${JSON.stringify(f.group)}`
    );
  }

  if (!('test' in f)) {
    return s + [...f.group, kWildcard].join(kSmallSeparator);
  }
  s += f.group.join(kSmallSeparator);

  // Single group; one or more test
  s += kBigSeparator;
  assert(
    f.test.every(part => validQueryPart.test(part)),
    'test path parts must match ' + validQueryPart
  );

  if (!('params' in f)) {
    return s + [...f.test, kWildcard].join(kSmallSeparator);
  }
  s += f.test.join(kSmallSeparator);

  // Single test; one or more case
  s += kBigSeparator;
  const params = stringifyPublicParams(f.params);
  if (f.endsWithWildcard) {
    return s + [...params, kWildcard].join(kSmallSeparator);
  }

  // Single case
  s += params.join(kSmallSeparator);
  return s;
}
