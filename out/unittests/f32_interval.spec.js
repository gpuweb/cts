/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/ // This is a shim file that performs testing via the old/deprecates f32 API
// calls.
// Those currently just pass-through to the new refactored FPContext
// implementation.
// As CTS migrates over to directly calling the new API these test will be
// replaced with direct call tests.
export const description = `
F32 unit tests.
`;
import { makeTestGroup } from '../common/framework/test_group.js';
import { objectEquals } from '../common/util/util.js';
import { kValue } from '../webgpu/util/constants.js';
import {
toF32Interval,
toF32Matrix,
toF32Vector,
isF32Vector,
isF32Matrix,
spanF32Intervals } from
'../webgpu/util/f32_interval.js';
import { FPInterval } from '../webgpu/util/floating_point.js';
import { map2DArray } from '../webgpu/util/math.js';

import { UnitTest } from './unit_test.js';

export const g = makeTestGroup(UnitTest);

/** Bounds indicating an expectation of an interval of all possible values */
const kAnyBounds = [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];

/** Interval from kAnyBounds */
const kAnyInterval = toF32Interval(kAnyBounds);






g.test('constructor').
paramsSubcasesOnly(

[
// Common cases
{ input: [0, 10], expected: [0, 10] },
{ input: [-5, 0], expected: [-5, 0] },
{ input: [-5, 10], expected: [-5, 10] },
{ input: [0], expected: [0] },
{ input: [10], expected: [10] },
{ input: [-5], expected: [-5] },

// Edges
{ input: [0, kValue.f32.positive.max], expected: [0, kValue.f32.positive.max] },
{ input: [kValue.f32.negative.min, 0], expected: [kValue.f32.negative.min, 0] },
{ input: [kValue.f32.negative.min, kValue.f32.positive.max], expected: [kValue.f32.negative.min, kValue.f32.positive.max] },

// Out of range
{ input: [0, 2 * kValue.f32.positive.max], expected: [0, 2 * kValue.f32.positive.max] },
{ input: [2 * kValue.f32.negative.min, 0], expected: [2 * kValue.f32.negative.min, 0] },
{ input: [2 * kValue.f32.negative.min, 2 * kValue.f32.positive.max], expected: [2 * kValue.f32.negative.min, 2 * kValue.f32.positive.max] },

// Infinities
{ input: [0, kValue.f32.infinity.positive], expected: [0, Number.POSITIVE_INFINITY] },
{ input: [kValue.f32.infinity.negative, 0], expected: [Number.NEGATIVE_INFINITY, 0] },
{ input: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], expected: kAnyBounds }]).


fn((t) => {
  const i = new FPInterval('f32', ...t.params.input);
  t.expect(
  objectEquals(i.bounds(), t.params.expected),
  `FPInterval([${t.params.input}]) returned ${i}. Expected [${t.params.expected}]`);

});







g.test('contains_number').
paramsSubcasesOnly(

[
// Common usage
{ bounds: [0, 10], value: 0, expected: true },
{ bounds: [0, 10], value: 10, expected: true },
{ bounds: [0, 10], value: 5, expected: true },
{ bounds: [0, 10], value: -5, expected: false },
{ bounds: [0, 10], value: 50, expected: false },
{ bounds: [0, 10], value: Number.NaN, expected: false },
{ bounds: [-5, 10], value: 0, expected: true },
{ bounds: [-5, 10], value: 10, expected: true },
{ bounds: [-5, 10], value: 5, expected: true },
{ bounds: [-5, 10], value: -5, expected: true },
{ bounds: [-5, 10], value: -6, expected: false },
{ bounds: [-5, 10], value: 50, expected: false },
{ bounds: [-5, 10], value: -10, expected: false },

// Point
{ bounds: 0, value: 0, expected: true },
{ bounds: 0, value: 10, expected: false },
{ bounds: 0, value: -1000, expected: false },
{ bounds: 10, value: 10, expected: true },
{ bounds: 10, value: 0, expected: false },
{ bounds: 10, value: -10, expected: false },
{ bounds: 10, value: 11, expected: false },

// Upper infinity
{ bounds: [0, kValue.f32.infinity.positive], value: kValue.f32.positive.min, expected: true },
{ bounds: [0, kValue.f32.infinity.positive], value: kValue.f32.positive.max, expected: true },
{ bounds: [0, kValue.f32.infinity.positive], value: kValue.f32.infinity.positive, expected: true },
{ bounds: [0, kValue.f32.infinity.positive], value: kValue.f32.negative.min, expected: false },
{ bounds: [0, kValue.f32.infinity.positive], value: kValue.f32.negative.max, expected: false },
{ bounds: [0, kValue.f32.infinity.positive], value: kValue.f32.infinity.negative, expected: false },

// Lower infinity
{ bounds: [kValue.f32.infinity.negative, 0], value: kValue.f32.positive.min, expected: false },
{ bounds: [kValue.f32.infinity.negative, 0], value: kValue.f32.positive.max, expected: false },
{ bounds: [kValue.f32.infinity.negative, 0], value: kValue.f32.infinity.positive, expected: false },
{ bounds: [kValue.f32.infinity.negative, 0], value: kValue.f32.negative.min, expected: true },
{ bounds: [kValue.f32.infinity.negative, 0], value: kValue.f32.negative.max, expected: true },
{ bounds: [kValue.f32.infinity.negative, 0], value: kValue.f32.infinity.negative, expected: true },

// Full infinity
{ bounds: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], value: kValue.f32.positive.min, expected: true },
{ bounds: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], value: kValue.f32.positive.max, expected: true },
{ bounds: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], value: kValue.f32.infinity.positive, expected: true },
{ bounds: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], value: kValue.f32.negative.min, expected: true },
{ bounds: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], value: kValue.f32.negative.max, expected: true },
{ bounds: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], value: kValue.f32.infinity.negative, expected: true },
{ bounds: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], value: Number.NaN, expected: true },

// Maximum f32 boundary
{ bounds: [0, kValue.f32.positive.max], value: kValue.f32.positive.min, expected: true },
{ bounds: [0, kValue.f32.positive.max], value: kValue.f32.positive.max, expected: true },
{ bounds: [0, kValue.f32.positive.max], value: kValue.f32.infinity.positive, expected: false },
{ bounds: [0, kValue.f32.positive.max], value: kValue.f32.negative.min, expected: false },
{ bounds: [0, kValue.f32.positive.max], value: kValue.f32.negative.max, expected: false },
{ bounds: [0, kValue.f32.positive.max], value: kValue.f32.infinity.negative, expected: false },

// Minimum f32 boundary
{ bounds: [kValue.f32.negative.min, 0], value: kValue.f32.positive.min, expected: false },
{ bounds: [kValue.f32.negative.min, 0], value: kValue.f32.positive.max, expected: false },
{ bounds: [kValue.f32.negative.min, 0], value: kValue.f32.infinity.positive, expected: false },
{ bounds: [kValue.f32.negative.min, 0], value: kValue.f32.negative.min, expected: true },
{ bounds: [kValue.f32.negative.min, 0], value: kValue.f32.negative.max, expected: true },
{ bounds: [kValue.f32.negative.min, 0], value: kValue.f32.infinity.negative, expected: false },

// Out of range high
{ bounds: [0, 2 * kValue.f32.positive.max], value: kValue.f32.positive.min, expected: true },
{ bounds: [0, 2 * kValue.f32.positive.max], value: kValue.f32.positive.max, expected: true },
{ bounds: [0, 2 * kValue.f32.positive.max], value: kValue.f32.infinity.positive, expected: false },
{ bounds: [0, 2 * kValue.f32.positive.max], value: kValue.f32.negative.min, expected: false },
{ bounds: [0, 2 * kValue.f32.positive.max], value: kValue.f32.negative.max, expected: false },
{ bounds: [0, 2 * kValue.f32.positive.max], value: kValue.f32.infinity.negative, expected: false },

// Out of range low
{ bounds: [2 * kValue.f32.negative.min, 0], value: kValue.f32.positive.min, expected: false },
{ bounds: [2 * kValue.f32.negative.min, 0], value: kValue.f32.positive.max, expected: false },
{ bounds: [2 * kValue.f32.negative.min, 0], value: kValue.f32.infinity.positive, expected: false },
{ bounds: [2 * kValue.f32.negative.min, 0], value: kValue.f32.negative.min, expected: true },
{ bounds: [2 * kValue.f32.negative.min, 0], value: kValue.f32.negative.max, expected: true },
{ bounds: [2 * kValue.f32.negative.min, 0], value: kValue.f32.infinity.negative, expected: false },

// Subnormals
{ bounds: [0, kValue.f32.positive.min], value: kValue.f32.subnormal.positive.min, expected: true },
{ bounds: [0, kValue.f32.positive.min], value: kValue.f32.subnormal.positive.max, expected: true },
{ bounds: [0, kValue.f32.positive.min], value: kValue.f32.subnormal.negative.min, expected: false },
{ bounds: [0, kValue.f32.positive.min], value: kValue.f32.subnormal.negative.max, expected: false },
{ bounds: [kValue.f32.negative.max, 0], value: kValue.f32.subnormal.positive.min, expected: false },
{ bounds: [kValue.f32.negative.max, 0], value: kValue.f32.subnormal.positive.max, expected: false },
{ bounds: [kValue.f32.negative.max, 0], value: kValue.f32.subnormal.negative.min, expected: true },
{ bounds: [kValue.f32.negative.max, 0], value: kValue.f32.subnormal.negative.max, expected: true },
{ bounds: [0, kValue.f32.subnormal.positive.min], value: kValue.f32.subnormal.positive.min, expected: true },
{ bounds: [0, kValue.f32.subnormal.positive.min], value: kValue.f32.subnormal.positive.max, expected: false },
{ bounds: [0, kValue.f32.subnormal.positive.min], value: kValue.f32.subnormal.negative.min, expected: false },
{ bounds: [0, kValue.f32.subnormal.positive.min], value: kValue.f32.subnormal.negative.max, expected: false },
{ bounds: [kValue.f32.subnormal.negative.max, 0], value: kValue.f32.subnormal.positive.min, expected: false },
{ bounds: [kValue.f32.subnormal.negative.max, 0], value: kValue.f32.subnormal.positive.max, expected: false },
{ bounds: [kValue.f32.subnormal.negative.max, 0], value: kValue.f32.subnormal.negative.min, expected: false },
{ bounds: [kValue.f32.subnormal.negative.max, 0], value: kValue.f32.subnormal.negative.max, expected: true }]).


fn((t) => {
  const i = toF32Interval(t.params.bounds);
  const value = t.params.value;
  const expected = t.params.expected;

  const got = i.contains(value);
  t.expect(expected === got, `${i}.contains(${value}) returned ${got}. Expected ${expected}`);
});







g.test('contains_interval').
paramsSubcasesOnly(

[
// Common usage
{ lhs: [-10, 10], rhs: 0, expected: true },
{ lhs: [-10, 10], rhs: [-1, 0], expected: true },
{ lhs: [-10, 10], rhs: [0, 2], expected: true },
{ lhs: [-10, 10], rhs: [-1, 2], expected: true },
{ lhs: [-10, 10], rhs: [0, 10], expected: true },
{ lhs: [-10, 10], rhs: [-10, 2], expected: true },
{ lhs: [-10, 10], rhs: [-10, 10], expected: true },
{ lhs: [-10, 10], rhs: [-100, 10], expected: false },

// Upper infinity
{ lhs: [0, kValue.f32.infinity.positive], rhs: 0, expected: true },
{ lhs: [0, kValue.f32.infinity.positive], rhs: [-1, 0], expected: false },
{ lhs: [0, kValue.f32.infinity.positive], rhs: [0, 1], expected: true },
{ lhs: [0, kValue.f32.infinity.positive], rhs: [0, kValue.f32.positive.max], expected: true },
{ lhs: [0, kValue.f32.infinity.positive], rhs: [0, kValue.f32.infinity.positive], expected: true },
{ lhs: [0, kValue.f32.infinity.positive], rhs: [100, kValue.f32.infinity.positive], expected: true },
{ lhs: [0, kValue.f32.infinity.positive], rhs: [Number.NEGATIVE_INFINITY, kValue.f32.infinity.positive], expected: false },

// Lower infinity
{ lhs: [kValue.f32.infinity.negative, 0], rhs: 0, expected: true },
{ lhs: [kValue.f32.infinity.negative, 0], rhs: [-1, 0], expected: true },
{ lhs: [kValue.f32.infinity.negative, 0], rhs: [kValue.f32.negative.min, 0], expected: true },
{ lhs: [kValue.f32.infinity.negative, 0], rhs: [0, 1], expected: false },
{ lhs: [kValue.f32.infinity.negative, 0], rhs: [kValue.f32.infinity.negative, 0], expected: true },
{ lhs: [kValue.f32.infinity.negative, 0], rhs: [kValue.f32.infinity.negative, -100], expected: true },
{ lhs: [kValue.f32.infinity.negative, 0], rhs: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], expected: false },

// Full infinity
{ lhs: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], rhs: 0, expected: true },
{ lhs: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], rhs: [-1, 0], expected: true },
{ lhs: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], rhs: [0, 1], expected: true },
{ lhs: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], rhs: [0, kValue.f32.infinity.positive], expected: true },
{ lhs: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], rhs: [100, kValue.f32.infinity.positive], expected: true },
{ lhs: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], rhs: [kValue.f32.infinity.negative, 0], expected: true },
{ lhs: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], rhs: [kValue.f32.infinity.negative, -100], expected: true },
{ lhs: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], rhs: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], expected: true },

// Maximum f32 boundary
{ lhs: [0, kValue.f32.positive.max], rhs: 0, expected: true },
{ lhs: [0, kValue.f32.positive.max], rhs: [-1, 0], expected: false },
{ lhs: [0, kValue.f32.positive.max], rhs: [0, 1], expected: true },
{ lhs: [0, kValue.f32.positive.max], rhs: [0, kValue.f32.positive.max], expected: true },
{ lhs: [0, kValue.f32.positive.max], rhs: [0, kValue.f32.infinity.positive], expected: false },
{ lhs: [0, kValue.f32.positive.max], rhs: [100, kValue.f32.infinity.positive], expected: false },
{ lhs: [0, kValue.f32.positive.max], rhs: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], expected: false },

// Minimum f32 boundary
{ lhs: [kValue.f32.negative.min, 0], rhs: [0, 0], expected: true },
{ lhs: [kValue.f32.negative.min, 0], rhs: [-1, 0], expected: true },
{ lhs: [kValue.f32.negative.min, 0], rhs: [kValue.f32.negative.min, 0], expected: true },
{ lhs: [kValue.f32.negative.min, 0], rhs: [0, 1], expected: false },
{ lhs: [kValue.f32.negative.min, 0], rhs: [kValue.f32.infinity.negative, 0], expected: false },
{ lhs: [kValue.f32.negative.min, 0], rhs: [kValue.f32.infinity.negative, -100], expected: false },
{ lhs: [kValue.f32.negative.min, 0], rhs: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], expected: false },

// Out of range high
{ lhs: [0, 2 * kValue.f32.positive.max], rhs: 0, expected: true },
{ lhs: [0, 2 * kValue.f32.positive.max], rhs: [-1, 0], expected: false },
{ lhs: [0, 2 * kValue.f32.positive.max], rhs: [0, 1], expected: true },
{ lhs: [0, 2 * kValue.f32.positive.max], rhs: [0, kValue.f32.positive.max], expected: true },
{ lhs: [0, 2 * kValue.f32.positive.max], rhs: [0, kValue.f32.infinity.positive], expected: false },
{ lhs: [0, 2 * kValue.f32.positive.max], rhs: [100, kValue.f32.infinity.positive], expected: false },
{ lhs: [0, 2 * kValue.f32.positive.max], rhs: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], expected: false },

// Out of range low
{ lhs: [2 * kValue.f32.negative.min, 0], rhs: 0, expected: true },
{ lhs: [2 * kValue.f32.negative.min, 0], rhs: [-1, 0], expected: true },
{ lhs: [2 * kValue.f32.negative.min, 0], rhs: [kValue.f32.negative.min, 0], expected: true },
{ lhs: [2 * kValue.f32.negative.min, 0], rhs: [0, 1], expected: false },
{ lhs: [2 * kValue.f32.negative.min, 0], rhs: [kValue.f32.infinity.negative, 0], expected: false },
{ lhs: [2 * kValue.f32.negative.min, 0], rhs: [kValue.f32.infinity.negative, -100], expected: false },
{ lhs: [2 * kValue.f32.negative.min, 0], rhs: [kValue.f32.infinity.negative, kValue.f32.infinity.positive], expected: false }]).


fn((t) => {
  const lhs = toF32Interval(t.params.lhs);
  const rhs = toF32Interval(t.params.rhs);
  const expected = t.params.expected;

  const got = lhs.contains(rhs);
  t.expect(expected === got, `${lhs}.contains(${rhs}) returned ${got}. Expected ${expected}`);
});






g.test('span').
paramsSubcasesOnly(

[
// Single Intervals
{ intervals: [[0, 10]], expected: [0, 10] },
{ intervals: [[0, kValue.f32.positive.max]], expected: [0, kValue.f32.positive.max] },
{ intervals: [[0, kValue.f32.positive.nearest_max]], expected: [0, kValue.f32.positive.nearest_max] },
{ intervals: [[0, kValue.f32.infinity.positive]], expected: [0, Number.POSITIVE_INFINITY] },
{ intervals: [[kValue.f32.negative.min, 0]], expected: [kValue.f32.negative.min, 0] },
{ intervals: [[kValue.f32.negative.nearest_min, 0]], expected: [kValue.f32.negative.nearest_min, 0] },
{ intervals: [[kValue.f32.infinity.negative, 0]], expected: [Number.NEGATIVE_INFINITY, 0] },

// Double Intervals
{ intervals: [[0, 1], [2, 5]], expected: [0, 5] },
{ intervals: [[2, 5], [0, 1]], expected: [0, 5] },
{ intervals: [[0, 2], [1, 5]], expected: [0, 5] },
{ intervals: [[0, 5], [1, 2]], expected: [0, 5] },
{ intervals: [[kValue.f32.infinity.negative, 0], [0, kValue.f32.infinity.positive]], expected: kAnyBounds },

// Multiple Intervals
{ intervals: [[0, 1], [2, 3], [4, 5]], expected: [0, 5] },
{ intervals: [[0, 1], [4, 5], [2, 3]], expected: [0, 5] },
{ intervals: [[0, 1], [0, 1], [0, 1]], expected: [0, 1] },

// Point Intervals
{ intervals: [1], expected: 1 },
{ intervals: [1, 2], expected: [1, 2] },
{ intervals: [-10, 2], expected: [-10, 2] }]).


fn((t) => {
  const intervals = t.params.intervals.map((i) => toF32Interval(i));
  const expected = toF32Interval(t.params.expected);

  const got = spanF32Intervals(...intervals);
  t.expect(
  objectEquals(got, expected),
  `span({${intervals}}) returned ${got}. Expected ${expected}`);

});






g.test('isF32Vector').
paramsSubcasesOnly([
// numbers
{ input: [1, 2], expected: false },
{ input: [1, 2, 3], expected: false },
{ input: [1, 2, 3, 4], expected: false },

// IntervalBounds
{ input: [[1], [2]], expected: false },
{ input: [[1], [2], [3]], expected: false },
{ input: [[1], [2], [3], [4]], expected: false },
{
  input: [
  [1, 2],
  [2, 3]],

  expected: false
},
{
  input: [
  [1, 2],
  [2, 3],
  [3, 4]],

  expected: false
},
{
  input: [
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5]],

  expected: false
},

// F32Interval, valid dimensions
{ input: [toF32Interval([1]), toF32Interval([2])], expected: true },
{ input: [toF32Interval([1, 2]), toF32Interval([2, 3])], expected: true },
{
  input: [toF32Interval([1]), toF32Interval([2]), toF32Interval([3])],
  expected: true
},
{
  input: [toF32Interval([1, 2]), toF32Interval([2, 3]), toF32Interval([3, 4])],
  expected: true
},
{
  input: [toF32Interval([1]), toF32Interval([2]), toF32Interval([3]), toF32Interval([4])],
  expected: true
},
{
  input: [
  toF32Interval([1, 2]),
  toF32Interval([2, 3]),
  toF32Interval([3, 4]),
  toF32Interval([4, 5])],

  expected: true
},

// FPInterval, invalid dimensions
{ input: [toF32Interval([1])], expected: false },
{
  input: [
  toF32Interval([1]),
  toF32Interval([2]),
  toF32Interval([3]),
  toF32Interval([4]),
  toF32Interval([5])],

  expected: false
},

// Mixed
{ input: [1, [2]], expected: false },
{ input: [1, [2], toF32Interval([3])], expected: false },
{ input: [1, toF32Interval([2]), [3], 4], expected: false },
{ input: [toF32Interval(1), 2], expected: false },
{ input: [toF32Interval(1), [2]], expected: false }]).

fn((t) => {
  const input = t.params.input;
  const expected = t.params.expected;

  const got = isF32Vector(input);
  t.expect(got === expected, `isF32Vector([${input}]) returned ${got}. Expected ${expected}`);
});






g.test('toF32Vector').
paramsSubcasesOnly([
// numbers
{ input: [1, 2], expected: [1, 2] },
{ input: [1, 2, 3], expected: [1, 2, 3] },
{ input: [1, 2, 3, 4], expected: [1, 2, 3, 4] },

// IntervalBounds
{ input: [[1], [2]], expected: [1, 2] },
{ input: [[1], [2], [3]], expected: [1, 2, 3] },
{ input: [[1], [2], [3], [4]], expected: [1, 2, 3, 4] },
{
  input: [
  [1, 2],
  [2, 3]],

  expected: [
  [1, 2],
  [2, 3]]

},
{
  input: [
  [1, 2],
  [2, 3],
  [3, 4]],

  expected: [
  [1, 2],
  [2, 3],
  [3, 4]]

},
{
  input: [
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5]],

  expected: [
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5]]

},

// F32Interval
{ input: [toF32Interval([1]), toF32Interval([2])], expected: [1, 2] },
{
  input: [toF32Interval([1, 2]), toF32Interval([2, 3])],
  expected: [
  [1, 2],
  [2, 3]]

},
{
  input: [toF32Interval([1]), toF32Interval([2]), toF32Interval([3])],
  expected: [1, 2, 3]
},
{
  input: [toF32Interval([1, 2]), toF32Interval([2, 3]), toF32Interval([3, 4])],
  expected: [
  [1, 2],
  [2, 3],
  [3, 4]]

},
{
  input: [toF32Interval([1]), toF32Interval([2]), toF32Interval([3]), toF32Interval([4])],
  expected: [1, 2, 3, 4]
},
{
  input: [
  toF32Interval([1, 2]),
  toF32Interval([2, 3]),
  toF32Interval([3, 4]),
  toF32Interval([4, 5])],

  expected: [
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5]]

},

// Mixed
{ input: [1, [2]], expected: [1, 2] },
{ input: [1, [2], toF32Interval([3])], expected: [1, 2, 3] },
{ input: [1, toF32Interval([2]), [3], 4], expected: [1, 2, 3, 4] },
{
  input: [1, [2], [2, 3], kAnyInterval],
  expected: [1, 2, [2, 3], kAnyBounds]
}]).

fn((t) => {
  const input = t.params.input;
  const expected = t.params.expected.map((e) => toF32Interval(e));

  const got = toF32Vector(input);
  t.expect(
  objectEquals(got, expected),
  `toF32Vector([${input}]) returned [${got}]. Expected [${expected}]`);

});






g.test('isF32Matrix').
paramsSubcasesOnly([
// numbers
{
  input: [
  [1, 2],
  [3, 4]],

  expected: false
},
{
  input: [
  [1, 2],
  [3, 4],
  [5, 6]],

  expected: false
},
{
  input: [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8]],

  expected: false
},
{
  input: [
  [1, 2, 3],
  [4, 5, 6]],

  expected: false
},
{
  input: [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9]],

  expected: false
},
{
  input: [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [10, 11, 12]],

  expected: false
},
{
  input: [
  [1, 2, 3, 4],
  [5, 6, 7, 8]],

  expected: false
},
{
  input: [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12]],

  expected: false
},
{
  input: [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16]],

  expected: false
},

// IntervalBounds
{
  input: [
  [[1], [2]],
  [[3], [4]]],

  expected: false
},
{
  input: [
  [[1], [2]],
  [[3], [4]],
  [[5], [6]]],

  expected: false
},
{
  input: [
  [[1], [2]],
  [[3], [4]],
  [[5], [6]],
  [[7], [8]]],

  expected: false
},
{
  input: [
  [[1], [2], [3]],
  [[4], [5], [6]]],

  expected: false
},
{
  input: [
  [[1], [2], [3]],
  [[4], [5], [6]],
  [[7], [8], [9]]],

  expected: false
},
{
  input: [
  [[1], [2], [3]],
  [[4], [5], [6]],
  [[7], [8], [9]],
  [[10], [11], [12]]],

  expected: false
},
{
  input: [
  [[1], [2], [3], [4]],
  [[5], [6], [7], [8]]],

  expected: false
},
{
  input: [
  [[1], [2], [3], [4]],
  [[5], [6], [7], [8]],
  [[9], [10], [11], [12]]],

  expected: false
},
{
  input: [
  [[1], [2], [3], [4]],
  [[5], [6], [7], [8]],
  [[9], [10], [11], [12]],
  [[13], [14], [15], [16]]],

  expected: false
},

// FPInterval, valid dimensions
{
  input: [
  [toF32Interval(1), toF32Interval(2)],
  [toF32Interval(3), toF32Interval(4)]],

  expected: true
},
{
  input: [
  [toF32Interval(1), toF32Interval(2)],
  [toF32Interval(3), toF32Interval(4)],
  [toF32Interval(5), toF32Interval(6)]],

  expected: true
},
{
  input: [
  [toF32Interval(1), toF32Interval(2)],
  [toF32Interval(3), toF32Interval(4)],
  [toF32Interval(5), toF32Interval(6)],
  [toF32Interval(7), toF32Interval(8)]],

  expected: true
},
{
  input: [
  [toF32Interval(1), toF32Interval(2), toF32Interval(3)],
  [toF32Interval(4), toF32Interval(5), toF32Interval(6)]],

  expected: true
},
{
  input: [
  [toF32Interval(1), toF32Interval(2), toF32Interval(3)],
  [toF32Interval(4), toF32Interval(5), toF32Interval(6)],
  [toF32Interval(7), toF32Interval(8), toF32Interval(9)]],

  expected: true
},
{
  input: [
  [toF32Interval(1), toF32Interval(2), toF32Interval(3)],
  [toF32Interval(4), toF32Interval(5), toF32Interval(6)],
  [toF32Interval(7), toF32Interval(8), toF32Interval(9)],
  [toF32Interval(10), toF32Interval(11), toF32Interval(12)]],

  expected: true
},
{
  input: [
  [toF32Interval(1), toF32Interval(2), toF32Interval(3), toF32Interval(4)],
  [toF32Interval(5), toF32Interval(6), toF32Interval(7), toF32Interval(8)]],

  expected: true
},
{
  input: [
  [toF32Interval(1), toF32Interval(2), toF32Interval(3), toF32Interval(4)],
  [toF32Interval(5), toF32Interval(6), toF32Interval(7), toF32Interval(8)],
  [toF32Interval(9), toF32Interval(10), toF32Interval(11), toF32Interval(12)]],

  expected: true
},
{
  input: [
  [toF32Interval(1), toF32Interval(2), toF32Interval(3), toF32Interval(4)],
  [toF32Interval(5), toF32Interval(6), toF32Interval(7), toF32Interval(8)],
  [toF32Interval(9), toF32Interval(10), toF32Interval(11), toF32Interval(12)],
  [toF32Interval(13), toF32Interval(14), toF32Interval(15), toF32Interval(16)]],

  expected: true
},
{
  input: [
  [toF32Interval([1, 2]), toF32Interval([2, 3])],
  [toF32Interval([3, 4]), toF32Interval([4, 5])]],

  expected: true
},
{
  input: [
  [toF32Interval([1, 2]), toF32Interval([2, 3])],
  [toF32Interval([3, 4]), toF32Interval([4, 5])],
  [toF32Interval([5, 6]), toF32Interval([6, 7])]],

  expected: true
},
{
  input: [
  [toF32Interval([1, 2]), toF32Interval([2, 3])],
  [toF32Interval([3, 4]), toF32Interval([4, 5])],
  [toF32Interval([5, 6]), toF32Interval([6, 7])],
  [toF32Interval([7, 8]), toF32Interval([8, 9])]],

  expected: true
},
{
  input: [
  [toF32Interval([1, 2]), toF32Interval([2, 3]), toF32Interval([3, 4])],
  [toF32Interval([4, 5]), toF32Interval([5, 6]), toF32Interval([6, 7])]],

  expected: true
},
{
  input: [
  [toF32Interval([1, 2]), toF32Interval([2, 3]), toF32Interval([3, 4])],
  [toF32Interval([4, 5]), toF32Interval([5, 6]), toF32Interval([6, 7])],
  [toF32Interval([7, 8]), toF32Interval([8, 9]), toF32Interval([9, 10])]],

  expected: true
},
{
  input: [
  [toF32Interval([1, 2]), toF32Interval([2, 3]), toF32Interval([3, 4])],
  [toF32Interval([4, 5]), toF32Interval([5, 6]), toF32Interval([6, 7])],
  [toF32Interval([7, 8]), toF32Interval([8, 9]), toF32Interval([9, 10])],
  [toF32Interval([10, 11]), toF32Interval([11, 12]), toF32Interval([12, 13])]],

  expected: true
},
{
  input: [
  [
  toF32Interval([1, 2]),
  toF32Interval([2, 3]),
  toF32Interval([3, 4]),
  toF32Interval([4, 5])],

  [
  toF32Interval([5, 6]),
  toF32Interval([6, 7]),
  toF32Interval([7, 8]),
  toF32Interval([8, 9])]],


  expected: true
},
{
  input: [
  [
  toF32Interval([1, 2]),
  toF32Interval([2, 3]),
  toF32Interval([3, 4]),
  toF32Interval([4, 5])],

  [
  toF32Interval([5, 6]),
  toF32Interval([6, 7]),
  toF32Interval([7, 8]),
  toF32Interval([8, 9])],

  [
  toF32Interval([9, 10]),
  toF32Interval([10, 11]),
  toF32Interval([11, 12]),
  toF32Interval([12, 13])]],


  expected: true
},
{
  input: [
  [
  toF32Interval([1, 2]),
  toF32Interval([2, 3]),
  toF32Interval([3, 4]),
  toF32Interval([4, 5])],

  [
  toF32Interval([5, 6]),
  toF32Interval([6, 7]),
  toF32Interval([7, 8]),
  toF32Interval([8, 9])],

  [
  toF32Interval([9, 10]),
  toF32Interval([10, 11]),
  toF32Interval([11, 12]),
  toF32Interval([12, 13])],

  [
  toF32Interval([13, 14]),
  toF32Interval([14, 15]),
  toF32Interval([15, 16]),
  toF32Interval([16, 17])]],


  expected: true
},

// FPInterval, invalid dimensions
{ input: [[toF32Interval(1)]], expected: false },
{
  input: [[toF32Interval(1)], [toF32Interval(3), toF32Interval(4)]],
  expected: false
},
{
  input: [
  [toF32Interval(1), toF32Interval(2)],
  [toF32Interval(3), toF32Interval(4), toF32Interval(5)]],

  expected: false
},
{
  input: [
  [toF32Interval(1), toF32Interval(2)],
  [toF32Interval(3), toF32Interval(4)],
  [toF32Interval(5)]],

  expected: false
},
{
  input: [
  [toF32Interval(1), toF32Interval(2)],
  [toF32Interval(3), toF32Interval(4)],
  [toF32Interval(5), toF32Interval(6)],
  [toF32Interval(7), toF32Interval(8)],
  [toF32Interval(9), toF32Interval(10)]],

  expected: false
},

// Mixed
{
  input: [
  [1, [2]],
  [3, 4]],

  expected: false
},
{
  input: [
  [[1], [2]],
  [[3], 4]],

  expected: false
},
{
  input: [
  [1, 2],
  [toF32Interval([3]), 4]],

  expected: false
},
{
  input: [
  [[1], toF32Interval([2])],
  [toF32Interval([3]), toF32Interval([4])]],

  expected: false
},
{
  input: [
  [toF32Interval(1), [2]],
  [3, 4]],

  expected: false
}]).

fn((t) => {
  const input = t.params.input;
  const expected = t.params.expected;

  const got = isF32Matrix(input);
  t.expect(got === expected, `isF32Matrix([${input}]) returned ${got}. Expected ${expected}`);
});






g.test('toF32Matrix').
paramsSubcasesOnly([
// numbers
{
  input: [
  [1, 2],
  [3, 4]],

  expected: [
  [1, 2],
  [3, 4]]

},
{
  input: [
  [1, 2],
  [3, 4],
  [5, 6]],

  expected: [
  [1, 2],
  [3, 4],
  [5, 6]]

},
{
  input: [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8]],

  expected: [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8]]

},
{
  input: [
  [1, 2, 3],
  [4, 5, 6]],

  expected: [
  [1, 2, 3],
  [4, 5, 6]]

},
{
  input: [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9]],

  expected: [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9]]

},
{
  input: [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [10, 11, 12]],

  expected: [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [10, 11, 12]]

},
{
  input: [
  [1, 2, 3, 4],
  [5, 6, 7, 8]],

  expected: [
  [1, 2, 3, 4],
  [5, 6, 7, 8]]

},
{
  input: [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12]],

  expected: [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12]]

},
{
  input: [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16]],

  expected: [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16]]

},

// IntervalBounds
{
  input: [
  [[1], [2]],
  [[3], [4]]],

  expected: [
  [1, 2],
  [3, 4]]

},
{
  input: [
  [[1], [2]],
  [[3], [4]],
  [[5], [6]]],

  expected: [
  [1, 2],
  [3, 4],
  [5, 6]]

},
{
  input: [
  [[1], [2]],
  [[3], [4]],
  [[5], [6]],
  [[7], [8]]],

  expected: [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8]]

},
{
  input: [
  [[1], [2], [3]],
  [[4], [5], [6]]],

  expected: [
  [1, 2, 3],
  [4, 5, 6]]

},
{
  input: [
  [[1], [2], [3]],
  [[4], [5], [6]],
  [[7], [8], [9]]],

  expected: [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9]]

},
{
  input: [
  [[1], [2], [3]],
  [[4], [5], [6]],
  [[7], [8], [9]],
  [[10], [11], [12]]],

  expected: [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [10, 11, 12]]

},
{
  input: [
  [[1], [2], [3], [4]],
  [[5], [6], [7], [8]]],

  expected: [
  [1, 2, 3, 4],
  [5, 6, 7, 8]]

},
{
  input: [
  [[1], [2], [3], [4]],
  [[5], [6], [7], [8]],
  [[9], [10], [11], [12]]],

  expected: [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12]]

},
{
  input: [
  [[1], [2], [3], [4]],
  [[5], [6], [7], [8]],
  [[9], [10], [11], [12]],
  [[13], [14], [15], [16]]],

  expected: [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16]]

},

// FPInterval
{
  input: [
  [toF32Interval(1), toF32Interval(2)],
  [toF32Interval(3), toF32Interval(4)]],

  expected: [
  [1, 2],
  [3, 4]]

},
{
  input: [
  [toF32Interval(1), toF32Interval(2)],
  [toF32Interval(3), toF32Interval(4)],
  [toF32Interval(5), toF32Interval(6)]],

  expected: [
  [1, 2],
  [3, 4],
  [5, 6]]

},
{
  input: [
  [toF32Interval(1), toF32Interval(2)],
  [toF32Interval(3), toF32Interval(4)],
  [toF32Interval(5), toF32Interval(6)],
  [toF32Interval(7), toF32Interval(8)]],

  expected: [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8]]

},
{
  input: [
  [toF32Interval(1), toF32Interval(2), toF32Interval(3)],
  [toF32Interval(4), toF32Interval(5), toF32Interval(6)]],

  expected: [
  [1, 2, 3],
  [4, 5, 6]]

},
{
  input: [
  [toF32Interval(1), toF32Interval(2), toF32Interval(3)],
  [toF32Interval(4), toF32Interval(5), toF32Interval(6)],
  [toF32Interval(7), toF32Interval(8), toF32Interval(9)]],

  expected: [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9]]

},
{
  input: [
  [toF32Interval(1), toF32Interval(2), toF32Interval(3)],
  [toF32Interval(4), toF32Interval(5), toF32Interval(6)],
  [toF32Interval(7), toF32Interval(8), toF32Interval(9)],
  [toF32Interval(10), toF32Interval(11), toF32Interval(12)]],

  expected: [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [10, 11, 12]]

},
{
  input: [
  [toF32Interval(1), toF32Interval(2), toF32Interval(3), toF32Interval(4)],
  [toF32Interval(5), toF32Interval(6), toF32Interval(7), toF32Interval(8)]],

  expected: [
  [1, 2, 3, 4],
  [5, 6, 7, 8]]

},
{
  input: [
  [toF32Interval(1), toF32Interval(2), toF32Interval(3), toF32Interval(4)],
  [toF32Interval(5), toF32Interval(6), toF32Interval(7), toF32Interval(8)],
  [toF32Interval(9), toF32Interval(10), toF32Interval(11), toF32Interval(12)]],

  expected: [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12]]

},
{
  input: [
  [toF32Interval(1), toF32Interval(2), toF32Interval(3), toF32Interval(4)],
  [toF32Interval(5), toF32Interval(6), toF32Interval(7), toF32Interval(8)],
  [toF32Interval(9), toF32Interval(10), toF32Interval(11), toF32Interval(12)],
  [toF32Interval(13), toF32Interval(14), toF32Interval(15), toF32Interval(16)]],

  expected: [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16]]

},

{
  input: [
  [toF32Interval([1, 2]), toF32Interval([2, 3])],
  [toF32Interval([3, 4]), toF32Interval([4, 5])]],

  expected: [
  [
  [1, 2],
  [2, 3]],

  [
  [3, 4],
  [4, 5]]]


},
{
  input: [
  [toF32Interval([1, 2]), toF32Interval([2, 3])],
  [toF32Interval([3, 4]), toF32Interval([4, 5])],
  [toF32Interval([5, 6]), toF32Interval([6, 7])]],

  expected: [
  [
  [1, 2],
  [2, 3]],

  [
  [3, 4],
  [4, 5]],

  [
  [5, 6],
  [6, 7]]]


},
{
  input: [
  [toF32Interval([1, 2]), toF32Interval([2, 3])],
  [toF32Interval([3, 4]), toF32Interval([4, 5])],
  [toF32Interval([5, 6]), toF32Interval([6, 7])],
  [toF32Interval([7, 8]), toF32Interval([8, 9])]],

  expected: [
  [
  [1, 2],
  [2, 3]],

  [
  [3, 4],
  [4, 5]],

  [
  [5, 6],
  [6, 7]],

  [
  [7, 8],
  [8, 9]]]


},
{
  input: [
  [toF32Interval([1, 2]), toF32Interval([2, 3]), toF32Interval([3, 4])],
  [toF32Interval([4, 5]), toF32Interval([5, 6]), toF32Interval([6, 7])]],

  expected: [
  [
  [1, 2],
  [2, 3],
  [3, 4]],

  [
  [4, 5],
  [5, 6],
  [6, 7]]]


},
{
  input: [
  [toF32Interval([1, 2]), toF32Interval([2, 3]), toF32Interval([3, 4])],
  [toF32Interval([4, 5]), toF32Interval([5, 6]), toF32Interval([6, 7])],
  [toF32Interval([7, 8]), toF32Interval([8, 9]), toF32Interval([9, 10])]],

  expected: [
  [
  [1, 2],
  [2, 3],
  [3, 4]],

  [
  [4, 5],
  [5, 6],
  [6, 7]],

  [
  [7, 8],
  [8, 9],
  [9, 10]]]


},
{
  input: [
  [toF32Interval([1, 2]), toF32Interval([2, 3]), toF32Interval([3, 4])],
  [toF32Interval([4, 5]), toF32Interval([5, 6]), toF32Interval([6, 7])],
  [toF32Interval([7, 8]), toF32Interval([8, 9]), toF32Interval([9, 10])],
  [toF32Interval([10, 11]), toF32Interval([11, 12]), toF32Interval([12, 13])]],

  expected: [
  [
  [1, 2],
  [2, 3],
  [3, 4]],

  [
  [4, 5],
  [5, 6],
  [6, 7]],

  [
  [7, 8],
  [8, 9],
  [9, 10]],

  [
  [10, 11],
  [11, 12],
  [12, 13]]]


},
{
  input: [
  [
  toF32Interval([1, 2]),
  toF32Interval([2, 3]),
  toF32Interval([3, 4]),
  toF32Interval([4, 5])],

  [
  toF32Interval([5, 6]),
  toF32Interval([6, 7]),
  toF32Interval([7, 8]),
  toF32Interval([8, 9])]],


  expected: [
  [
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5]],

  [
  [5, 6],
  [6, 7],
  [7, 8],
  [8, 9]]]


},
{
  input: [
  [
  toF32Interval([1, 2]),
  toF32Interval([2, 3]),
  toF32Interval([3, 4]),
  toF32Interval([4, 5])],

  [
  toF32Interval([5, 6]),
  toF32Interval([6, 7]),
  toF32Interval([7, 8]),
  toF32Interval([8, 9])],

  [
  toF32Interval([9, 10]),
  toF32Interval([10, 11]),
  toF32Interval([11, 12]),
  toF32Interval([12, 13])]],


  expected: [
  [
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5]],

  [
  [5, 6],
  [6, 7],
  [7, 8],
  [8, 9]],

  [
  [9, 10],
  [10, 11],
  [11, 12],
  [12, 13]]]


},
{
  input: [
  [
  toF32Interval([1, 2]),
  toF32Interval([2, 3]),
  toF32Interval([3, 4]),
  toF32Interval([4, 5])],

  [
  toF32Interval([5, 6]),
  toF32Interval([6, 7]),
  toF32Interval([7, 8]),
  toF32Interval([8, 9])],

  [
  toF32Interval([9, 10]),
  toF32Interval([10, 11]),
  toF32Interval([11, 12]),
  toF32Interval([12, 13])],

  [
  toF32Interval([13, 14]),
  toF32Interval([14, 15]),
  toF32Interval([15, 16]),
  toF32Interval([16, 17])]],


  expected: [
  [
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5]],

  [
  [5, 6],
  [6, 7],
  [7, 8],
  [8, 9]],

  [
  [9, 10],
  [10, 11],
  [11, 12],
  [12, 13]],

  [
  [13, 14],
  [14, 15],
  [15, 16],
  [16, 17]]]


},

// Mixed
{
  input: [
  [1, [2]],
  [3, 4]],

  expected: [
  [1, 2],
  [3, 4]]

},
{
  input: [
  [[1], [2]],
  [[3], 4]],

  expected: [
  [1, 2],
  [3, 4]]

},
{
  input: [
  [1, 2],
  [toF32Interval([3]), 4]],

  expected: [
  [1, 2],
  [3, 4]]

},
{
  input: [
  [[1], toF32Interval([2])],
  [toF32Interval([3]), toF32Interval([4])]],

  expected: [
  [1, 2],
  [3, 4]]

}]).

fn((t) => {
  const input = t.params.input;
  const expected = map2DArray(t.params.expected, (e) => toF32Interval(e));

  const got = toF32Matrix(input);
  t.expect(
  objectEquals(got, expected),
  `toF32Matrix([${input}]) returned [${got}]. Expected [${expected}]`);

});
//# sourceMappingURL=f32_interval.spec.js.map