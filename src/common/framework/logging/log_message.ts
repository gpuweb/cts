import { getStackTrace } from '../util/stack.js';

export class LogMessageWithStack extends Error {
  constructor(name: string, ex: Error, includeStack: boolean = true) {
    super(ex.message);

    this.name = name;
    this.stack = includeStack ? ex.stack : undefined;
  }

  toJSON(): string {
    let m = this.name + ': ';
    if (this.stack) {
      // this.message is already included in this.stack
      m += getStackTrace(this);
    } else {
      m += this.message;
    }
    return m;
  }
}
