export const description = `WGSL Section 16 Test Plan`;

import { makeTestGroup } from '../../../common/framework/test_group.js';

import { ShaderValidationTest } from './shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('builtin_function,all')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#logical-builtin-functions
Description: vector all:
e: vecN<bool> all(e): bool Returns true if each component of e is true.
(OpAll)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,any')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#logical-builtin-functions
Description: vector any:
e: vecN<bool> any(e): bool Returns true if any component of e is true.
(OpAny)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,select')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#logical-builtin-functions
Description: scalar select:
T is a scalar select(f:T,t:T,cond: bool): T Returns t when cond is true, and f otherwise.
(OpSelect) Overload
URL:https://gpuweb.github.io/gpuweb/wgsl/#logical-builtin-functions
Description: vector select:
T is a scalar select(f: vecN<T>,t: vecN<T,cond: vecN<bool>>) Component-wise selection.
Result component i is evaluated as select(f[i],t[i],cond[i]).
(OpSelect)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,isNan')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#value-testing-builtin-functions
Description: e: T T is f32 or vecN<f32> TR is bool if T is a scalar, or vecN<bool> if T is a vector isNan(e) ->TR Test for NaN according to IEEE-754.
Component-wise when T is a vector.
(OpIsNan)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test(
  'builtin_function,Test for infinity according to IEEE-754. Component-wise when T is a vector. '
)
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#value-testing-builtin-functions
Description: isInf(e) ->TR Test for infinity according to IEEE-754.
Component-wise when T is a vector.
(OpIsInf)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,isFinite')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#value-testing-builtin-functions
Description: isFinite(e) ->TR Test a finite value according to IEEE-754.
Component-wise when T is a vector.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,isNormal')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#value-testing-builtin-functions
Description: isNormal(e) ->TR Test a normal value according to IEEE-754.
Component-wise when T is a vector.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,arrayLength')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#value-testing-builtin-functions
Description: runtime-sized array length:
e: ptr<storage,array<T>> arrayLength(e): u32 Returns the number of elements in the runtime-sized array.
(OpArrayLength, but the implementation has to trace back to get the pointer to the enclosing struct.)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,abs')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: float abs:
T is f32 or vecN<f32> abs(e: T ) -> T Returns the absolute value of e (e.g.
e with a positive sign bit).
Component-wise when T is a vector.
(GLSLstd450Fabs) Overload
URL:https://gpuweb.github.io/gpuweb/wgsl/#integer-builtin-functions
Description: signed abs:
T is i32 or vecN<i32> abs(e: T ) -> T The absolute value of e.
Component-wise when T is a vector.
If e evaluates to the largest negative value, then the result is e.
(GLSLstd450SAbs) Overload
URL:https://gpuweb.github.io/gpuweb/wgsl/#integer-builtin-functions
Description: scalar case, unsigned abs:
T is u32 or vecN<u32> abs(e: T ) -> T Result is e.
This is provided for symmetry with abs for signed integers.
Component-wise when T is a vector.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,acos')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: acos:
T is f32 or vecN<f32> acos(e: T ) -> T Returns the arc cosine of e.
Component-wise when T is a vector.
(GLSLstd450Acos)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,asin')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: asin:
T is f32 or vecN<f32> asin(e: T ) -> T Returns the arc sine of e.
Component-wise when T is a vector.
(GLSLstd450Asin)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,atan')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: atan:
T is f32 or vecN<f32> atan(e: T ) -> T Returns the arc tangent of e.
Component-wise when T is a vector.
(GLSLstd450Atan)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,atan2')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: atan2:
T is f32 or vecN<f32> atan2(e1: T ,e2: T ) -> T Returns the arc tangent of e1 over e2.
Component-wise when T is a vector.
(GLSLstd450Atan2)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,ceil')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: ceil:
T is f32 or vecN<f32> ceil(e: T ) -> T Returns the ceiling of e.
Component-wise when T is a vector.
(GLSLstd450Ceil)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,clamp')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: clamp:
T is f32 or vecN<f32> clamp(e1: T ,e2: T ,e3: T) -> T Returns min(max(e1,e2),e3).
Component-wise when T is a vector.
(GLSLstd450NClamp) Overload
URL:https://gpuweb.github.io/gpuweb/wgsl/#integer-builtin-functions
Description: unsigned clamp:
T is u32 or vecN<u32> clamp(e1: T ,e2: T,e3: T) -> T Returns min(max(e1,e2),e3).
Component-wise when T is a vector.
(GLSLstd450UClamp) Overload
URL:https://gpuweb.github.io/gpuweb/wgsl/#integer-builtin-functions
Description: signed clamp:
T is i32 or vecN<i32> clamp(e1: T ,e2: T,e3: T) -> T Returns min(max(e1,e2),e3).
Component-wise when T is a vector.
(GLSLstd450SClamp)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,cos')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: cos:
T is f32 or vecN<f32> cos(e: T ) -> T Returns the cosine of e.
Component-wise when T is a vector.
(GLSLstd450Cos)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,cosh')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: cosh:
T is f32 or vecN<f32> cosh(e: T ) -> T Returns the hyperbolic cosine of e.
Component-wise when T is a vector (GLSLstd450Cosh)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,cross')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: vector case, cross:
T is f32 cross(e1: vec3<T> ,e2: vec3<T>) -> vec3<T> Returns the cross product of e1 and e2.
(GLSLstd450Cross)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,distance')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: distance:
T is f32 or vecN<f32> distance(e1: T ,e2: T ) -> f32 Returns the distance between e1 and e2 (e.g.
length(e1-e2)).
(GLSLstd450Distance)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,exp')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: exp:
T is f32 or vecN<f32> exp(e1: T ) -> T Returns the natural exponentiation of e1 (e.g.
ee1).
Component-wise when T is a vector.
(GLSLstd450Exp)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,exp2')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: exp2:
T is f32 or vecN<f32> exp2(e: T ) -> T Returns 2 raised to the power e (e.g.
2e).
Component-wise when T is a vector.
(GLSLstd450Exp2)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,faceForward')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: faceForward:
T is vecN<f32> faceForward(e1: T ,e2: T ,e3: T ) -> T Returns e1 if dot(e2,e3) is negative, and -e1 otherwise.
(GLSLstd450FaceForward)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,floor')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: floor:
T is f32 or vecN<f32> floor(e: T ) -> T Returns the floor of e.
Component-wise when T is a vector.
(GLSLstd450Floor)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,fma')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: fma:
T is f32 fma(e1: T ,e2: T ,e3: T ) -> T Returns e1 * e2 + e3.
Component-wise when T is a vector.
(GLSLstd450Fma)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,fract')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: fract:
T is f32 or vecN<f32> fract(e: T ) -> T Returns the fractional bits of e (e.g.
e - floor(e)).
Component-wise when T is a vector.
(GLSLstd450Fract)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,frexp')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: scalar case, frexp:
T is f32 frexp(e:T) -> _frexp_result Splits e into a significand and exponent of the form significand * 2exponent.
Returns the _frexp_result built-in structure, defined as: struct _frexp_result { sig : f32; // significand part exp : i32; // exponent part
}; The magnitude of the significand is in the range of [0.5, 1.0) or 0.
Note: A value cannot be explicitly declared with the type _frexp_result, but a value may infer the type.
(GLSLstd450FrexpStruct) Overload
URL:https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: vector case, frexp:
T is vecN<f32> frexp(e:T) -> _frexp_result_vecN Splits the components of e into a significand and exponent of the form significand * 2exponent.
Returns the _frexp_result_vecN built-in structure, defined as: struct _frexp_result_vecN { sig : vecN<f32>; // significand part exp : vecN<i32>; // exponent part
}; The magnitude of each component of the significand is in the range of [0.5, 1.0) or 0.
Note: A value cannot be explicitly declared with the type _frexp_result_vecN, but a value may infer the type.
(GLSLstd450FrexpStruct)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,inverseSqrt')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: inverseSqrt:
T is f32 or vecN<f32> inverseSqrt(e: T ) -> T Returns the reciprocal of sqrt(e).
Component-wise when T is a vector.
(GLSLstd450InverseSqrt)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,ldexp')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: ldexp:
T is f32 or vecN<f32> I is i32 or vecN<i32>, where I is a scalar if T is a scalar, or a vector when T is a vector ldexp(e1: T ,e2: I ) -> T Returns e1 * 2e2.
Component-wise when T is a vector.
(GLSLstd450Ldexp)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,length')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: length:
T is f32 or vecN<f32> length(e: T ) -> f32 Returns the length of e (e.g.
abs(e) if T is a scalar, or sqrt(e[0]2 + e[1]2 + ...) if T is a vector).
(GLSLstd450Length)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,log')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: log:
T is f32 or vecN<f32> log(e: T ) -> T Returns the natural logaritm of e.
Component-wise when T is a vector.
(GLSLstd450Log)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,log2')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: log2:
T is f32 or vecN<f32> log2(e: T ) -> T Returns the base-2 logarithm of e.
Component-wise when T is a vector.
(GLSLstd450Log2)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,max')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: max:
T is f32 or vecN<f32> max(e1: T ,e2: T ) -> T Returns e2 if e1 is less than e2, and e1 otherwise.
If one operand is a NaN, the other is returned.
If both operands are NaNs, a NaN is returned.
Component-wise when T is a vector.
(GLSLstd450NMax) Overload
URL:https://gpuweb.github.io/gpuweb/wgsl/#integer-builtin-functions
Description: unsigned max:
T is u32 or vecN<u32> max(e1: T ,e2: T) -> T Returns e2 if e1 is less than e2, and e1 otherwise.
Component-wise when T is a vector.
(GLSLstd450UMax) Overload
URL:https://gpuweb.github.io/gpuweb/wgsl/#integer-builtin-functions
Description: signed max:
T is i32 or vecN<i32> max(e1: T ,e2: T) -> T Returns e2 if e1 is less than e2, and e1 otherwise.
Component-wise when T is a vector.
(GLSLstd450SMax)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,min')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: min:
T is f32 or vecN<f32> min(e1: T ,e2: T ) -> T Returns e2 if e2 is less than e1, and e1 otherwise.
If one operand is a NaN, the other is returned.
If both operands are NaNs, a NaN is returned.
Component-wise when T is a vector.
(GLSLstd450NMin) Overload
URL:https://gpuweb.github.io/gpuweb/wgsl/#integer-builtin-functions
Description: unsigned min:
T is u32 or vecN<u32> min(e1: T ,e2: T) -> T Returns e1 if e1 is less than e2, and e2 otherwise.
Component-wise when T is a vector.
(GLSLstd450UMin) Overload
URL:https://gpuweb.github.io/gpuweb/wgsl/#integer-builtin-functions
Description: signed min:
T is i32 or vecN<i32> min(e1: T ,e2: T) -> T Returns e1 if e1 is less than e2, and e2 otherwise.
Component-wise when T is a vector.
(GLSLstd45SUMin)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,mix')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: mix:
T is f32 or vecN<f32> U is T or f32 mix(e1: T ,e2: T ,e3: U) -> T Returns the linear blend of e1 and e2 (e.g.
e1*(1-e3)+e2*e3).
Component-wise when T is a vector.
(GLSLstd450FMix)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,modf')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: scalar case, modf:
T is f32 modf(e:T) -> _modf_result Splits e into fractional and whole number parts.
Returns the _modf_result built-in structure, defined as: struct _modf_result { fract : f32; // fractional part whole : f32; // whole part
}; Note: A value cannot be explicitly declared with the type _modf_result, but a value may infer the type.
(GLSLstd450ModfStruct) Overload
URL:https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: vector case, modf:
T is vecN<f32> modf(e:T) -> _modf_result_vecN Splits the components of e into fractional and whole number parts.
Returns the _modf_result_vecN built-in structure, defined as: struct _modf_result_vecN { fract : vecN<f32>; // fractional part whole : vecN<f32>; // whole part
}; Note: A value cannot be explicitly declared with the type _modf_result_vecN, but a value may infer the type.
(GLSLstd450ModfStruct)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,normalize')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: vector case, normalize:
T is f32 normalize(e: vecN<T> ) -> vecN<T> Returns a unit vector in the same direction as e.
(GLSLstd450Normalize)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,pow')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: pow:
T is f32 or vecN<f32> pow(e1: T ,e2: T ) -> T Returns e1 raised to the power e2.
Component-wise when T is a vector.
(GLSLstd450Pow)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,quantizeToF16')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: quantize to f16:
T is f32 or vecN<f32> quantizeToF16(e: T ) -> T Quantizes a 32-bit floating point value e as if e were converted to a IEEE 754 binary16 value, and then converted back to a IEEE 754 binary32 value.
See section 12.5.2 Floating point conversion.
Component-wise when T is a vector.
Note: The vec2<f32> case is the same as unpack2x16float(pack2x16float(e)).
(OpQuantizeToF16)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,reflect')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: reflect:
T is vecN<f32> reflect(e1: T ,e2: T ) -> T For the incident vector e1 and surface orientation e2, returns the reflection direction e1-2*dot(e2,e1)*e2.
(GLSLstd450Reflect)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,refract')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: refract:
T is vecN<f32>I is f32 refract(e1: T ,e2: T ,e3: I ) -> T For the incident vector e1 and surface normal e2, and the ratio of indices of refraction e3, let k = 1.0 -e3*e3* (1.0 - dot(e2,e1) * dot(e2,e1)).
If k < 0.0, returns the refraction vector 0.0, otherwise return the refraction vector e3*e1- (e3* dot(e2,e1) + sqrt(k)) *e2.
(GLSLstd450Refract)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,round')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: round:
T is f32 or vecN<f32> round(e: T ) -> T Result is the integer k nearest to e, as a floating point value.
When e lies halfway between integers k and k+1, the result is k when k is even, and k+1 when k is odd.
Component-wise when T is a vector.
(GLSLstd450RoundEven)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,sign')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: float sign:
T is f32 or vecN<f32> sign(e: T ) -> T Returns the sign of e.
Component-wise when T is a vector.
(GLSLstd450FSign)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,sin')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: sin:
T is f32 or vecN<f32> sin(e: T ) -> T Returns the sine of e.
Component-wise when T is a vector.
(GLSLstd450Sin)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,sinh')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: sinh:
T is f32 or vecN<f32> sinh(e: T ) -> T Returns the hyperbolic sine of e.
Component-wise when T is a vector.
(GLSLstd450Sinh)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,smoothStep')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: smoothStep:
T is f32 or vecN<f32> smoothStep(e1: T ,e2: T ,e3: T ) -> T Returns the smooth Hermite interpolation between 0 and 1.
Component-wise when T is a vector.
(GLSLstd450SmoothStep)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,sqrt')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: sqrt:
T is f32 or vecN<f32> sqrt(e: T ) -> T Returns the square root of e.
Component-wise when T is a vector.
(GLSLstd450Sqrt)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,step')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: step:
T is f32 or vecN<f32> step(e1: T ,e2: T ) -> T Returns 0.0 if e1 is less than e2, and 1.0 otherwise.
Component-wise when T is a vector.
(GLSLstd450Step)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,tan')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: tan:
T is f32 or vecN<f32> tan(e: T ) -> T Returns the tangent of e.
Component-wise when T is a vector.
(GLSLstd450Tan)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,tanh')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: tanh:
T is f32 or vecN<f32> tanh(e: T ) -> T Returns the hyperbolic tangent of e.
Component-wise when T is a vector.
(GLSLstd450Tanh)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,trunc')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#float-builtin-functions
Description: trunc:
T is f32 or vecN<f32> trunc(e: T ) -> T Returns the nearest whole number whose absolute value is less than or equal to e.
Component-wise when T is a vector.
(GLSLstd450Trunc)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,countOneBits')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#integer-builtin-functions
Description: count 1 bits:
T is i32, u32, vecN<i32>, or vecN<u32> countOneBits(e: T ) -> T The number of 1 bits in the representation of e.
Also known as "population count".
Component-wise when T is a vector.
(SPIR-V OpBitCount)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,reverseBits')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#integer-builtin-functions
Description: bit reversal:
T is i32, u32, vecN<i32>, or vecN<u32> reverseBits(e: T ) -> T Reverses the bits in e: The bit at position k of the result equals the bit at position 31-k of e.
Component-wise when T is a vector.
(SPIR-V OpBitReverse)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,determinant')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#matrix-builtin-functions
Description: determinant:
T is f32 determinant(e: matNxN<T> ) -> T Returns the determinant of e.
(GLSLstd450Determinant)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,transpose')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#matrix-builtin-functions
Description: transpose:
T is f32 transpose(e: matMxN<T> ) -> matNxM<T> Returns the transpose of e.
(OpTranspose)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,dot')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#vector-builtin-functions
Description: dot:
T is f32 dot(e1: vecN<T>,e2: vecN<T>) -> T Returns the dot product of e1 and e2.
(OpDot)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('derivative_builtin_functions,section_16_7_rule_0')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#derivative-builtin-functions
Description: Must only be used in a fragment shader stage.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('derivative_builtin_functions,section_16_7_rule_1')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#derivative-builtin-functions
Description: Must only be invoked in uniform control flow.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test(
  'builtin_function,the partial derivative of e with respect to window x coordinates using local differences. This may result in fewer unique positions that dpdxFine(e). '
)
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#derivative-builtin-functions
Description: Returns the partial derivative of e with respect to window x coordinates using local differences.
This may result in fewer unique positions that dpdxFine(e).
(OpDPdxCoarse)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test(
  'builtin_function,the partial derivative of e with respect to window y coordinates using local differences. This may result in fewer unique positions that dpdyFine(e). '
)
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#derivative-builtin-functions
Description: Returns the partial derivative of e with respect to window y coordinates using local differences.
This may result in fewer unique positions that dpdyFine(e).
(OpDPdyCoarse)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('texture_builtin_functions,section_16_8_rule_0')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#texture-builtin-functions
Description: Parameter values must be valid for the respective texture types.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('texturedimensions,section_16_8_1_rule_0')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#texturedimensions
Description: If level is outside the range [0, textureNumLevels(t)) then any valid value for the return type may be returned.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('texturesample,section_16_8_6_rule_0')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#texturesample
Description: Must only be used in a fragment shader stage.
Must only be invoked in uniform control flow.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('texturesample,section_16_8_6_rule_1')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#texturesample
Description: The optional texel offset applied to the unnormalized texture coordinate before sampling the texture.
This offset is applied before applying any texture wrapping modes.
The offset expression must be a const_expression expression (e.g.
vec2<i32>(1, 2)).
Each offset component must be at least -8 and at most 7.
Values outside of this range will result in a shader-creation error.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('texturesamplebias,section_16_8_7_rule_0')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#texturesamplebias
Description: Must only be used in a fragment shader stage.
Must only be invoked in uniform control flow.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('texturesamplebias,section_16_8_7_rule_1')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#texturesamplebias
Description: The bias to apply to the mip level before sampling.
bias must be between -16.0 and 15.99.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('texturesamplebias,section_16_8_7_rule_2')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#texturesamplebias
Description: The optional texel offset applied to the unnormalized texture coordinate before sampling the texture.
This offset is applied before applying any texture wrapping modes.
The offset expression must be a const_expression expression (e.g.
vec2<i32>(1, 2)).
Each offset component must be at least -8 and at most 7.
Values outside of this range will result in a shader-creation error.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('texturesamplecompare,section_16_8_8_rule_0')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#texturesamplecompare
Description: Must only be used in a fragment shader stage.
Must only be invoked in uniform control flow.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('texturesamplecompare,section_16_8_8_rule_1')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#texturesamplecompare
Description: The optional texel offset applied to the unnormalized texture coordinate before sampling the texture.
This offset is applied before applying any texture wrapping modes.
The offset expression must be a const_expression expression (e.g.
vec2<i32>(1, 2)).
Each offset component must be at least -8 and at most 7.
Values outside of this range will result in a shader-creation error.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('texturesamplecomparelevel,section_16_8_9_rule_0')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#texturesamplecomparelevel
Description: textureSampleCompareLevel may be invoked in any shader stage.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('texturesamplegrad,section_16_8_10_rule_0')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#texturesamplegrad
Description: The optional texel offset applied to the unnormalized texture coordinate before sampling the texture.
This offset is applied before applying any texture wrapping modes.
The offset expression must be a const_expression expression (e.g.
vec2<i32>(1, 2)).
Each offset component must be at least -8 and at most 7.
Values outside of this range will result in a shader-creation error.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('texturesamplelevel,section_16_8_11_rule_0')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#texturesamplelevel
Description: The mip level, with level 0 containing a full size version of the texture.
For the functions where level is a f32, fractional values may interpolate between two levels if the format is filterable according to the Texture Format Capabilities.
When not specified, mip level 0 is sampled.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('texturesamplelevel,section_16_8_11_rule_1')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#texturesamplelevel
Description: The optional texel offset applied to the unnormalized texture coordinate before sampling the texture.
This offset is applied before applying any texture wrapping modes.
The offset expression must be a const_expression expression (e.g.
vec2<i32>(1, 2)).
Each offset component must be at least -8 and at most 7.
Values outside of this range will result in a shader-creation error.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('texturestore,section_16_8_12_rule_0')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#texturestore
Description: If an out-of-bounds access occurs, the built-in function may do any of the following:
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('atomic_builtin_functions,section_16_9_rule_0')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#atomic-builtin-functions
Description: The access mode A in all atomic built-in functions must be read_write.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('atomic_rmw,section_16_9_3_rule_0')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#atomic-rmw
Description: Note: the equality comparison may spuriously fail on some implementations.
That is, the second element of the result vector may be 0 even if the first element of the result vector equals cmp.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,pack4x8snorm')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#pack-builtin-functions
Description: packing 4x8snorm:
pack4x8snorm(e: vec4<f32>) -> u32 Converts four normalized floating point values to 8-bit signed integers, and then combines them into one u32 value.
Component e[i] of the input is converted to an 8-bit twos complement integer value ⌊ 0.5 + 127 × min(1, max(-1, e[i])) ⌋ which is then placed in bits 8 × i through 8 × i + 7 of the result.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,pack4x8unorm')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#pack-builtin-functions
Description: packing 4x8unorm:
pack4x8unorm(e: vec4<f32>) -> u32 Converts four normalized floating point values to 8-bit unsigned integers, and then combines them into one u32 value.
Component e[i] of the input is converted to an 8-bit unsigned integer value ⌊ 0.5 + 255 × min(1, max(0, e[i])) ⌋ which is then placed in bits 8 × i through 8 × i + 7 of the result.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,pack2x16snorm')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#pack-builtin-functions
Description: packing 2x16snorm:
pack2x16snorm(e: vec2<f32>) -> u32 Converts two normalized floating point values to 16-bit signed integers, and then combines them into one u32 value.
Component e[i] of the input is converted to a 16-bit twos complement integer value ⌊ 0.5 + 32767 × min(1, max(-1, e[i])) ⌋ which is then placed in bits 16 × i through 16 × i + 15 of the result.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,pack2x16unorm')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#pack-builtin-functions
Description: packing 2x16unorm:
pack2x16unorm(e: vec2<f32>) -> u32 Converts two normalized floating point values to 16-bit unsigned integers, and then combines them into one u32 value.
Component e[i] of the input is converted to a 16-bit unsigned integer value ⌊ 0.5 + 65535 × min(1, max(0, e[i])) ⌋ which is then placed in bits 16 × i through 16 × i + 15 of the result.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,pack2x16float')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#pack-builtin-functions
Description: packing 2x16float:
pack2x16float(e: vec2<f32>) -> u32 Converts two floating point values to half-precision floating point numbers, and then combines them into one one u32 value.
Component e[i] of the input is converted to a IEEE-754 binary16 value, which is then placed in bits 16 × i through 16 × i + 15 of the result.
See section 12.5.2 Floating point conversion.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,unpack4x8snorm')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#unpack-builtin-functions
Description: unpacking 4x8snorm:
unpack4x8snorm(e: u32) -> vec4<f32> Decomposes a 32-bit value into four 8-bit chunks, then reinterprets each chunk as a signed normalized floating point value.
Component i of the result is max(v ÷ 127, -1), where v is the interpretation of bits 8×i through 8×i+7 of e as a twos-complement signed integer.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,unpack4x8unorm')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#unpack-builtin-functions
Description: unpacking 4x8unorm:
unpack4x8unorm(e: u32) -> vec4<f32> Decomposes a 32-bit value into four 8-bit chunks, then reinterprets each chunk as an unsigned normalized floating point value.
Component i of the result is v ÷ 255, where v is the interpretation of bits 8×i through 8×i+7 of e as an unsigned integer.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,unpack2x16snorm')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#unpack-builtin-functions
Description: unpacking 2x16snorm:
unpack2x16snorm(e: u32) -> vec2<f32> Decomposes a 32-bit value into two 16-bit chunks, then reinterprets each chunk as a signed normalized floating point value.
Component i of the result is max(v ÷ 32767, -1), where v is the interpretation of bits 16×i through 16×i+15 of e as a twos-complement signed integer.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,unpack2x16unorm')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#unpack-builtin-functions
Description: unpacking 2x16unorm:
unpack2x16unorm(e: u32) -> vec2<f32> Decomposes a 32-bit value into two 16-bit chunks, then reinterprets each chunk as an unsigned normalized floating point value.
Component i of the result is v ÷ 65535, where v is the interpretation of bits 16×i through 16×i+15 of e as an unsigned integer.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('builtin_function,unpack2x16float')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#unpack-builtin-functions
Description: unpacking 2x16float:
unpack2x16float(e: u32) -> vec2<f32> Decomposes a 32-bit value into two 16-bit chunks, and reinterpets each chunk as a floating point value.
Component i of the result is the f32 representation of v, where v is the interpretation of bits 16×i through 16×i+15 of e as an IEEE-754 binary16 value.
See section 12.5.2 Floating point conversion.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test(
  'builtin_function,synchronization functions execute a control barrier with Acquire/Release memory ordering. That is, all synchronization functions, and affected memory and atomic operations are ordered in § 12.1.2 Program order '
)
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#sync-builtin-functions
Description: All synchronization functions execute a control barrier with Acquire/Release memory ordering.
That is, all synchronization functions, and affected memory and atomic operations are ordered in section 12.1.2 Program order (within an invocation) TODO relative to the synchronization function.
Additionally, the affected memory and atomic operations program-ordered before the synchronization function must be visible to all other threads in the workgroup before any affected memory or atomic operation program-ordered after the synchronization function is executed by a member of the workgroup.
All synchronization functions must only be used in the compute shader stage.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('value_steering_functions,section_16_13_rule_0')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#value-steering-functions
Description: compute a value then ignore it:
ignore(e: T) Evaluates e, and then ignores the result.
Type T is any type that is valid as a function parameter.
Note: An argument to ignore() cannot have an atomic or runtime-sized array type, but pointers to these types can be used.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('w3c_conventions,section_16_13_rule_1')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#w3c-conventions
Description: Conformance requirements are expressed with a combination of descriptive assertions and RFC 2119 terminology.
The key words “MUST”, “MUST NOT”, “REQUIRED”, “SHALL”, “SHALL NOT”, “SHOULD”, “SHOULD NOT”, “RECOMMENDED”, “MAY”, and “OPTIONAL” in the normative parts of this document are to be interpreted as described in RFC 2119.
However, for readability, these words do not appear in all uppercase letters in this specification.
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('issues_index,section_16_13_rule_2')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#issues-index
Description: The WebGPU pipeline creation API must specify how API-supplied values are mapped to shader scalar values.
For booleans, I suggest using a 32-bit integer, where only 0 maps to false.
If WGSL gains non-32-bit numeric scalars, I recommend overridable constants continue being 32-bit numeric types.
↵
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();

g.test('issues_index,section_16_13_rule_3')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#issues-index
Description: WebGPU issue 1045: Dispatch group counts must be positive.
However, how do we handle an indirect dispatch that specifies a group count of zero.
↵
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();
