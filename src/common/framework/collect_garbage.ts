import { resolveOnTimeout } from './util/util.js';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
declare const Components: any;

export async function attemptGarbageCollection(): Promise<void> {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const w: any = self;
  if (w.GCController) {
    w.GCController.collect();
    return;
  }

  if (w.opera && w.opera.collect) {
    w.opera.collect();
    return;
  }

  try {
    w.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
      .getInterface(Components.interfaces.nsIDOMWindowUtils)
      .garbageCollect();
    return;
    /* eslint-disable-next-line no-empty */
  } catch (e) {}

  if (w.gc) {
    w.gc();
    return;
  }

  if (w.CollectGarbage) {
    w.CollectGarbage();
    return;
  }

  let i: number;
  function gcRec(n: number): void {
    if (n < 1) return;
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    let temp: object | string = { i: 'ab' + i + i / 100000 };
    temp = temp + 'foo';
    gcRec(n - 1);
  }
  for (i = 0; i < 1000; i++) {
    gcRec(10);
  }

  return resolveOnTimeout(35); // Let the event loop run a few frames in case it helps.
}
