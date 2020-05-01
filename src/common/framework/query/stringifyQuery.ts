import { stringifyPublicParams } from '../params_utils.js';
import { assert } from '../util/util.js';

import { TestQuery, validQueryPart } from './query.js';

export function stringifyQuery(f: TestQuery): string {
  assert(validQueryPart.test(f.suite), 'suite must match ' + validQueryPart);
  let s = f.suite + ':';

  assert(
    f.group.every(part => validQueryPart.test(part)),
    'group path parts must match ' + validQueryPart
  );
  s += f.group.join(';') + ':';

  if (f.test !== undefined) {
    assert(
      f.test.every(part => validQueryPart.test(part)),
      'test path parts must match ' + validQueryPart
    );
    s += f.test.join(';') + ':';

    if (f.params !== undefined) {
      s += stringifyPublicParams(f.params);
    }
  } else {
    assert(f.params === undefined, 'A filter may not have params without test name');
  }
  return s;
}
