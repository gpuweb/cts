import { assert } from './util/util.js';

// The state of the preprocessor is a stack of States.
type StateStack = { allowsFollowingElse: boolean; state: State }[];

// The transitions in the state space are:
// - Sibling elif
// - Sibling else
// - Sibling endif
// - Child if
const enum State {
  Seeking, // Still looking for a passing condition
  Passing, // Currently inside a passing condition
  Skipping, // Have already seen a passing condition; now skipping the rest
}

abstract class Directive {
  private depth: number;

  constructor(depth: number) {
    this.depth = depth;
  }

  protected checkDepth(stack: StateStack): void {
    assert(
      stack.length === this.depth,
      `Number of "$"s must match nesting depth, currently ${stack.length} (e.g. $if $$if $$endif $endif)`
    );
  }

  abstract transition(stack: StateStack): void;
}

class If extends Directive {
  private predicate: boolean;

  constructor(depth: number, predicate: boolean) {
    super(depth);
    this.predicate = predicate;
  }

  transition(stack: StateStack) {
    this.checkDepth(stack);
    const parentState = stack[stack.length - 1].state;
    stack.push({
      allowsFollowingElse: true,
      state:
        parentState !== State.Passing
          ? State.Skipping
          : this.predicate
          ? State.Passing
          : State.Seeking,
    });
  }
}

class ElseIf extends If {
  transition(stack: StateStack) {
    const { allowsFollowingElse, state: siblingState } = stack.pop()!;
    this.checkDepth(stack);
    assert(allowsFollowingElse, 'pp.elif after pp.else');
    if (siblingState !== State.Seeking) {
      stack.push({ allowsFollowingElse: true, state: State.Skipping });
    } else {
      super.transition(stack);
    }
  }
}

class Else extends Directive {
  transition(stack: StateStack) {
    const { allowsFollowingElse, state: siblingState } = stack.pop()!;
    this.checkDepth(stack);
    assert(allowsFollowingElse, 'pp.else after pp.else');
    stack.push({
      allowsFollowingElse: false,
      state: siblingState === State.Seeking ? State.Passing : State.Skipping,
    });
  }
}

class EndIf extends Directive {
  transition(stack: StateStack) {
    stack.pop();
    this.checkDepth(stack);
  }
}

/**
 * A simple template-based, non-line-based preprocessor.
 */
export function pp(
  strings: TemplateStringsArray,
  ...values: ReadonlyArray<Directive | string | number>
): string {
  let result = '';
  const stateStack: StateStack = [{ allowsFollowingElse: false, state: State.Passing }];

  for (let i = 0; i < values.length; ++i) {
    const passing = stateStack[stateStack.length - 1].state === State.Passing;
    if (passing) {
      result += strings[i];
    }

    const value = values[i];
    if (value instanceof Directive) {
      value.transition(stateStack);
    } else {
      if (passing) {
        result += value;
      }
    }
  }
  assert(stateStack.length === 1, 'Unterminated preprocessor condition at end of file');
  result += strings[values.length];

  return result;
}
pp.$if = (predicate: boolean) => new If(1, predicate);
pp.$elif = (predicate: boolean) => new ElseIf(1, predicate);
pp.$else = new Else(1);
pp.$endif = new EndIf(1);
pp.$$if = (predicate: boolean) => new If(2, predicate);
pp.$$elif = (predicate: boolean) => new ElseIf(2, predicate);
pp.$$else = new Else(2);
pp.$$endif = new EndIf(2);
pp.$$$if = (predicate: boolean) => new If(3, predicate);
pp.$$$elif = (predicate: boolean) => new ElseIf(3, predicate);
pp.$$$else = new Else(3);
pp.$$$endif = new EndIf(3);
// Add more if really needed.
