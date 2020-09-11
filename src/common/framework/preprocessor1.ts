import { assert } from './util/util.js';

/**
 * A simple template-based, line-by-line preprocessor.
 */
export function pp(
  strings: TemplateStringsArray,
  ...values: ReadonlyArray<boolean | string | number>
): string {
  let result = '';
  const stateStack = new StateStack();
  let lastStringEndedWithDirective = false;

  for (let stringIndex = 0; stringIndex < strings.length; ++stringIndex) {
    const lines = strings[stringIndex].split(/(?<=\n)/); // include trailing \n on each line

    if (stringIndex === 0) {
      assert(
        strings[0].length === 0 || strings[0][0] === '\n',
        () => `First line should always be empty, in:\n${lines[0]}`
      );
    }

    let lineIndex = 0;
    if (lastStringEndedWithDirective) {
      checkDirectiveComment(lines[0]);
      lineIndex = 1;
      lastStringEndedWithDirective = false;
    } else if (stateStack.passing && stringIndex > 0) {
      const subst = values[stringIndex - 1];
      assert(
        typeof subst === 'string' || typeof subst === 'number',
        '${value} not following %if/%elif must be string or number'
      );
      result += subst;
    }
    for (; lineIndex < lines.length; ++lineIndex) {
      const line = lines[lineIndex];
      if (!line.startsWith('%')) {
        if (stateStack.passing) {
          result += line;
          // TODO: need to substitute non-predicate values
        }
        continue;
      }

      try {
        const match = matchDirective(line);
        const directiveDepth = match[1].length;

        if (match[4] === 'endif') {
          stateStack.endif(directiveDepth);
        } else if (match[4] === 'else') {
          stateStack.else(directiveDepth);
        } else {
          const valueIndex = stringIndex; // Index of the value right after this string
          assert(
            lineIndex === lines.length - 1 && valueIndex < values.length,
            `%${match[4]} must be followed immediately by \${boolean} on the same line`
          );
          lastStringEndedWithDirective = true;

          const predicate = values[valueIndex];
          assert(typeof predicate === 'boolean', '${value} following %if/%elif must be boolean');

          if (match[3] === 'if') {
            stateStack.if(predicate, directiveDepth);
          } else {
            assert(match[3] === 'elif', 'expected %elif');
            stateStack.elif(predicate, directiveDepth);
          }
        }
      } catch (ex) {
        if (ex instanceof Error) ex.message += `, in:\n${line.trimRight()}`;
        throw ex;
      }
    }
  }
  assert(stateStack.length === 1, 'Unterminated preprocessor condition at end of file');

  return result.trim();
}

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

  if(predicate: boolean, directiveDepth: number): void {
    const parentState = this.stack[this.stack.length - 1];
    this.checkDepth(directiveDepth);
    this.stack.push(
      parentState !== State.Passing ? State.Skipping : predicate ? State.Passing : State.Seeking
    );
  }

  elif(predicate: boolean, directiveDepth: number): void {
    const siblingState = this.stack.pop()!;
    if (siblingState !== State.Seeking) {
      this.checkDepth(directiveDepth);
      this.stack.push(State.Skipping);
    } else {
      this.if(predicate, directiveDepth);
    }
  }

  else(directiveDepth: number): void {
    const siblingState = this.stack.pop()!;
    this.checkDepth(directiveDepth);
    this.stack.push(siblingState === State.Seeking ? State.Passing : State.Skipping);
  }

  endif(directiveDepth: number): void {
    this.stack.pop();
    this.checkDepth(directiveDepth);
  }

  private checkDepth(directiveDepth: number) {
    assert(
      this.stack.length === directiveDepth,
      `Number of "%"s must match nesting depth, currently ${this.stack.length} (e.g. %if x  %%if y  %%endif  %endif)`
    );
  }
}

function checkDirectiveComment(line: string) {
  const directiveComment = /^ *(#.*)?\n$/;

  assert(
    directiveComment.test(line),
    () => `Only comments allowed at the end of a directive line ${directiveComment}, in:\n${line}`
  );
}

function matchDirective(line: string): RegExpExecArray {
  const directive = /^(%+)((if|elif) |(else|endif) *(#.*)?\n)$/;

  const match = directive.exec(line);
  assert(match !== null, () => `Preprocessor directive must match ${directive}`);
  return match;
}
