export const description = `WGSL float builtin functions execution test plan`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('acos,float_builtin_functions')
  .uniqueId(0x5895c3d8ded05408)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
acos:
T is f32 or vecN<f32> acos(e: T ) -> T Returns the arc cosine of e. Component-wise when T is a vector.
(GLSLstd450Acos)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('asin,float_builtin_functions')
  .uniqueId(0x94640375b1a19e2d)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
asin:
T is f32 or vecN<f32> asin(e: T ) -> T Returns the arc sine of e. Component-wise when T is a vector.
(GLSLstd450Asin)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('atan,float_builtin_functions')
  .uniqueId(0x95b74c594bedc696)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
atan:
T is f32 or vecN<f32> atan(e: T ) -> T Returns the arc tangent of e. Component-wise when T is a vector.
(GLSLstd450Atan)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('atan2,float_builtin_functions')
  .uniqueId(0x4217319698588f70)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
atan2:
T is f32 or vecN<f32> atan2(e1: T ,e2: T ) -> T Returns the arc tangent of e1 over e2. Component-wise when T is a vector.
(GLSLstd450Atan2)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('ceil,float_builtin_functions')
  .uniqueId(0x8be559a33cb4295c)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
ceil:
T is f32 or vecN<f32> ceil(e: T ) -> T Returns the ceiling of e. Component-wise when T is a vector.
(GLSLstd450Ceil)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('clamp,float_builtin_functions')
  .uniqueId(0x5f1a6e944b4fa812)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
clamp:
T is f32 or vecN<f32> clamp(e1: T ,e2: T ,e3: T) -> T Returns min(max(e1,e2),e3). Component-wise when T is a vector.
(GLSLstd450NClamp)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('cos,float_builtin_functions')
  .uniqueId(0x1f711f1b9c1fa6b9)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
cos:
T is f32 or vecN<f32> cos(e: T ) -> T Returns the cosine of e. Component-wise when T is a vector.
(GLSLstd450Cos)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('cosh,float_builtin_functions')
  .uniqueId(0x84b2481a0e22b5ca)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
cosh:
T is f32 or vecN<f32> cosh(e: T ) -> T Returns the hyperbolic cosine of e. Component-wise when T is a vector
(GLSLstd450Cosh)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('vector_case_cross,float_builtin_functions')
  .uniqueId(0x61356f087238c33c)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
vector case, cross:
T is f32 cross(e1: vec3<T> ,e2: vec3<T>) -> vec3<T> Returns the cross product of e1 and e2. (GLSLstd450Cross)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('distance,float_builtin_functions')
  .uniqueId(0xe8344e67a286460d)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
distance:
T is f32 or vecN<f32> distance(e1: T ,e2: T ) -> f32 Returns the distance between e1 and e2 (e.g. length(e1-e2)).
(GLSLstd450Distance)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('exp,float_builtin_functions')
  .uniqueId(0x15adf62979a74d8e)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
exp:
T is f32 or vecN<f32> exp(e1: T ) -> T Returns the natural exponentiation of e1 (e.g. ee1). Component-wise when T is a vector.
(GLSLstd450Exp)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('exp2,float_builtin_functions')
  .uniqueId(0xc6667f2ca55ba116)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
exp2:
T is f32 or vecN<f32> exp2(e: T ) -> T Returns 2 raised to the power e (e.g. 2e). Component-wise when T is a vector.
(GLSLstd450Exp2)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('faceForward,float_builtin_functions')
  .uniqueId(0x67a32e8e0a94dba0)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
faceForward:
T is vecN<f32> faceForward(e1: T ,e2: T ,e3: T ) -> T Returns e1 if dot(e2,e3) is negative, and -e1 otherwise.
(GLSLstd450FaceForward)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('floor,float_builtin_functions')
  .uniqueId(0x08307bdcb3a2be90)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
floor:
T is f32 or vecN<f32> floor(e: T ) -> T Returns the floor of e. Component-wise when T is a vector.
(GLSLstd450Floor)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('fma,float_builtin_functions')
  .uniqueId(0x3e7338886153c83e)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
fma:
T is f32 or vecN<f32> fma(e1: T ,e2: T ,e3: T ) -> T Returns e1 * e2 + e3. Component-wise when T is a vector.
(GLSLstd450Fma)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('fract,float_builtin_functions')
  .uniqueId(0x524e395b4697c1f1)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
fract:
T is f32 or vecN<f32> fract(e: T ) -> T Returns the fractional bits of e (e.g. e - floor(e)). Component-wise when T is a vector.
(GLSLstd450Fract)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('scalar_case_frexp,float_builtin_functions')
  .uniqueId(0x52617e56adb8b053)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
scalar case, frexp:
T is f32 frexp(e:T) -> _frexp_result Splits e into a significand and exponent of the form significand * 2exponent.
Returns the _frexp_result built-in structure, defined as:
struct _frexp_result {
sig : f32; // significand part
exp : i32; // exponent part
};
The magnitude of the significand is in the range of [0.5, 1.0) or 0. Note: A value cannot be explicitly declared with the type _frexp_result, but a value may infer the type.
(GLSLstd450FrexpStruct)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('vector_case_frexp,float_builtin_functions')
  .uniqueId(0x878b388160aeb8b7)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
vector case, frexp:
T is vecN<f32> frexp(e:T) -> _frexp_result_vecN Splits the components of e into a significand and exponent of the form significand * 2exponent.
Returns the _frexp_result_vecN built-in structure, defined as:
struct _frexp_result_vecN {
sig : vecN<f32>; // significand part
exp : vecN<i32>; // exponent part
};
The magnitude of each component of the significand is in the range of [0.5, 1.0) or 0. Note: A value cannot be explicitly declared with the type _frexp_result_vecN, but a value may infer the type.
(GLSLstd450FrexpStruct)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('inverseSqrt,float_builtin_functions')
  .uniqueId(0x98d3dbb402a7ee78)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
inverseSqrt:
T is f32 or vecN<f32> inverseSqrt(e: T ) -> T Returns the reciprocal of sqrt(e). Component-wise when T is a vector.
(GLSLstd450InverseSqrt)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('ldexp,float_builtin_functions')
  .uniqueId(0x9c115279283c809c)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
ldexp:
T is f32 or vecN<f32> I is i32 or vecN<i32>, where I is a scalar if T is a scalar, or a vector when T is a vector ldexp(e1: T ,e2: I ) -> T Returns e1 * 2e2. Component-wise when T is a vector.
(GLSLstd450Ldexp)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('length,float_builtin_functions')
  .uniqueId(0x61bab2af4a74f1a0)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
length:
T is f32 or vecN<f32> length(e: T ) -> f32 Returns the length of e (e.g. abs(e) if T is a scalar, or sqrt(e[0]2 + e[1]2 + ...) if T is a vector).
(GLSLstd450Length)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('log,float_builtin_functions')
  .uniqueId(0xd65c6f6dc09f5f30)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
log:
T is f32 or vecN<f32> log(e: T ) -> T Returns the natural logaritm of e. Component-wise when T is a vector.
(GLSLstd450Log)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('log2,float_builtin_functions')
  .uniqueId(0x0bb29268380487ca)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
log2:
T is f32 or vecN<f32> log2(e: T ) -> T Returns the base-2 logarithm of e. Component-wise when T is a vector.
(GLSLstd450Log2)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('max,float_builtin_functions')
  .uniqueId(0x759f1ff9cc98e21a)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
max:
T is f32 or vecN<f32> max(e1: T ,e2: T ) -> T Returns e2 if e1 is less than e2, and e1 otherwise.
If one operand is a NaN, the other is returned.
If both operands are NaNs, a NaN is returned. Component-wise when T is a vector.
(GLSLstd450NMax)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('min,float_builtin_functions')
  .uniqueId(0x98f34e813a4bd94d)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
min:
T is f32 or vecN<f32> min(e1: T ,e2: T ) -> T Returns e2 if e2 is less than e1, and e1 otherwise.
If one operand is a NaN, the other is returned.
If both operands are NaNs, a NaN is returned. Component-wise when T is a vector.
(GLSLstd450NMin)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('mix_all_same_type_operands,float_builtin_functions')
  .uniqueId(0xf17861e71386bb59)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
mix all same type operands:
T is f32 or vecN<f32> mix(e1: T ,e2: T ,e3: T) -> T Returns the linear blend of e1 and e2 (e.g. e1*(1-e3)+e2*e3). Component-wise when T is a vector. (GLSLstd450FMix)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('vector_mix_with_scalar_blending_factor,float_builtin_functions')
  .uniqueId(0x9726fd039e9b9d0d)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
vector mix with scalar blending factor:
T is vecN<f32> mix(e1: T ,e2: T ,e3: f32 ) -> T Returns the component-wise linear blend of e1 and e2,
using scalar blending factor e3 for each component. Same as mix(e1,e2,T(e3)).
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('scalar_case_modf,float_builtin_functions')
  .uniqueId(0x22246b8dc9c0da82)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
scalar case, modf:
T is f32 modf(e:T) -> _modf_result Splits e into fractional and whole number parts.
Returns the _modf_result built-in structure, defined as:
struct _modf_result {
fract : f32; // fractional part
whole : f32; // whole part
};
Note: A value cannot be explicitly declared with the type _modf_result, but a value may infer the type.
(GLSLstd450ModfStruct)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('vector_case_modf,float_builtin_functions')
  .uniqueId(0xad1d36f0fbba0576)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
vector case, modf:
T is vecN<f32> modf(e:T) -> _modf_result_vecN Splits the components of e into fractional and whole number parts.
Returns the _modf_result_vecN built-in structure, defined as:
struct _modf_result_vecN {
fract : vecN<f32>; // fractional part
whole : vecN<f32>; // whole part
};
Note: A value cannot be explicitly declared with the type _modf_result_vecN, but a value may infer the type.
(GLSLstd450ModfStruct)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('vector_case_normalize,float_builtin_functions')
  .uniqueId(0x91606f02581e74f1)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
vector case, normalize:
T is f32 normalize(e: vecN<T> ) -> vecN<T> Returns a unit vector in the same direction as e.
(GLSLstd450Normalize)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('pow,float_builtin_functions')
  .uniqueId(0xa2a0dd21ebec7eb9)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
pow:
T is f32 or vecN<f32> pow(e1: T ,e2: T ) -> T Returns e1 raised to the power e2. Component-wise when T is a vector.
(GLSLstd450Pow)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('quantize_to_f16,float_builtin_functions')
  .uniqueId(0xbabf04e7b7d0ac45)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
quantize to f16:
T is f32 or vecN<f32> quantizeToF16(e: T ) -> T Quantizes a 32-bit floating point value e as if e were converted to a IEEE 754 binary16 value,
and then converted back to a IEEE 754 binary32 value. See section 12.5.2 Floating point conversion. Component-wise when T is a vector. Note: The vec2<f32> case is the same as unpack2x16float(pack2x16float(e)).
(OpQuantizeToF16)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('reflect,float_builtin_functions')
  .uniqueId(0x6ffbb7218130def7)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
reflect:
T is vecN<f32> reflect(e1: T ,e2: T ) -> T For the incident vector e1 and surface orientation e2, returns the reflection direction e1-2*dot(e2,e1)*e2.
(GLSLstd450Reflect)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('refract,float_builtin_functions')
  .uniqueId(0xaf328596af19edec)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
refract:
T is vecN<f32>I is f32 refract(e1: T ,e2: T ,e3: I ) -> T For the incident vector e1 and surface normal e2, and the ratio of indices of refraction e3,
let k = 1.0 -e3*e3* (1.0 - dot(e2,e1) * dot(e2,e1)). If k < 0.0, returns the
refraction vector 0.0, otherwise return the refraction vector e3*e1- (e3* dot(e2,e1) + sqrt(k)) *e2.
(GLSLstd450Refract)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('round,float_builtin_functions')
  .uniqueId(0x71f00c908ebab4e9)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
round:
T is f32 or vecN<f32> round(e: T ) -> T Result is the integer k nearest to e, as a floating point value. When e lies halfway between integers k and k+1,
the result is k when k is even, and k+1 when k is odd. Component-wise when T is a vector.
(GLSLstd450RoundEven)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_sign,float_builtin_functions')
  .uniqueId(0x114527352c49e623)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
float sign:
T is f32 or vecN<f32> sign(e: T ) -> T Returns the sign of e. Component-wise when T is a vector.
(GLSLstd450FSign)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('sin,float_builtin_functions')
  .uniqueId(0x74d952bfd3034b44)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
sin:
T is f32 or vecN<f32> sin(e: T ) -> T Returns the sine of e. Component-wise when T is a vector.
(GLSLstd450Sin)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('sinh,float_builtin_functions')
  .uniqueId(0x202ef583b4f0ba50)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
sinh:
T is f32 or vecN<f32> sinh(e: T ) -> T Returns the hyperbolic sine of e. Component-wise when T is a vector.
(GLSLstd450Sinh)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('smoothStep,float_builtin_functions')
  .uniqueId(0x8a33efa03548ca15)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
smoothStep:
T is f32 or vecN<f32> smoothStep(e1: T ,e2: T ,e3: T ) -> T Returns the smooth Hermite interpolation between 0 and 1. Component-wise when T is a vector.
(GLSLstd450SmoothStep)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('sqrt,float_builtin_functions')
  .uniqueId(0xb961f9fb9a0db769)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
sqrt:
T is f32 or vecN<f32> sqrt(e: T ) -> T Returns the square root of e. Component-wise when T is a vector.
(GLSLstd450Sqrt)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('step,float_builtin_functions')
  .uniqueId(0x2e06c48509f01146)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
step:
T is f32 or vecN<f32> step(e1: T ,e2: T ) -> T Returns 0.0 if e1 is less than e2, and 1.0 otherwise. Component-wise when T is a vector.
(GLSLstd450Step)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('tan,float_builtin_functions')
  .uniqueId(0x4241207beb726199)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
tan:
T is f32 or vecN<f32> tan(e: T ) -> T Returns the tangent of e. Component-wise when T is a vector.
(GLSLstd450Tan)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('tanh,float_builtin_functions')
  .uniqueId(0x36604aae7ca70879)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
tanh:
T is f32 or vecN<f32> tanh(e: T ) -> T Returns the hyperbolic tangent of e. Component-wise when T is a vector.
(GLSLstd450Tanh)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('trunc,float_builtin_functions')
  .uniqueId(0x4fb7a3915be9cdd3)
  .desc(
    `
https://www.w3.org/TR/2021/WD-WGSL-20210910/#float-builtin-functions
trunc:
T is f32 or vecN<f32> trunc(e: T ) -> T Returns the nearest whole number whose absolute value is less than or equal to e. Component-wise when T is a vector.
(GLSLstd450Trunc)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();
