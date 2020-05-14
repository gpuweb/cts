import { CaseParams, CaseParamsIterable, publicParamsEquals } from './params_utils.js';
import { assert } from './util/util.js';

// https://stackoverflow.com/a/56375136
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;
type CheckForUnion<T, TErr, TOk> = [T] extends [UnionToIntersection<T>] ? TOk : TErr;

type CheckForStringLiteralType<T, TOk> = string extends T ? void : CheckForUnion<T, void, TOk>;

export function poptions<Name extends string, V>(
  name: Name,
  values: Iterable<V>
): CheckForStringLiteralType<Name, Iterable<{ [name in Name]: V }>> {
  const iter = makeReusableIterable(function* () {
    for (const value of values) {
      yield { [name]: value };
    }
  });
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return iter as any;
}

export function pbool<Name extends string>(
  name: Name
): CheckForStringLiteralType<Name, Iterable<{ [name in Name]: boolean }>> {
  return poptions(name, [false, true]);
}

export function params(): ParamsBuilder<{}> {
  return new ParamsBuilder();
}

export class ParamsBuilder<A extends {}> implements CaseParamsIterable {
  private paramSpecs: CaseParamsIterable = [{}];

  [Symbol.iterator](): Iterator<A> {
    const iter: Iterator<CaseParams> = this.paramSpecs[Symbol.iterator]();
    return iter as Iterator<A>;
  }

  combine<B extends {}>(newParams: Iterable<B>): ParamsBuilder<Merged<A, B>> {
    const paramSpecs = this.paramSpecs as Iterable<A>;
    this.paramSpecs = makeReusableIterable(function* () {
      for (const a of paramSpecs) {
        for (const b of newParams) {
          yield mergeParams(a, b);
        }
      }
    }) as CaseParamsIterable;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    return this as any;
  }

  expand<B extends {}>(expander: (_: A) => Iterable<B>): ParamsBuilder<Merged<A, B>> {
    const paramSpecs = this.paramSpecs as Iterable<A>;
    this.paramSpecs = makeReusableIterable(function* () {
      for (const a of paramSpecs) {
        for (const b of expander(a)) {
          yield mergeParams(a, b);
        }
      }
    }) as CaseParamsIterable;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    return this as any;
  }

  filter(pred: (_: A) => boolean): ParamsBuilder<A> {
    const paramSpecs = this.paramSpecs as Iterable<A>;
    this.paramSpecs = makeReusableIterable(function* () {
      for (const p of paramSpecs) {
        if (pred(p)) {
          yield p;
        }
      }
    });
    return this;
  }

  unless(pred: (_: A) => boolean): ParamsBuilder<A> {
    return this.filter(x => !pred(x));
  }

  exclude(exclude: CaseParamsIterable): ParamsBuilder<A> {
    const excludeArray = Array.from(exclude);
    const paramSpecs = this.paramSpecs;
    this.paramSpecs = makeReusableIterable(function* () {
      for (const p of paramSpecs) {
        if (excludeArray.every(e => !publicParamsEquals(p, e))) {
          yield p;
        }
      }
    });
    return this;
  }
}

// If you create an Iterable by calling a generator function (e.g. in IIFE), it is exhausted after
// one use. This just wraps a generator function in an object so it be iterated multiple times.
function makeReusableIterable<P>(generatorFn: () => Generator<P>): Iterable<P> {
  return { [Symbol.iterator]: generatorFn };
}

type ValueTypeForKeyOfMergedType<A, B, Key extends keyof A | keyof B> = Key extends keyof A
  ? Key extends keyof B
    ? void // Key is in both types
    : A[Key] // Key is only in A
  : Key extends keyof B
  ? B[Key] // Key is only in B
  : void; // Key is in neither type (not possible)

type Merged<A, B> = keyof A & keyof B extends never
  ? string extends keyof A | keyof B
    ? never // (keyof A | keyof B) == string, which is too broad
    : {
        [Key in keyof A | keyof B]: ValueTypeForKeyOfMergedType<A, B, Key>;
      }
  : never; // (keyof A & keyof B) is not empty, so they overlapped

function mergeParams<A extends {}, B extends {}>(a: A, b: B): Merged<A, B> {
  for (const key of Object.keys(a)) {
    assert(!(key in b), 'Duplicate key: ' + key);
  }
  return { ...a, ...b } as Merged<A, B>;
}
