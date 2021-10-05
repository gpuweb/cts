export const description = `WGSL execution test. Section: Float built-in functions`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('acos,float_builtin_functions')
  .uniqueId('3b55004d23fedacf')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
acos:
T is f32 or vecN<f32> acos(e: T ) -> T Returns the arc cosine of e. Component-wise when T is a vector. (GLSLstd450Acos)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('asin,float_builtin_functions')
  .uniqueId('322c7c5ba84c257a')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
asin:
T is f32 or vecN<f32> asin(e: T ) -> T Returns the arc sine of e. Component-wise when T is a vector. (GLSLstd450Asin)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('atan,float_builtin_functions')
  .uniqueId('b13828d6243d13dd')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
atan:
T is f32 or vecN<f32> atan(e: T ) -> T Returns the arc tangent of e. Component-wise when T is a vector. (GLSLstd450Atan)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('atan2,float_builtin_functions')
  .uniqueId('cc85953f226ac95c')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
atan2:
T is f32 or vecN<f32> atan2(e1: T ,e2: T ) -> T Returns the arc tangent of e1 over e2. Component-wise when T is a vector. (GLSLstd450Atan2)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('ceil,float_builtin_functions')
  .uniqueId('38d65728ea728bc5')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
ceil:
T is f32 or vecN<f32> ceil(e: T ) -> T Returns the ceiling of e. Component-wise when T is a vector. (GLSLstd450Ceil)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('clamp,float_builtin_functions')
  .uniqueId('88e39c61e6dbd26f')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
clamp:
T is f32 or vecN<f32> clamp(e1: T ,e2: T ,e3: T) -> T Returns min(max(e1,e2),e3). Component-wise when T is a vector. (GLSLstd450NClamp)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('cos,float_builtin_functions')
  .uniqueId('650973d690dcd841')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
cos:
T is f32 or vecN<f32> cos(e: T ) -> T Returns the cosine of e. Component-wise when T is a vector. (GLSLstd450Cos)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('cosh,float_builtin_functions')
  .uniqueId('e4499ece6f25610d')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
cosh:
T is f32 or vecN<f32> cosh(e: T ) -> T Returns the hyperbolic cosine of e. Component-wise when T is a vector (GLSLstd450Cosh)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('vector_case_cross,float_builtin_functions')
  .uniqueId('61356f087238c33c')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
vector case, cross:
T is f32 cross(e1: vec3<T> ,e2: vec3<T>) -> vec3<T> Returns the cross product of e1 and e2. (GLSLstd450Cross)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('distance,float_builtin_functions')
  .uniqueId('a1459d94b9d23add')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
distance:
T is f32 or vecN<f32> distance(e1: T ,e2: T ) -> f32 Returns the distance between e1 and e2 (e.g. length(e1-e2)). (GLSLstd450Distance)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('exp,float_builtin_functions')
  .uniqueId('ba1d78b3923e3ecc')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
exp:
T is f32 or vecN<f32> exp(e1: T ) -> T Returns the natural exponentiation of e1 (e.g. ee1). Component-wise when T is a vector. (GLSLstd450Exp)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('exp2,float_builtin_functions')
  .uniqueId('335173647c18d7b0')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
exp2:
T is f32 or vecN<f32> exp2(e: T ) -> T Returns 2 raised to the power e (e.g. 2e). Component-wise when T is a vector. (GLSLstd450Exp2)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('faceForward,float_builtin_functions')
  .uniqueId('ff98e4f5d2064a6f')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
faceForward:
T is vecN<f32> faceForward(e1: T ,e2: T ,e3: T ) -> T Returns e1 if dot(e2,e3) is negative, and -e1 otherwise. (GLSLstd450FaceForward)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('floor,float_builtin_functions')
  .uniqueId('2edb4534aa0e48a6')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
floor:
T is f32 or vecN<f32> floor(e: T ) -> T Returns the floor of e. Component-wise when T is a vector. (GLSLstd450Floor)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('fma,float_builtin_functions')
  .uniqueId('c6212635b880548b')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
fma:
T is f32 or vecN<f32> fma(e1: T ,e2: T ,e3: T ) -> T Returns e1 * e2 + e3. Component-wise when T is a vector. (GLSLstd450Fma)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('fract,float_builtin_functions')
  .uniqueId('58222ecf6f963798')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
fract:
T is f32 or vecN<f32> fract(e: T ) -> T Returns the fractional bits of e (e.g. e - floor(e)). Component-wise when T is a vector. (GLSLstd450Fract)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('scalar_case_frexp,float_builtin_functions')
  .uniqueId('c5df46977f5b77a0')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
scalar case, frexp:
T is f32 frexp(e:T) -> _frexp_result Splits e into a significand and exponent of the form significand * 2exponent. Returns the _frexp_result built-in structure, defined as: struct _frexp_result { sig : f32; // significand part exp : i32; // exponent part
}; The magnitude of the significand is in the range of [0.5, 1.0) or 0. Note: A value cannot be explicitly declared with the type _frexp_result, but a value may infer the type. (GLSLstd450FrexpStruct)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('vector_case_frexp,float_builtin_functions')
  .uniqueId('69806278766b12a2')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
vector case, frexp:
T is vecN<f32> frexp(e:T) -> _frexp_result_vecN Splits the components of e into a significand and exponent of the form significand * 2exponent. Returns the _frexp_result_vecN built-in structure, defined as: struct _frexp_result_vecN { sig : vecN<f32>; // significand part exp : vecN<i32>; // exponent part
}; The magnitude of each component of the significand is in the range of [0.5, 1.0) or 0. Note: A value cannot be explicitly declared with the type _frexp_result_vecN, but a value may infer the type. (GLSLstd450FrexpStruct)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('inverseSqrt,float_builtin_functions')
  .uniqueId('84fc180ad82c5618')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
inverseSqrt:
T is f32 or vecN<f32> inverseSqrt(e: T ) -> T Returns the reciprocal of sqrt(e). Component-wise when T is a vector. (GLSLstd450InverseSqrt)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('ldexp,float_builtin_functions')
  .uniqueId('358f6e4501a32907')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
ldexp:
T is f32 or vecN<f32> I is i32 or vecN<i32>, where I is a scalar if T is a scalar, or a vector when T is a vector ldexp(e1: T ,e2: I ) -> T Returns e1 * 2e2. Component-wise when T is a vector. (GLSLstd450Ldexp)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('length,float_builtin_functions')
  .uniqueId('0e5dba3253f9dec6')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
length:
T is f32 or vecN<f32> length(e: T ) -> f32 Returns the length of e (e.g. abs(e) if T is a scalar, or sqrt(e[0]2 + e[1]2 + ...) if T is a vector). (GLSLstd450Length)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('log,float_builtin_functions')
  .uniqueId('7cd6780116b47d00')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
log:
T is f32 or vecN<f32> log(e: T ) -> T Returns the natural logaritm of e. Component-wise when T is a vector. (GLSLstd450Log)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('log2,float_builtin_functions')
  .uniqueId('9ed120de1990296a')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
log2:
T is f32 or vecN<f32> log2(e: T ) -> T Returns the base-2 logarithm of e. Component-wise when T is a vector. (GLSLstd450Log2)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('max,float_builtin_functions')
  .uniqueId('bcb6c69b4ec703b1')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
max:
T is f32 or vecN<f32> max(e1: T ,e2: T ) -> T Returns e2 if e1 is less than e2, and e1 otherwise. If one operand is a NaN, the other is returned. If both operands are NaNs, a NaN is returned. Component-wise when T is a vector. (GLSLstd450NMax)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('min,float_builtin_functions')
  .uniqueId('53efc46faad0f380')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
min:
T is f32 or vecN<f32> min(e1: T ,e2: T ) -> T Returns e2 if e2 is less than e1, and e1 otherwise. If one operand is a NaN, the other is returned. If both operands are NaNs, a NaN is returned. Component-wise when T is a vector. (GLSLstd450NMin)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('mix_all_same_type_operands,float_builtin_functions')
  .uniqueId('f17861e71386bb59')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
mix all same type operands:
T is f32 or vecN<f32> mix(e1: T ,e2: T ,e3: T) -> T Returns the linear blend of e1 and e2 (e.g. e1*(1-e3)+e2*e3). Component-wise when T is a vector. (GLSLstd450FMix)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('vector_mix_with_scalar_blending_factor,float_builtin_functions')
  .uniqueId('0a9f4a579e0c1348')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
vector mix with scalar blending factor:
T is vecN<f32> mix(e1: T ,e2: T ,e3: f32 ) -> T Returns the component-wise linear blend of e1 and e2, using scalar blending factor e3 for each component. Same as mix(e1,e2,T(e3)).

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('scalar_case_modf,float_builtin_functions')
  .uniqueId('2a7234321aef021d')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
scalar case, modf:
T is f32 modf(e:T) -> _modf_result Splits e into fractional and whole number parts. Returns the _modf_result built-in structure, defined as: struct _modf_result { fract : f32; // fractional part whole : f32; // whole part
}; Note: A value cannot be explicitly declared with the type _modf_result, but a value may infer the type. (GLSLstd450ModfStruct)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('vector_case_modf,float_builtin_functions')
  .uniqueId('d1426ca015843ddf')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
vector case, modf:
T is vecN<f32> modf(e:T) -> _modf_result_vecN Splits the components of e into fractional and whole number parts. Returns the _modf_result_vecN built-in structure, defined as: struct _modf_result_vecN { fract : vecN<f32>; // fractional part whole : vecN<f32>; // whole part
}; Note: A value cannot be explicitly declared with the type _modf_result_vecN, but a value may infer the type. (GLSLstd450ModfStruct)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('vector_case_normalize,float_builtin_functions')
  .uniqueId('29c971aea0969a86')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
vector case, normalize:
T is f32 normalize(e: vecN<T> ) -> vecN<T> Returns a unit vector in the same direction as e. (GLSLstd450Normalize)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('pow,float_builtin_functions')
  .uniqueId('a3ff963b1810c8c4')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
pow:
T is f32 or vecN<f32> pow(e1: T ,e2: T ) -> T Returns e1 raised to the power e2. Component-wise when T is a vector. (GLSLstd450Pow)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('quantize_to_f16,float_builtin_functions')
  .uniqueId('ec899bfcd46a6316')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
quantize to f16:
T is f32 or vecN<f32> quantizeToF16(e: T ) -> T Quantizes a 32-bit floating point value e as if e were converted to a IEEE 754 binary16 value, and then converted back to a IEEE 754 binary32 value. See section 12.5.2 Floating point conversion. Component-wise when T is a vector. Note: The vec2<f32> case is the same as unpack2x16float(pack2x16float(e)). (OpQuantizeToF16)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('reflect,float_builtin_functions')
  .uniqueId('463ddb8c59de0a98')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
reflect:
T is vecN<f32> reflect(e1: T ,e2: T ) -> T For the incident vector e1 and surface orientation e2, returns the reflection direction e1-2*dot(e2,e1)*e2. (GLSLstd450Reflect)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('refract,float_builtin_functions')
  .uniqueId('8e0c0021b980cf0a')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
refract:
T is vecN<f32>I is f32 refract(e1: T ,e2: T ,e3: I ) -> T For the incident vector e1 and surface normal e2, and the ratio of indices of refraction e3, let k = 1.0 -e3*e3* (1.0 - dot(e2,e1) * dot(e2,e1)). If k < 0.0, returns the refraction vector 0.0, otherwise return the refraction vector e3*e1- (e3* dot(e2,e1) + sqrt(k)) *e2. (GLSLstd450Refract)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('round,float_builtin_functions')
  .uniqueId('427d7791f5cd13dc')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
round:
T is f32 or vecN<f32> round(e: T ) -> T Result is the integer k nearest to e, as a floating point value. When e lies halfway between integers k and k+1, the result is k when k is even, and k+1 when k is odd. Component-wise when T is a vector. (GLSLstd450RoundEven)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_sign,float_builtin_functions')
  .uniqueId('411a9acbb5411c89')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
float sign:
T is f32 or vecN<f32> sign(e: T ) -> T Returns the sign of e. Component-wise when T is a vector. (GLSLstd450FSign)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('sin,float_builtin_functions')
  .uniqueId('d10f3745e5ea639d')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
sin:
T is f32 or vecN<f32> sin(e: T ) -> T Returns the sine of e. Component-wise when T is a vector. (GLSLstd450Sin)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('sinh,float_builtin_functions')
  .uniqueId('d1d30e0b45aabed5')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
sinh:
T is f32 or vecN<f32> sinh(e: T ) -> T Returns the hyperbolic sine of e. Component-wise when T is a vector. (GLSLstd450Sinh)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('smoothStep,float_builtin_functions')
  .uniqueId('d1e9e5d30be184c0')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
smoothStep:
T is f32 or vecN<f32> smoothStep(e1: T ,e2: T ,e3: T ) -> T Returns the smooth Hermite interpolation between 0 and 1. Component-wise when T is a vector. (GLSLstd450SmoothStep)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('sqrt,float_builtin_functions')
  .uniqueId('f16f8ca434c7e6d8')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
sqrt:
T is f32 or vecN<f32> sqrt(e: T ) -> T Returns the square root of e. Component-wise when T is a vector. (GLSLstd450Sqrt)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('step,float_builtin_functions')
  .uniqueId('ac15bb28d3fa3032')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
step:
T is f32 or vecN<f32> step(e1: T ,e2: T ) -> T Returns 0.0 if e1 is less than e2, and 1.0 otherwise. Component-wise when T is a vector. (GLSLstd450Step)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('tan,float_builtin_functions')
  .uniqueId('0229869d4d7f2702')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
tan:
T is f32 or vecN<f32> tan(e: T ) -> T Returns the tangent of e. Component-wise when T is a vector. (GLSLstd450Tan)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('tanh,float_builtin_functions')
  .uniqueId('5d36803b13b3522d')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
tanh:
T is f32 or vecN<f32> tanh(e: T ) -> T Returns the hyperbolic tangent of e. Component-wise when T is a vector. (GLSLstd450Tanh)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('trunc,float_builtin_functions')
  .uniqueId('2f5ce2108f924fca')
  .url('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
trunc:
T is f32 or vecN<f32> trunc(e: T ) -> T Returns the nearest whole number whose absolute value is less than or equal to e. Component-wise when T is a vector. (GLSLstd450Trunc)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();
