/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution Tests for value constructors from components
`;import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';
import { Type, vec2, vec3 } from '../../../../util/conversion.js';
import { FP } from '../../../../util/floating_point.js';
import { allInputSources, basicExpressionBuilder, run } from '../expression.js';

export const g = makeTestGroup(GPUTest);

/** @returns true if 'v' is 'min' or 'max' */
function isMinOrMax(v) {
  return v === 'min' || v === 'max';
}

/**
 * @returns the lowest finite value for 'kind' if 'v' is 'min',
 *          the highest finite value for 'kind' if 'v' is 'max',
 *          otherwise returns 'v'
 */
function valueFor(v, kind) {
  if (!isMinOrMax(v)) {
    return v;
  }
  switch (kind) {
    case 'bool':
      return v === 'min' ? 0 : 1;
    case 'i32':
      return v === 'min' ? -0x80000000 : 0x7fffffff;
    case 'u32':
      return v === 'min' ? 0 : 0xffffffff;
    case 'f32':
      return v === 'min' ? FP['f32'].constants().negative.min : FP['f32'].constants().positive.max;
    case 'f16':
      return v === 'min' ? FP['f16'].constants().negative.min : FP['f16'].constants().positive.max;
  }
}

g.test('scalar_identity').
specURL('https://www.w3.org/TR/WGSL/#value-constructor-builtin-function').
desc(`Test that a scalar constructed from a value of the same type produces the expected value`).
params((u) =>
u.
combine('inputSource', allInputSources).
combine('type', ['bool', 'i32', 'u32', 'f32', 'f16']).
combine('value', ['min', 'max', 1, 2, 5, 100])
).
beforeAllSubcases((t) => {
  if (t.params.type === 'f16') {
    t.selectDeviceOrSkipTestCase('shader-f16');
  }
  t.skipIf(t.params.type === 'bool' && !isMinOrMax(t.params.value));
}).
fn(async (t) => {
  const type = Type[t.params.type];
  const value = valueFor(t.params.value, t.params.type);
  await run(
    t,
    basicExpressionBuilder((ops) => `${type}(${ops[0]})`),
    [type],
    type,
    t.params,
    [{ input: [type.create(value)], expected: type.create(value) }]
  );
});

g.test('vector_identity').
specURL('https://www.w3.org/TR/WGSL/#value-constructor-builtin-function').
desc(`Test that a vector constructed from a value of the same type produces the expected value`).
params((u) =>
u.
combine('inputSource', allInputSources).
combine('type', ['bool', 'i32', 'u32', 'f32', 'f16']).
combine('width', [2, 3, 4]).
combine('infer_type', [false, true])
).
beforeAllSubcases((t) => {
  if (t.params.type === 'f16') {
    t.selectDeviceOrSkipTestCase('shader-f16');
  }
}).
fn(async (t) => {
  const elementType = Type[t.params.type];
  const vectorType = Type.vec(t.params.width, elementType);
  const elements = [];
  const fn = t.params.infer_type ? `vec${t.params.width}` : `${vectorType}`;
  for (let i = 0; i < t.params.width; i++) {
    if (t.params.type === 'bool') {
      elements.push(i & 1);
    } else {
      elements.push((i + 1) * 10);
    }
  }

  await run(
    t,
    basicExpressionBuilder((ops) => `${fn}(${ops[0]})`),
    [vectorType],
    vectorType,
    t.params,
    [
    {
      input: vectorType.create(elements),
      expected: vectorType.create(elements)
    }]

  );
});

g.test('vector_splat').
specURL('https://www.w3.org/TR/WGSL/#value-constructor-builtin-function').
desc(`Test that a vector constructed from a single scalar produces the expected value`).
params((u) =>
u.
combine('inputSource', allInputSources).
combine('type', ['bool', 'i32', 'u32', 'f32', 'f16']).
combine('value', ['min', 'max', 1, 2, 5, 100]).
combine('width', [2, 3, 4]).
combine('infer_type', [false, true])
).
beforeAllSubcases((t) => {
  if (t.params.type === 'f16') {
    t.selectDeviceOrSkipTestCase('shader-f16');
  }
  t.skipIf(t.params.type === 'bool' && !isMinOrMax(t.params.value));
}).
fn(async (t) => {
  const value = valueFor(t.params.value, t.params.type);
  const elementType = Type[t.params.type];
  const vectorType = Type.vec(t.params.width, elementType);
  const fn = t.params.infer_type ? `vec${t.params.width}` : `${vectorType}`;
  await run(
    t,
    basicExpressionBuilder((ops) => `${fn}(${ops[0]})`),
    [elementType],
    vectorType,
    t.params,
    [{ input: [elementType.create(value)], expected: vectorType.create(value) }]
  );
});

g.test('vector_elements').
specURL('https://www.w3.org/TR/WGSL/#value-constructor-builtin-function').
desc(`Test that a vector constructed from element values produces the expected value`).
params((u) =>
u.
combine('inputSource', allInputSources).
combine('type', ['bool', 'i32', 'u32', 'f32', 'f16']).
combine('width', [2, 3, 4]).
combine('infer_type', [false, true])
).
beforeAllSubcases((t) => {
  if (t.params.type === 'f16') {
    t.selectDeviceOrSkipTestCase('shader-f16');
  }
}).
fn(async (t) => {
  const elementType = Type[t.params.type];
  const vectorType = Type.vec(t.params.width, elementType);
  const elements = [];
  const fn = t.params.infer_type ? `vec${t.params.width}` : `${vectorType}`;
  for (let i = 0; i < t.params.width; i++) {
    if (t.params.type === 'bool') {
      elements.push(i & 1);
    } else {
      elements.push((i + 1) * 10);
    }
  }

  await run(
    t,
    basicExpressionBuilder((ops) => `${fn}(${ops.join(', ')})`),
    elements.map((e) => elementType),
    vectorType,
    t.params,
    [
    {
      input: elements.map((v) => elementType.create(v)),
      expected: vectorType.create(elements)
    }]

  );
});

g.test('vector_mix').
specURL('https://www.w3.org/TR/WGSL/#value-constructor-builtin-function').
desc(
  `Test that a vector constructed from a mix of element values and sub-vectors produces the expected value`
).
params((u) =>
u.
combine('inputSource', allInputSources).
combine('type', ['bool', 'i32', 'u32', 'f32', 'f16']).
combine('signature', [
'2s', //   [vec2,   scalar]
's2', //   [scalar, vec2]
'2ss', //  [vec2,   scalar,   scalar]
's2s', //  [scalar, vec2,     scalar]
'ss2', //  [scalar, scalar,   vec2  ]
'22', //   [vec2,   vec2]
'3s', //   [vec3,   scalar]
's3' //   [scalar, vec3]
]).
combine('infer_type', [false, true])
).
beforeAllSubcases((t) => {
  if (t.params.type === 'f16') {
    t.selectDeviceOrSkipTestCase('shader-f16');
  }
}).
fn(async (t) => {
  const elementType = Type[t.params.type];
  let width = 0;
  const elementValue = (i) => t.params.type === 'bool' ? i & 1 : (i + 1) * 10;
  const elements = [];
  const nextValue = () => {
    const value = elementValue(width++);
    elements.push(value);
    return elementType.create(value);
  };
  const args = [];
  for (const c of t.params.signature) {
    switch (c) {
      case '2':
        args.push(vec2(nextValue(), nextValue()));
        break;
      case '3':
        args.push(vec3(nextValue(), nextValue(), nextValue()));
        break;
      case 's':
        args.push(nextValue());
        break;
    }
  }
  const vectorType = Type.vec(width, elementType);
  const fn = t.params.infer_type ? `vec${width}` : `${vectorType}`;
  await run(
    t,
    basicExpressionBuilder((ops) => `${fn}(${ops.join(', ')})`),
    args.map((e) => e.type),
    vectorType,
    t.params,
    [
    {
      input: args,
      expected: vectorType.create(elements)
    }]

  );
});

g.test('matrix_identity').
specURL('https://www.w3.org/TR/WGSL/#value-constructor-builtin-function').
desc(`Test that a matrix constructed from a value of the same type produces the expected value`).
params((u) =>
u.
combine('inputSource', allInputSources).
combine('type', ['f32', 'f16']).
combine('columns', [2, 3, 4]).
combine('rows', [2, 3, 4]).
combine('infer_type', [false, true])
).
beforeAllSubcases((t) => {
  if (t.params.type === 'f16') {
    t.selectDeviceOrSkipTestCase('shader-f16');
  }
}).
fn(async (t) => {
  const elementType = Type[t.params.type];
  const matrixType = Type.mat(t.params.columns, t.params.rows, elementType);
  const elements = [];
  for (let column = 0; column < t.params.columns; column++) {
    for (let row = 0; row < t.params.rows; row++) {
      elements.push((column + 1) * 10 + (row + 1));
    }
  }
  const fn = t.params.infer_type ? `mat${t.params.columns}x${t.params.rows}` : `${matrixType}`;
  await run(
    t,
    basicExpressionBuilder((ops) => `${fn}(${ops[0]})`),
    [matrixType],
    matrixType,
    t.params,
    [
    {
      input: matrixType.create(elements),
      expected: matrixType.create(elements)
    }]

  );
});

g.test('matrix_elements').
specURL('https://www.w3.org/TR/WGSL/#value-constructor-builtin-function').
desc(`Test that a matrix constructed from element values produces the expected value`).
params((u) =>
u.
combine('inputSource', allInputSources).
combine('type', ['f32', 'f16']).
combine('columns', [2, 3, 4]).
combine('rows', [2, 3, 4]).
combine('infer_type', [false, true])
).
beforeAllSubcases((t) => {
  if (t.params.type === 'f16') {
    t.selectDeviceOrSkipTestCase('shader-f16');
  }
}).
fn(async (t) => {
  const elementType = Type[t.params.type];
  const matrixType = Type.mat(t.params.columns, t.params.rows, elementType);
  const elements = [];
  for (let column = 0; column < t.params.columns; column++) {
    for (let row = 0; row < t.params.rows; row++) {
      elements.push((column + 1) * 10 + (row + 1));
    }
  }
  const fn = t.params.infer_type ? `mat${t.params.columns}x${t.params.rows}` : `${matrixType}`;
  await run(
    t,
    basicExpressionBuilder((ops) => `${fn}(${ops.join(', ')})`),
    elements.map((e) => elementType),
    matrixType,
    t.params,
    [
    {
      input: elements.map((e) => elementType.create(e)),
      expected: matrixType.create(elements)
    }]

  );
});

g.test('matrix_column_vectors').
specURL('https://www.w3.org/TR/WGSL/#value-constructor-builtin-function').
desc(`Test that a matrix constructed from column vectors produces the expected value`).
params((u) =>
u.
combine('inputSource', allInputSources).
combine('type', ['f32', 'f16']).
combine('columns', [2, 3, 4]).
combine('rows', [2, 3, 4]).
combine('infer_type', [false, true])
).
beforeAllSubcases((t) => {
  if (t.params.type === 'f16') {
    t.selectDeviceOrSkipTestCase('shader-f16');
  }
}).
fn(async (t) => {
  const elementType = Type[t.params.type];
  const columnType = Type.vec(t.params.rows, elementType);
  const matrixType = Type.mat(t.params.columns, t.params.rows, elementType);
  const elements = [];
  const columnVectors = [];
  for (let column = 0; column < t.params.columns; column++) {
    const columnElements = [];
    for (let row = 0; row < t.params.rows; row++) {
      const v = (column + 1) * 10 + (row + 1);
      elements.push(v);
      columnElements.push(v);
    }
    columnVectors.push(columnType.create(columnElements));
  }
  const fn = t.params.infer_type ? `mat${t.params.columns}x${t.params.rows}` : `${matrixType}`;
  await run(
    t,
    basicExpressionBuilder((ops) => `${fn}(${ops.join(', ')})`),
    columnVectors.map((v) => v.type),
    matrixType,
    t.params,
    [
    {
      input: columnVectors,
      expected: matrixType.create(elements)
    }]

  );
});

g.test('array_elements').
specURL('https://www.w3.org/TR/WGSL/#value-constructor-builtin-function').
desc(`Test that an array constructed from element values produces the expected value`).
params((u) =>
u.
combine('inputSource', allInputSources).
combine('type', ['bool', 'i32', 'u32', 'f32', 'f16', 'vec3f', 'vec4i']).
combine('length', [1, 5, 10]).
combine('infer_type', [false, true])
).
beforeAllSubcases((t) => {
  if (t.params.type === 'f16') {
    t.selectDeviceOrSkipTestCase('shader-f16');
  }
}).
fn(async (t) => {
  const elementType = Type[t.params.type];
  const arrayType = Type.array(t.params.length, elementType);
  const elements = [];
  for (let i = 0; i < t.params.length; i++) {
    elements.push((i + 1) * 10);
  }
  const fn = t.params.infer_type ? `array` : `${arrayType}`;
  await run(
    t,
    basicExpressionBuilder((ops) => `${fn}(${ops.join(', ')})`),
    elements.map((e) => elementType),
    arrayType,
    t.params,
    [
    {
      input: elements.map((e) => elementType.create(e)),
      expected: arrayType.create(elements)
    }]

  );
});

g.test('structure').
specURL('https://www.w3.org/TR/WGSL/#value-constructor-builtin-function').
desc(`Test that an structure constructed from element values produces the expected value`).
unimplemented();
//# sourceMappingURL=non_zero.spec.js.map