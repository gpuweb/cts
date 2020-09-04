import { assert } from './util/util.js';

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

export function pp(parts: TemplateStringsArray, ...predicates: readonly boolean[]): string {
  let result = '';

  const stateStack: State[] = [State.Passing];

  for (let partIndex = 0; partIndex < parts.length; ++partIndex) {
    const lines = parts[partIndex].split('\n');

    checkDirectiveComment(partIndex, lines[0]);
    for (let lineIndex = 1; lineIndex < lines.length; ++lineIndex) {
      const line = lines[lineIndex];
      if (line.startsWith('%')) {
        const match = matchDirective(line);

        if (match[2] === 'if' || match[2] === 'elif') {
          assert(
            lineIndex === lines.length - 1,
            `%${match[2]} must be immediately followed by \${...}`
          );
          assert(partIndex < predicates.length, `File ended while parsing %${match[2]}`);
          const predicate = predicates[partIndex];

          if (match[2] === 'if') {
            checkDepth(stateStack.length, line);
            const parentState = stateStack[stateStack.length - 1];
            stateStack.push(
              parentState !== State.Passing
                ? State.Skipping
                : predicate
                ? State.Passing
                : State.Seeking
            );
          } else {
            assert(match[2] === 'elif', 'expected %elif');
            const siblingState = stateStack.pop()!;
            checkDepth(stateStack.length, line);
            const parentState = stateStack[stateStack.length - 1];
            stateStack.push(
              siblingState !== State.Seeking || parentState !== State.Passing
                ? State.Skipping
                : predicate
                ? State.Passing
                : State.Seeking
            );
          }
        } else {
          const siblingState = stateStack.pop()!;
          checkDepth(stateStack.length, line);
          if (match[3] === 'else') {
            stateStack.push(siblingState === State.Seeking ? State.Passing : State.Skipping);
          } else {
            assert(match[3] === 'endif', 'expected %endif');
          }
        }
      } else {
        if (stateStack[stateStack.length - 1] === State.Passing) {
          result += line + '\n';
        }
      }
    }
  }
  assert(stateStack.length === 1, 'Unterminated preprocessor condition at end of file');

  return result.trim();
}

function checkDirectiveComment(partIndex: number, line: string) {
  const directiveComment = /^ *(#.*)?$/;

  const explanation = partIndex === 0 ? 'on first line' : 'at end of preprocessor directive line';
  assert(
    directiveComment.test(line),
    () => `Text ${explanation} must match ${directiveComment}, in:\n${line}`
  );
}

function matchDirective(line: string): RegExpExecArray {
  const directive = /^%+((if|elif) |(else|endif) *(#.*)?)$/;

  const match = directive.exec(line);
  assert(match !== null, () => `Preprocessor directive must match ${directive}, in:\n${line}`);
  return match;
}

function checkDepth(depth: number, line: string) {
  assert(
    RegExp(`^%{${depth}}[^%]`).test(line),
    `Number of "%"s must match nesting depth, currently ${depth} (e.g. %if x  %%if y  %%endif  %endif), in:\n${line}`
  );
}
