import { getStackTrace } from '../util/stack.js';

export class LogMessageWithStack extends Error {
  constructor(name: string, ex: Error, includeStack: boolean = true) {
    super(ex.message);

    this.name = name;
    this.stack = includeStack ? ex.stack : undefined;
  }

  toJSON(): string {
    let m = this.name;
    if (this.message) {
      m += ': ' + this.message;
    }
    if (this.stack) {
      m += '\n' + getStackTrace(this);
    }
    return m;
  }
}
