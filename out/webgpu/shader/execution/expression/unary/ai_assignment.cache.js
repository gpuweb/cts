/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/import { abstractInt, i32, u32 } from '../../../../util/conversion.js';import { fullI32Range, fullU32Range } from '../../../../util/math.js';import { makeCaseCache } from '../case_cache.js';

export const d = makeCaseCache('unary/ai_assignment', {
  i32: () => {
    return fullI32Range().map((n) => {
      return { input: abstractInt(BigInt(n)), expected: i32(n) };
    });
  },
  u32: () => {
    return fullU32Range().map((n) => {
      return { input: abstractInt(BigInt(n)), expected: u32(n) };
    });
  }
});
//# sourceMappingURL=ai_assignment.cache.js.map