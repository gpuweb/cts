export const description = `
Execution Tests for the 'all' builtin function
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { assert } from '../../../../common/util/util.js';
import { GPUTest } from '../../../gpu_test.js';
import { generateTypes, TypeInfo } from '../../types.js';
import { NumberType, Case } from '../../util.js';

import { submitComputeShader, createInputBuffer, createBuiltinCall } from './builtin.js';

export const g = makeTestGroup(GPUTest);

type Cases = Case[];

function runShaderTest(
  typeInfo: TypeInfo,
  builtin: string,
  t: GPUTest,
  numberType: NumberType,
  cases: Cases
): void {
  const source = `
  [[block]]
  struct Data {
    values : [[stride(16)]] array<${typeInfo.containerType}, ${cases.length}>;
  };

  [[group(0), binding(0)]] var<${typeInfo.storageClass}, read> inputs : Data;
  [[group(0), binding(1)]] var<${typeInfo.storageClass}, write> outputs : Data;

  [[stage(compute), workgroup_size(1)]]
  fn main() {
    for(var i = 0; i < ${cases.length}; i = i + 1) {
        let input : ${typeInfo.containerType} = inputs.values[i];
        let result : ${typeInfo.containerType} = ${builtin}(input);
        outputs.values[i] = result;
    }
  }
`;

  const inputData = createInputBuffer(numberType, cases, typeInfo);
  const outputBuffer = submitComputeShader(source, t, inputData);

  const checkExpectation = (outputDataAsF32: Float32Array) => {
    const errs = createBuiltinCall(
      typeInfo,
      builtin,
      outputDataAsF32,
      inputData,
      cases,
      numberType
    );
    if (errs.length > 0) {
      return new Error(errs.join('\n\n'));
    }
    return undefined;
  };

  t.expectGPUBufferValuesPassCheck(outputBuffer, checkExpectation, {
    type: Float32Array,
    typedLength: inputData.length,
  });
}

g.test('float')
  .desc(
    `abs(e: T ) -> T, T is f32 or vecN<f32>
`
  )
  .params(u =>
    u
      .combineWithParams([{ storageClass: 'storage' }] as const)
      .combineWithParams([{ baseType: 'f32' }] as const)
      .combineWithParams([{ containerType: 'scalar' }, { containerType: 'vector' }] as const)
      .combineWithParams([{ supportsAtomics: false }] as const)
      .beginSubcases()
      .expandWithParams(generateTypes)
  )
  .fn(t => {
    const { storageClass, baseType, type, _kTypeInfo } = t.params;
    if (!_kTypeInfo) {
      assert(false, 'generated type is undefined');
      return;
    }
    const typeInfo: TypeInfo = {
      storageClass,
      baseType,
      containerType: type,
      alignment: _kTypeInfo.layout.alignment,
      size: _kTypeInfo.layout.size,
      arrayLength: _kTypeInfo.arrayLength,
      innerLength: _kTypeInfo.innerLength,
    };
    runShaderTest(typeInfo, 'abs', t, NumberType.Float, [
      { input: 0.0, expected: [0.0] },
      { input: -1.0, expected: [1.0] },
      { input: -2.0, expected: [2.0] },
      { input: -4.0, expected: [4.0] },
      { input: -8.0, expected: [8.0] },
      { input: -16.0, expected: [16.0] },
      { input: -32.0, expected: [32.0] },
      { input: -64.0, expected: [64.0] },
      { input: -128.0, expected: [128.0] },
      { input: -256.0, expected: [256.0] },
      { input: -512.0, expected: [512.0] },
      { input: -1024.0, expected: [1024.0] },
      { input: -2048.0, expected: [2048.0] },
      { input: -4096.0, expected: [4096.0] },
      { input: -8192.0, expected: [8192.0] },
      { input: -16384.0, expected: [16384.0] },
      { input: -32768.0, expected: [32768.0] },
      { input: -65536.0, expected: [65536.0] },
      { input: -131072.0, expected: [131072.0] },
      { input: -262144.0, expected: [262144.0] },
      { input: -524288.0, expected: [524288.0] },
      { input: -1048576.0, expected: [1048576.0] },
      { input: -8388607.0, expected: [8388607.0] }, //2^23 - 1
      { input: -16777215.0, expected: [16777215.0] }, //2^24 - 1
      { input: -16777216.0, expected: [16777216.0] }, //2^24
    ]);
  });

g.test('int')
  .desc(`abs(e: T ) -> T, T is i32 or vecN<i32>`)
  .params(u =>
    u
      .combineWithParams([{ storageClass: 'storage' }] as const)
      .combineWithParams([{ baseType: 'i32' }] as const)
      .combineWithParams([{ containerType: 'scalar' }, { containerType: 'vector' }] as const)
      .combineWithParams([{ supportsAtomics: false }] as const)
      .beginSubcases()
      .expandWithParams(generateTypes)
  )
  .fn(t => {
    const { storageClass, baseType, type, _kTypeInfo } = t.params;
    if (_kTypeInfo === undefined) {
      assert(false, 'generated type is undefined');
      return;
    }
    const typeInfo: TypeInfo = {
      storageClass,
      baseType,
      containerType: type,
      alignment: _kTypeInfo.layout.alignment,
      size: _kTypeInfo.layout.size,
      arrayLength: _kTypeInfo.arrayLength,
      innerLength: _kTypeInfo.innerLength,
    };
    runShaderTest(typeInfo, 'abs', t, NumberType.Int, [
      { input: 0, expected: [0] },
      { input: 1, expected: [1] },
      { input: 2, expected: [2] },
      { input: 4, expected: [4] },
      { input: 8, expected: [8] },
      { input: 16, expected: [16] },
      { input: 32, expected: [32] },
      { input: 64, expected: [64] },
      { input: 128, expected: [128] },
      { input: 256, expected: [256] },
      { input: 512, expected: [512] },
      { input: 1024, expected: [1024] },
      { input: 2048, expected: [2048] },
      { input: 4096, expected: [4096] },
      { input: 8192, expected: [8192] },
      { input: 16384, expected: [16384] },
      { input: 32768, expected: [32768] },
      { input: 65536, expected: [65536] },
      { input: 131072, expected: [131072] },
      { input: 262144, expected: [262144] },
      { input: 524288, expected: [524288] },
      { input: 1048576, expected: [1048576] },
      { input: 8388607, expected: [8388607] }, //2^23 - 1
      { input: 16777215, expected: [16777215] }, //2^24 - 1
      { input: 16777216, expected: [16777216] }, //2^24
      { input: 134217727, expected: [134217727] }, //2^27 - 1
      { input: 1073741823, expected: [1073741823] }, //2^30 - 1
      { input: 2147483647, expected: [2147483647] }, //2^31 - 1
    ]);
  });

g.test('hex')
  .desc(`abs(e: T ) -> T, T is u32 or vecN<u32>`)
  .params(u =>
    u
      .combineWithParams([{ storageClass: 'storage' }] as const)
      .combineWithParams([{ baseType: 'u32' }] as const)
      .combineWithParams([{ containerType: 'scalar' }, { containerType: 'vector' }] as const)
      .combineWithParams([{ supportsAtomics: false }] as const)
      .beginSubcases()
      .expandWithParams(generateTypes)
  )
  .fn(t => {
    const { storageClass, baseType, type, _kTypeInfo } = t.params;
    if (!_kTypeInfo) {
      assert(false, 'generated type is undefined');
      return;
    }
    const typeInfo: TypeInfo = {
      storageClass,
      baseType,
      containerType: type,
      alignment: _kTypeInfo.layout.alignment,
      size: _kTypeInfo.layout.size,
      arrayLength: _kTypeInfo.arrayLength,
      innerLength: _kTypeInfo.innerLength,
    };
    runShaderTest(typeInfo, 'abs', t, NumberType.Hex, [
      { input: 0xffffffff, expected: [0xffffffff] }, // -Inf f32
      { input: 0x477fe000, expected: [0x477fe000] }, // 65504 - largest positive f16
      { input: 0xc77fe000, expected: [0xc77fe000] }, // -65504 - largest negative f16
      { input: 0x3380346c, expected: [0x3380346c] }, // 0.0000000597 - smallest positive f16
      { input: 0x3380346c, expected: [0x3380346c] }, // 0.0000000597 - smallest positive f16
      //   { input: NevativeInf, expected: [PositiveInf] }, // 0.0000000597 - smallest positive f16
    ]);
  });

g.test('uint')
  .desc(`abs(e: T ) -> T, T is u32 or vecN<u32>`)
  .params(u =>
    u
      .combineWithParams([{ storageClass: 'storage' }] as const)
      .combineWithParams([{ baseType: 'u32' }] as const)
      .combineWithParams([{ containerType: 'scalar' }, { containerType: 'vector' }] as const)
      .combineWithParams([{ supportsAtomics: false }] as const)
      .beginSubcases()
      .expandWithParams(generateTypes)
  )
  .fn(t => {
    const { storageClass, baseType, type, _kTypeInfo } = t.params;
    if (!_kTypeInfo) {
      assert(false, 'generated type is undefined');
      return;
    }
    const typeInfo: TypeInfo = {
      storageClass,
      baseType,
      containerType: type,
      alignment: _kTypeInfo.layout.alignment,
      size: _kTypeInfo.layout.size,
      arrayLength: _kTypeInfo.arrayLength,
      innerLength: _kTypeInfo.innerLength,
    };
    runShaderTest(typeInfo, 'abs', t, NumberType.Hex, [
      { input: 0, expected: [0] },
      { input: 1, expected: [1] },
      { input: 2, expected: [2] },
      { input: 4, expected: [4] },
      { input: 8, expected: [8] },
      { input: 16, expected: [16] },
      { input: 32, expected: [32] },
      { input: 64, expected: [64] },
      { input: 128, expected: [128] },
      { input: 256, expected: [256] },
      { input: 512, expected: [512] },
      { input: 1024, expected: [1024] },
      { input: 2048, expected: [2048] },
      { input: 4096, expected: [4096] },
      { input: 8192, expected: [8192] },
      { input: 16384, expected: [16384] },
      { input: 32768, expected: [32768] },
      { input: 65536, expected: [65536] },
      { input: 131072, expected: [131072] },
      { input: 262144, expected: [262144] },
      { input: 524288, expected: [524288] },
      { input: 1048576, expected: [1048576] },
      { input: 8388607, expected: [8388607] }, //2^23 - 1
      { input: 16777215, expected: [16777215] }, //2^24 - 1
      { input: 16777216, expected: [16777216] }, //2^24
      { input: 134217727, expected: [134217727] }, //2^27 - 1
      { input: 2147483647, expected: [2147483647] }, //2^31 - 1
    ]);
  });
