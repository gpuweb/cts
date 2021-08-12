import { ErrorWithExtra } from '../../util/util.js';
import { extractImportantStackTrace } from '../stack.js';

export class LogMessageWithStack extends Error {
  readonly extra: unknown;

  private firstLineOnlyMessage: string | undefined = undefined;

  constructor(name: string, ex: Error | ErrorWithExtra) {
    super(ex.message);

    this.name = name;
    this.stack = ex.stack;
    if ('extra' in ex) {
      this.extra = ex.extra;
    }
  }

  /** Set a flag so the details and stack are not printed in toJSON(). */
  setFirstLineOnly(firstLineOnlyMessage: string) {
    this.firstLineOnlyMessage ??= firstLineOnlyMessage;
  }

  toJSON(): string {
    let m = this.name;
    if (this.firstLineOnlyMessage !== undefined) {
      if (this.message) m += ': ' + this.message.split('\n')[0];
      if (this.firstLineOnlyMessage !== '') {
        m += ` (elided: ${this.firstLineOnlyMessage})`;
      }
    } else {
      if (this.message) m += ': ' + this.message;
      if (this.stack) m += '\n' + extractImportantStackTrace(this);
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
