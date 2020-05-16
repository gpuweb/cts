import { extractImportantStackTrace } from '../util/stack.js';

export class LogMessageWithStack extends Error {
  printStack: boolean = true;
  timesSeen: number = 1;

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
    if (this.timesSeen > 1) {
      m += `\n(seen ${this.timesSeen} times with identical stack)`;
    }
    return m;
  }
}
