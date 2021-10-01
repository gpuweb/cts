export const description = `WGSL execution test. Section: Logical built-in functions`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('vector_all,logical_builtin_functions')
  .uniqueId('d140d173a2acf981')
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210929/#logical-builtin-functions
vector all:
e: vecN<bool> all(e): bool Returns true if each component of e is true. (OpAll)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('vector_any,logical_builtin_functions')
  .uniqueId('ac2b3a100379d70f')
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210929/#logical-builtin-functions
vector any:
e: vecN<bool> any(e): bool Returns true if any component of e is true. (OpAny)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('scalar_select,logical_builtin_functions')
  .uniqueId('50b1f627c11098a1')
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210929/#logical-builtin-functions
scalar select:
T is a scalar or a vector select(f:T,t:T,cond: bool): T
Returns t when cond is true, and f otherwise. (OpSelect)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('vector_select,logical_builtin_functions')
  .uniqueId('7f386e1295111c09')
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210929/#logical-builtin-functions
vector select:
T is a scalar select(f: vecN<T>,t: vecN<T,cond: vecN<bool>>) Component-wise selection.
Result component i is evaluated as select(f[i],t[i],cond[i]). (OpSelect)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();
