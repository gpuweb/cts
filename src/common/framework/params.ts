import { ParamArgument, ParamSpec, ParamSpecIterable, paramsEquals } from './params_utils.js';
import { assert } from './util/util.js';

export function poptions(name: string, values: Iterable<ParamArgument>): ParamSpecIterable {
  return reusableGenerator(function* () {
    for (const value of values) {
      yield { [name]: value };
    }
  });
}

export function pbool(name: string): ParamSpecIterable {
  return poptions(name, [false, true]);
}

export function params(): ParamsBuilder {
  return new ParamsBuilder();
}

class ParamsBuilder implements ParamSpecIterable {
  private paramSpecs: ParamSpecIterable = [{}];

  [Symbol.iterator](): Iterator<ParamSpec> {
    return this.paramSpecs[Symbol.iterator]();
  }

  combine(newParams: ParamSpecIterable): ParamsBuilder {
    const paramSpecs = this.paramSpecs;
    this.paramSpecs = reusableGenerator(function* () {
      for (const a of paramSpecs) {
        for (const b of newParams) {
          yield mergeParams(a, b);
        }
      }
    });
    return this;
  }

  expand(expander: (_: ParamSpec) => ParamSpecIterable): ParamsBuilder {
    const paramSpecs = this.paramSpecs;
    this.paramSpecs = reusableGenerator(function* () {
      for (const a of paramSpecs) {
        for (const b of expander(a)) {
          yield mergeParams(a, b);
        }
      }
    });
    return this;
  }

  filter(pred: (_: ParamSpec) => boolean): ParamsBuilder {
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

  unless(pred: (_: ParamSpec) => boolean): ParamsBuilder {
    return this.filter(x => !pred(x));
  }

  exclude(exclude: ParamSpecIterable): ParamsBuilder {
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

function reusableGenerator(generatorFn: () => Generator<ParamSpec>): ParamSpecIterable {
  return { [Symbol.iterator]: generatorFn };
}

function mergeParams(a: ParamSpec, b: ParamSpec): ParamSpec {
  for (const key of Object.keys(a)) {
    assert(!(key in b), 'Duplicate key: ' + key);
  }
  return { ...a, ...b };
}
