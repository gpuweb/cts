import {
  ParamArgument,
  ParamSpec,
  ParamSpecIterable,
  ParamSpecIterator,
  paramsEquals,
} from './params_utils.js';
import { assert } from './util/util.js';

export function params(): ParamsBuilder {
  return new ParamsBuilder();
}

export class ParamsBuilder implements ParamSpecIterable {
  private params: ParamSpecIterable = [{}];

  [Symbol.iterator](): Iterator<ParamSpec> {
    return this.params[Symbol.iterator]();
  }

  combine(p: ParamSpecIterable): ParamsBuilder {
    this.params = new PCombine([this.params, p]);
    return this;
  }

  filter(pred: Predicate): ParamsBuilder {
    this.params = new PFilter(this.params, pred);
    return this;
  }

  unless(pred: Predicate): ParamsBuilder {
    this.params = new PFilter(this.params, x => !pred(x));
    return this;
  }

  exclude(exclude: ParamSpecIterable): ParamsBuilder {
    this.params = new PExclude(this.params, exclude);
    return this;
  }
}

export function poptions(name: string, values: ParamArgument[]): POptions {
  return new POptions(name, values);
}
export function pbool(name: string): POptions {
  return new POptions(name, [false, true]);
}

class POptions implements ParamSpecIterable {
  private name: string;
  private values: ParamArgument[];

  constructor(name: string, values: ParamArgument[]) {
    this.name = name;
    this.values = values;
  }

  *[Symbol.iterator](): ParamSpecIterator {
    for (const value of this.values) {
      yield { [this.name]: value };
    }
  }
}

class PExclude implements ParamSpecIterable {
  private cases: ParamSpecIterable;
  private exclude: ParamSpec[];

  constructor(cases: ParamSpecIterable, exclude: ParamSpecIterable) {
    this.cases = cases;
    this.exclude = Array.from(exclude);
  }

  *[Symbol.iterator](): ParamSpecIterator {
    for (const p of this.cases) {
      if (this.exclude.every(e => !paramsEquals(p, e))) {
        yield p;
      }
    }
  }
}

type Predicate = (o: ParamSpec) => boolean;
class PFilter implements ParamSpecIterable {
  private cases: ParamSpecIterable;
  private pred: Predicate;

  constructor(cases: ParamSpecIterable, pred: Predicate) {
    this.cases = cases;
    this.pred = pred;
  }

  *[Symbol.iterator](): ParamSpecIterator {
    for (const p of this.cases) {
      if (this.pred(p)) {
        yield p;
      }
    }
  }
}

class PCombine implements ParamSpecIterable {
  private params: ParamSpecIterable[];

  constructor(params: ParamSpecIterable[]) {
    this.params = params;
  }

  [Symbol.iterator](): ParamSpecIterator {
    return PCombine.cartesian(this.params);
  }

  static merge(a: ParamSpec, b: ParamSpec): ParamSpec {
    for (const key of Object.keys(a)) {
      assert(!(key in b), 'Duplicate key: ' + key);
    }
    return { ...a, ...b };
  }

  static *cartesian(iters: ParamSpecIterable[]): ParamSpecIterator {
    if (iters.length === 0) {
      return;
    }
    if (iters.length === 1) {
      yield* iters[0];
      return;
    }
    const [as, ...rest] = iters;
    for (const a of as) {
      for (const b of PCombine.cartesian(rest)) {
        yield PCombine.merge(a, b);
      }
    }
  }
}
