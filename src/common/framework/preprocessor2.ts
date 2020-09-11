import { assert, unreachable } from './util/util.js';

class Directive {
  static IfTrue = new Directive();
  static IfFalse = new Directive();
  static ElseIfTrue = new Directive();
  static ElseIfFalse = new Directive();
  static Else = new Directive();
  static EndIf = new Directive();
}

/**
 * A simple template-based, non-line-based preprocessor.
 */
export function pp(
  strings: TemplateStringsArray,
  ...values: ReadonlyArray<Directive | string | number>
): string {
  let result = '';
  const stateStack = new StateStack();

  for (let i = 0; i < values.length; ++i) {
    if (stateStack.passing) {
      result += strings[i];
    }

    const value = values[i];
    if (value instanceof Directive) {
      /* prettier-ignore */ switch (value) {
        case Directive.IfTrue:      stateStack.if(true); break;
        case Directive.IfFalse:     stateStack.if(false); break;
        case Directive.ElseIfTrue:  stateStack.elif(true); break;
        case Directive.ElseIfFalse: stateStack.elif(false); break;
        case Directive.Else:        stateStack.else(); break;
        case Directive.EndIf:       stateStack.endif(); break;
        default: unreachable();
      }
    } else {
      if (stateStack.passing) {
        result += value;
      }
    }
  }
  assert(stateStack.length === 1, 'Unterminated preprocessor condition at end of file');
  result += strings[values.length];

  return result;
}
pp.if = (predicate: boolean) => (predicate ? Directive.IfTrue : Directive.IfFalse);
pp.elif = (predicate: boolean) => (predicate ? Directive.ElseIfTrue : Directive.ElseIfFalse);
pp.else = Directive.Else;
pp.endif = Directive.EndIf;

// The state of the preprocessor is a stack of States.
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

class StateStack {
  private stack: State[] = [State.Passing];

  get length(): number {
    return this.stack.length;
  }

  get passing(): boolean {
    return this.stack[this.stack.length - 1] === State.Passing;
  }

  if(predicate: boolean): void {
    const parentState = this.stack[this.stack.length - 1];
    this.stack.push(
      parentState !== State.Passing ? State.Skipping : predicate ? State.Passing : State.Seeking
    );
  }

  elif(predicate: boolean): void {
    assert(this.stack.length > 1, 'pp.elif with empty stack');
    const siblingState = this.stack.pop();
    if (siblingState !== State.Seeking) {
      this.stack.push(State.Skipping);
    } else {
      this.if(predicate);
    }
  }

  else(): void {
    assert(this.stack.length > 1, 'pp.else with empty stack');
    const siblingState = this.stack.pop();
    this.stack.push(siblingState === State.Seeking ? State.Passing : State.Skipping);
  }

  endif(): void {
    assert(this.stack.length > 1, 'pp.endif with empty stack');
    this.stack.pop();
  }
}
