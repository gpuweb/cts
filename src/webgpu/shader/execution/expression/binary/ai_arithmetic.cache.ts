import { kValue } from '../../../../util/constants.js';
import { sparseI64Range, vectorI64Range } from '../../../../util/math.js';
import {
  generateBinaryToI64Cases,
  generateI64VectorBinaryToVectorCases,
  generateVectorI64BinaryToVectorCases,
} from '../case.js';
import { makeCaseCache } from '../case_cache.js';

function isOOB(val: bigint): boolean {
  return val > kValue.i64.positive.max || val < kValue.i64.negative.min;
}
function ai_add(x: bigint, y: bigint): bigint | undefined {
  const result = x + y;
  return !isOOB(result) ? result : undefined;
}

function ai_sub(x: bigint, y: bigint): bigint | undefined {
  const result = x - y;
  return !isOOB(result) ? result : undefined;
}

export const d = makeCaseCache('binary/ai_arithmetic', {
  addition: () => {
    return generateBinaryToI64Cases(sparseI64Range(), sparseI64Range(), ai_add);
  },
  addition_scalar_vector2: () => {
    return generateI64VectorBinaryToVectorCases(sparseI64Range(), vectorI64Range(2), ai_add);
  },
  addition_scalar_vector3: () => {
    return generateI64VectorBinaryToVectorCases(sparseI64Range(), vectorI64Range(3), ai_add);
  },
  addition_scalar_vector4: () => {
    return generateI64VectorBinaryToVectorCases(sparseI64Range(), vectorI64Range(4), ai_add);
  },
  addition_vector2_scalar: () => {
    return generateVectorI64BinaryToVectorCases(vectorI64Range(2), sparseI64Range(), ai_add);
  },
  addition_vector3_scalar: () => {
    return generateVectorI64BinaryToVectorCases(vectorI64Range(3), sparseI64Range(), ai_add);
  },
  addition_vector4_scalar: () => {
    return generateVectorI64BinaryToVectorCases(vectorI64Range(4), sparseI64Range(), ai_add);
  },
  subtraction: () => {
    return generateBinaryToI64Cases(sparseI64Range(), sparseI64Range(), ai_sub);
  },
  subtraction_scalar_vector2: () => {
    return generateI64VectorBinaryToVectorCases(sparseI64Range(), vectorI64Range(2), ai_sub);
  },
  subtraction_scalar_vector3: () => {
    return generateI64VectorBinaryToVectorCases(sparseI64Range(), vectorI64Range(3), ai_sub);
  },
  subtraction_scalar_vector4: () => {
    return generateI64VectorBinaryToVectorCases(sparseI64Range(), vectorI64Range(4), ai_sub);
  },
  subtraction_vector2_scalar: () => {
    return generateVectorI64BinaryToVectorCases(vectorI64Range(2), sparseI64Range(), ai_sub);
  },
  subtraction_vector3_scalar: () => {
    return generateVectorI64BinaryToVectorCases(vectorI64Range(3), sparseI64Range(), ai_sub);
  },
  subtraction_vector4_scalar: () => {
    return generateVectorI64BinaryToVectorCases(vectorI64Range(4), sparseI64Range(), ai_sub);
  },
});
