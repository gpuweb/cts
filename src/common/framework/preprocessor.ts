import { assert } from './util/util.js';

// The state of the preprocessor is a stack of States.
type StateStack = { allowsFollowingElse: boolean; state: State }[];
const enum State {
  Seeking, // Still looking for a passing condition
  Passing, // Currently inside a passing condition (the root is always in this state)
  Skipping, // Have already seen a passing condition; now skipping the rest
}

// The transitions in the state space are the following preprocessor directives:
// - Sibling elif
// - Sibling else
// - Sibling endif
// - Child if
abstract class Directive {
  private readonly depth: number;

  constructor(depth: number) {
    this.depth = depth;
  }

  protected checkDepth(stack: StateStack): void {
    assert(
      stack.length === this.depth,
      `Number of "_"s must match nesting depth, currently ${stack.length} (e.g. _if __if __endif _endif)`
    );
  }

  abstract applyTo(stack: StateStack): void;
}

class If extends Directive {
  private readonly predicate: boolean;

  constructor(depth: number, predicate: boolean) {
    super(depth);
    this.predicate = predicate;
  }

  applyTo(stack: StateStack) {
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
  applyTo(stack: StateStack) {
    assert(stack.length >= 1);
    const { allowsFollowingElse, state: siblingState } = stack.pop()!;
    this.checkDepth(stack);
    assert(allowsFollowingElse, 'pp.elif after pp.else');
    if (siblingState !== State.Seeking) {
      stack.push({ allowsFollowingElse: true, state: State.Skipping });
    } else {
      super.applyTo(stack);
    }
  }
}

class Else extends Directive {
  applyTo(stack: StateStack) {
    assert(stack.length >= 1);
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
  applyTo(stack: StateStack) {
    stack.pop();
    this.checkDepth(stack);
  }
}

class Join {
  private lines: string[];

  constructor(lines: string[]) {
    this.lines = lines;
  }

  join(indentation: number) {
    return this.lines.join('\n' + ' '.repeat(indentation));
  }
}

/**
 * A simple template-based, non-line-based preprocessor implementing if/elif/else/endif.
 *
 * @example
 *     const shader = pp`
 * ${pp._if(expr)}
 *   const x: ${type} = ${value};
 * ${pp._elif(expr)}
 * ${pp.__if(expr)}
 * ...
 * ${pp.__else}
 * ...
 * ${pp.__endif}
 * ${pp._endif}`;
 *
 * @param strings - The array of constant string chunks of the template string.
 * @param ...values - The array of interpolated ${} values within the template string.
 *    If a value is a Directive, it affects the preprocessor state and injects no string.
 *    If a value is a string[], the array is joined together with newlines, preserving vertical
 *    alignment by indenting with spaces.
 */
export function pp(
  strings: TemplateStringsArray,
  ...values: ReadonlyArray<Directive | Join | string | number>
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
      value.applyTo(stateStack);
    } else if (value instanceof Join) {
      const indexOfLastNewline = result.lastIndexOf('\n');
      // Vertically align by indenting with spaces. Works even if indexOfLastNewline === -1.
      const indentation = result.length - indexOfLastNewline - 1;
      result += value.join(indentation);
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
pp.join = (args: string[]) => new Join(args);
pp._if = (predicate: boolean) => new If(1, predicate);
pp._elif = (predicate: boolean) => new ElseIf(1, predicate);
pp._else = new Else(1);
pp._endif = new EndIf(1);
pp.__if = (predicate: boolean) => new If(2, predicate);
pp.__elif = (predicate: boolean) => new ElseIf(2, predicate);
pp.__else = new Else(2);
pp.__endif = new EndIf(2);
pp.___if = (predicate: boolean) => new If(3, predicate);
pp.___elif = (predicate: boolean) => new ElseIf(3, predicate);
pp.___else = new Else(3);
pp.___endif = new EndIf(3);
// Add more if needed.
