import { ParamSpec, ParamSpecIterable, paramsEquals } from './params_utils.js';
import { assert } from './util/util.js';

export function poptions<Name extends string, V>(
  name: Name,
  values: Iterable<V>
): string extends Name ? never : Iterable<{ [name in Name]: V }> {
  return reusableGenerator(function* () {
    for (const value of values) {
      yield { [name]: value };
    }
  }) as any;
}

export function pbool<Name extends string>(
  name: Name
): string extends Name ? never : Iterable<{ [name in Name]: boolean }> {
  return poptions(name, [false, true]);
}

export function params(): ParamsBuilder<{}> {
  return new ParamsBuilder();
}

class ParamsBuilder<A extends {}> implements ParamSpecIterable {
  private paramSpecs: ParamSpecIterable = [{}];

  [Symbol.iterator](): Iterator<A> {
    const iter: Iterator<ParamSpec> = this.paramSpecs[Symbol.iterator]();
    return iter as Iterator<A>;
  }

  combine<B extends {}>(
    newParams: Iterable<B>
  ): ParamsBuilder<
    {
      [K in keyof A | keyof B]: K extends keyof A
        ? K extends keyof B
          ? never
          : A[K]
        : K extends keyof B
        ? B[K]
        : never;
    }
  > {
    const paramSpecs = this.paramSpecs;
    this.paramSpecs = reusableGenerator(function* () {
      for (const a of paramSpecs) {
        for (const b of newParams) {
          yield mergeParams(a, b);
        }
      }
    });
    return this as any;
  }

  expand<B extends {}>(
    expander: (_: A) => Iterable<B>
  ): ParamsBuilder<
    {
      [K in keyof A | keyof B]: K extends keyof A
        ? K extends keyof B
          ? never
          : A[K]
        : K extends keyof B
        ? B[K]
        : never;
    }
  > {
    const paramSpecs = this.paramSpecs;
    this.paramSpecs = reusableGenerator(function* () {
      for (const a of paramSpecs as Iterable<A>) {
        for (const b of expander(a)) {
          yield mergeParams(a, b);
        }
      }
    });
    return this as any;
  }

  filter(pred: (_: ParamSpec) => boolean): ParamsBuilder<A> {
    const paramSpecs = this.paramSpecs;
    this.paramSpecs = reusableGenerator(function* () {
      for (const p of paramSpecs) {
        if (pred(p)) {
          yield p;
        }
      }
    });
    return this;
  }

  unless(pred: (_: ParamSpec) => boolean): ParamsBuilder<A> {
    return this.filter(x => !pred(x));
  }

  exclude(exclude: ParamSpecIterable): ParamsBuilder<A> {
    const excludeArray = Array.from(exclude);
    const paramSpecs = this.paramSpecs;
    this.paramSpecs = reusableGenerator(function* () {
      for (const p of paramSpecs) {
        if (excludeArray.every(e => !paramsEquals(p, e))) {
          yield p;
        }
      }
    });
    return this;
  }
}

function reusableGenerator<P>(generatorFn: () => Generator<P>): Iterable<P> {
  return { [Symbol.iterator]: generatorFn };
}

function mergeParams<A extends {}, B extends {}>(
  a: A,
  b: B
): {
  [K in keyof A | keyof B]: K extends keyof A
    ? K extends keyof B
      ? never
      : A[K]
    : K extends keyof B
    ? B[K]
    : never;
} {
  for (const key of Object.keys(a)) {
    assert(!(key in b), 'Duplicate key: ' + key);
  }
  return { ...a, ...b } as any;
}
