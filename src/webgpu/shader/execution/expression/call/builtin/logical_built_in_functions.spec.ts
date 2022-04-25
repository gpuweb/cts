export const description = `WGSL execution test. Section: Logical built-in functions`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('logical_builtin_functions,scalar_select')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#logical-builtin-functions')
  .desc(
    `
scalar select:
T is a scalar or a vector select(f:T,t:T,cond: bool): T Returns t when cond is true, and f otherwise. (OpSelect)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('logical_builtin_functions,vector_select')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#logical-builtin-functions')
  .desc(
    `
vector select:
T is a scalar select(f: vecN<T>,t: vecN<T>,cond: vecN<bool>) Component-wise selection. Result component i is evaluated as select(f[i],t[i],cond[i]). (OpSelect)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();
