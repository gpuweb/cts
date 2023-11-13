import { ErrorWithExtra } from '../../util/util.js';
import { extractImportantStackTrace } from '../stack.js';

export class LogMessageWithStack extends Error {
  readonly extra: unknown;

  private showStar: boolean = true;
  private stackHiddenMessage: string | undefined = undefined;

  constructor(name: string, ex: Error | ErrorWithExtra) {
    super(ex.message);

    this.name = name;
    this.stack = ex.stack;
    if ('extra' in ex) {
      this.extra = ex.extra;
    }
  }

  /** Set a flag so the stack is not printed in toJSON(), and important messages are starred. */
  setPrintOptions(showStar: boolean, stackHiddenMessage: string) {
    this.showStar = showStar;
    this.stackHiddenMessage = stackHiddenMessage;
  }

  toJSON(): string {
    let m = (this.showStar ? '☆ ' : '  ') + this.name;
    if (this.message) m += ': ' + this.message;
    if (this.stack) {
      if (this.stackHiddenMessage === undefined) {
        m += '\n' + extractImportantStackTrace(this);
      } else if (this.stackHiddenMessage) {
        m += `\n    at (elided: ${this.stackHiddenMessage})`;
      }
    }
    return m;
  }
}

/**
 * Returns a string, nicely indented, for debug logs.
 * This is used in the cmdline and wpt runtimes. In WPT, it shows up in the `*-actual.txt` file.
 */
export function prettyPrintLog(log: LogMessageWithStack): string {
  return '  - ' + log.toJSON().replace(/\n/g, '\n    ');
}
