export const description = `WGSL execution test. Section: Float built-in functions`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('float_builtin_functions,acos')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
acos:
T is f32 or vecN<f32> acos(e: T ) -> T Returns the arc cosine of e. Component-wise when T is a vector. (GLSLstd450Acos)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,asin')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
asin:
T is f32 or vecN<f32> asin(e: T ) -> T Returns the arc sine of e. Component-wise when T is a vector. (GLSLstd450Asin)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,cosh')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
cosh:
T is f32 or vecN<f32> cosh(e: T ) -> T Returns the hyperbolic cosine of e. Component-wise when T is a vector (GLSLstd450Cosh)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,vector_case_cross')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
vector case, cross:
T is f32 cross(e1: vec3<T> ,e2: vec3<T>) -> vec3<T> Returns the cross product of e1 and e2. (GLSLstd450Cross)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,distance')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
distance:
T is f32 or vecN<f32> distance(e1: T ,e2: T ) -> f32 Returns the distance between e1 and e2 (e.g. length(e1-e2)). (GLSLstd450Distance)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,exp')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
exp:
T is f32 or vecN<f32> exp(e1: T ) -> T Returns the natural exponentiation of e1 (e.g. ee1). Component-wise when T is a vector. (GLSLstd450Exp)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,exp2')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
exp2:
T is f32 or vecN<f32> exp2(e: T ) -> T Returns 2 raised to the power e (e.g. 2e). Component-wise when T is a vector. (GLSLstd450Exp2)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,faceForward')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
faceForward:
T is vecN<f32> faceForward(e1: T ,e2: T ,e3: T ) -> T Returns e1 if dot(e2,e3) is negative, and -e1 otherwise. (GLSLstd450FaceForward)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,fma')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
fma:
T is f32 or vecN<f32> fma(e1: T ,e2: T ,e3: T ) -> T Returns e1 * e2 + e3. Component-wise when T is a vector. (GLSLstd450Fma)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,scalar_case_frexp')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
scalar case, frexp:
T is f32 frexp(e:T) -> _frexp_result Splits e into a significand and exponent of the form significand * 2exponent. Returns the _frexp_result built-in structure, defined as: struct _frexp_result { sig : f32; // significand part exp : i32; // exponent part
}; The magnitude of the significand is in the range of [0.5, 1.0) or 0. Note: A value cannot be explicitly declared with the type _frexp_result, but a value may infer the type. (GLSLstd450FrexpStruct)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,vector_case_frexp')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
vector case, frexp:
T is vecN<f32> frexp(e:T) -> _frexp_result_vecN Splits the components of e into a significand and exponent of the form significand * 2exponent. Returns the _frexp_result_vecN built-in structure, defined as: struct _frexp_result_vecN { sig : vecN<f32>; // significand part exp : vecN<i32>; // exponent part
}; The magnitude of each component of the significand is in the range of [0.5, 1.0) or 0. Note: A value cannot be explicitly declared with the type _frexp_result_vecN, but a value may infer the type. (GLSLstd450FrexpStruct)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,inverseSqrt')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
inverseSqrt:
T is f32 or vecN<f32> inverseSqrt(e: T ) -> T Returns the reciprocal of sqrt(e). Component-wise when T is a vector. (GLSLstd450InverseSqrt)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,length')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
length:
T is f32 or vecN<f32> length(e: T ) -> f32 Returns the length of e (e.g. abs(e) if T is a scalar, or sqrt(e[0]2 + e[1]2 + ...) if T is a vector). (GLSLstd450Length)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,mix_all_same_type_operands')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
mix all same type operands:
T is f32 or vecN<f32> mix(e1: T ,e2: T ,e3: T) -> T Returns the linear blend of e1 and e2 (e.g. e1*(1-e3)+e2*e3). Component-wise when T is a vector. (GLSLstd450FMix)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,vector_mix_with_scalar_blending_factor')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
vector mix with scalar blending factor:
T is vecN<f32> mix(e1: T ,e2: T ,e3: f32 ) -> T Returns the component-wise linear blend of e1 and e2, using scalar blending factor e3 for each component. Same as mix(e1,e2,T(e3)).
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,scalar_case_modf')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
scalar case, modf:
T is f32 modf(e:T) -> _modf_result Splits e into fractional and whole number parts. Returns the _modf_result built-in structure, defined as: struct _modf_result { fract : f32; // fractional part whole : f32; // whole part
}; Note: A value cannot be explicitly declared with the type _modf_result, but a value may infer the type. (GLSLstd450ModfStruct)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,vector_case_modf')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
vector case, modf:
T is vecN<f32> modf(e:T) -> _modf_result_vecN Splits the components of e into fractional and whole number parts. Returns the _modf_result_vecN built-in structure, defined as: struct _modf_result_vecN { fract : vecN<f32>; // fractional part whole : vecN<f32>; // whole part
}; Note: A value cannot be explicitly declared with the type _modf_result_vecN, but a value may infer the type. (GLSLstd450ModfStruct)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,vector_case_normalize')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
vector case, normalize:
T is f32 normalize(e: vecN<T> ) -> vecN<T> Returns a unit vector in the same direction as e. (GLSLstd450Normalize)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,pow')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
pow:
T is f32 or vecN<f32> pow(e1: T ,e2: T ) -> T Returns e1 raised to the power e2. Component-wise when T is a vector. (GLSLstd450Pow)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,quantize_to_f16')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
quantize to f16:
T is f32 or vecN<f32> quantizeToF16(e: T ) -> T Quantizes a 32-bit floating point value e as if e were converted to a IEEE 754 binary16 value, and then converted back to a IEEE 754 binary32 value. See section 12.5.2 Floating point conversion. Component-wise when T is a vector. Note: The vec2<f32> case is the same as unpack2x16float(pack2x16float(e)). (OpQuantizeToF16)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,reflect')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
reflect:
T is vecN<f32> reflect(e1: T ,e2: T ) -> T For the incident vector e1 and surface orientation e2, returns the reflection direction e1-2*dot(e2,e1)*e2. (GLSLstd450Reflect)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,refract')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
refract:
T is vecN<f32>I is f32 refract(e1: T ,e2: T ,e3: I ) -> T For the incident vector e1 and surface normal e2, and the ratio of indices of refraction e3, let k = 1.0 -e3*e3* (1.0 - dot(e2,e1) * dot(e2,e1)). If k < 0.0, returns the refraction vector 0.0, otherwise return the refraction vector e3*e1- (e3* dot(e2,e1) + sqrt(k)) *e2. (GLSLstd450Refract)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,round')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
round:
T is f32 or vecN<f32> round(e: T ) -> T Result is the integer k nearest to e, as a floating point value. When e lies halfway between integers k and k+1, the result is k when k is even, and k+1 when k is odd. Component-wise when T is a vector. (GLSLstd450RoundEven)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,float_sign')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
float sign:
T is f32 or vecN<f32> sign(e: T ) -> T Returns the sign of e. Component-wise when T is a vector. (GLSLstd450FSign)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,sinh')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
sinh:
T is f32 or vecN<f32> sinh(e: T ) -> T Returns the hyperbolic sine of e. Component-wise when T is a vector. (GLSLstd450Sinh)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,smoothStep')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
smoothStep:
T is f32 or vecN<f32> smoothStep(e1: T ,e2: T ,e3: T ) -> T Returns the smooth Hermite interpolation between 0 and 1. Component-wise when T is a vector. (GLSLstd450SmoothStep)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,sqrt')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
sqrt:
T is f32 or vecN<f32> sqrt(e: T ) -> T Returns the square root of e. Component-wise when T is a vector. (GLSLstd450Sqrt)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,step')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
step:
T is f32 or vecN<f32> step(e1: T ,e2: T ) -> T Returns 0.0 if e1 is less than e2, and 1.0 otherwise. Component-wise when T is a vector. (GLSLstd450Step)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,tan')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
tan:
T is f32 or vecN<f32> tan(e: T ) -> T Returns the tangent of e. Component-wise when T is a vector. (GLSLstd450Tan)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,tanh')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
tanh:
T is f32 or vecN<f32> tanh(e: T ) -> T Returns the hyperbolic tangent of e. Component-wise when T is a vector. (GLSLstd450Tanh)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('float_builtin_functions,trunc')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
trunc:
T is f32 or vecN<f32> trunc(e: T ) -> T Returns the nearest whole number whose absolute value is less than or equal to e. Component-wise when T is a vector. (GLSLstd450Trunc)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();
