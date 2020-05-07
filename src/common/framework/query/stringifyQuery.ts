import { stringifyPublicParams } from '../params_utils.js';
import { assert } from '../util/util.js';

import { TestQuery, validQueryPart } from './query.js';
import { kBigSeparator, kSmallSeparator } from './separators.js';

export function stringifyQuery(f: TestQuery): string {
  assert(validQueryPart.test(f.suite), 'suite must match ' + validQueryPart);
  let s = f.suite + kBigSeparator;

  for (const [i, part] of f.group.entries()) {
    let valid = validQueryPart.test(part);
    if (i < f.group.length - 1) {
      assert(valid, `non-final group path part must match ${validQueryPart} - was ${part}`);
    } else {
      valid = valid || part === '';
      assert(valid, `final group part must be '' or match ${validQueryPart} - was ${part}`);
    }
  }
  s += f.group.join(kSmallSeparator) + kBigSeparator;

  if ('test' in f) {
    assert(
      f.test.every(part => validQueryPart.test(part)),
      'test path parts must match ' + validQueryPart
    );
    s += f.test.join(kSmallSeparator) + kBigSeparator;

    if ('params' in f) {
      s += stringifyPublicParams(f.params);
    }
  }
  return s;
}
