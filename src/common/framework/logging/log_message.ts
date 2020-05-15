import { extractImportantStackTrace } from '../util/stack.js';

export class LogMessageWithStack extends Error {
  printStack: boolean = true;

  constructor(name: string, ex: Error) {
    super(ex.message);

    this.name = name;
    this.stack = ex.stack;
  }

  toJSON(): string {
    let m = this.name + ': ';
    if (this.printStack && this.stack) {
      // this.message is already included in this.stack
      m += extractImportantStackTrace(this);
    } else {
      m += this.message;
    }
    return m;
  }
}
