/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
declare const Components: any;

export function attemptGarbageCollection(): void {
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
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    let temp: any = { i: 'ab' + i + i / 100000 };
    temp = temp + 'foo';
    gcRec(n - 1);
  }
  for (i = 0; i < 1000; i++) {
    gcRec(10);
  }
}
