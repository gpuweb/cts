<<<<<<< HEAD
=======
<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> 04d0408 (wgsl: Add section 16.3 test plan)
<<<<<<< HEAD:src/webgpu/shader/execution/builtin/logical_built_in_functions.spec.ts
export const description = `WGSL execution test. Section: Logical built-in functions`;
=======
export const description = `WGSL logical builtin functions execution test plan`;
>>>>>>> a267bf1 (wgsl: Add section 16.3 test plan):src/webgpu/shader/execution/builtin/plan_logical_builtin_functions.spec.ts
<<<<<<< HEAD
=======
=======
=======
>>>>>>> e10f565 (wgsl: Add section 16.3 test plan)
<<<<<<< HEAD:src/webgpu/shader/execution/builtin/plan_logical_builtin_functions.spec.ts
export const description = `WGSL logical builtin functions execution test plan`;
=======
export const description = `WGSL execution test. Section: Logical built-in functions`;
>>>>>>> dbc13b1 (uniqueId argument to string. Update the test plans (#770)):src/webgpu/shader/execution/builtin/logical_built_in_functions.spec.ts
<<<<<<< HEAD
>>>>>>> 7b7f05a (uniqueId argument to string. Update the test plans (#770))
=======
=======
<<<<<<< HEAD:src/webgpu/shader/execution/builtin/logical_built_in_functions.spec.ts
export const description = `WGSL execution test. Section: Logical built-in functions`;
=======
export const description = `WGSL logical builtin functions execution test plan`;
>>>>>>> a267bf1 (wgsl: Add section 16.3 test plan):src/webgpu/shader/execution/builtin/plan_logical_builtin_functions.spec.ts
>>>>>>> eebc11d (wgsl: Add section 16.3 test plan)
>>>>>>> e10f565 (wgsl: Add section 16.3 test plan)
>>>>>>> 04d0408 (wgsl: Add section 16.3 test plan)

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('vector_all,logical_builtin_functions')
  .uniqueId('d140d173a2acf981')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#logical-builtin-functions')
  .desc(
    `
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
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#logical-builtin-functions')
  .desc(
    `
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
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#logical-builtin-functions')
  .desc(
    `
scalar select:
T is a scalar or a vector select(f:T,t:T,cond: bool): T Returns t when cond is true, and f otherwise. (OpSelect)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('vector_select,logical_builtin_functions')
  .uniqueId('8b7bb7f58ee1e479')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#logical-builtin-functions')
  .desc(
    `
vector select:
T is a scalar select(f: vecN<T>,t: vecN<T>,cond: vecN<bool>) Component-wise selection. Result component i is evaluated as select(f[i],t[i],cond[i]). (OpSelect)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();
