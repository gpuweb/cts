
import { useState, useEffect } from 'react';
import { LiveTestCaseResult } from '@src/common/internal/logging/result.js';
import { assert } from '@src/common/util/util.js';

let haveSomeResults = false;
window.onbeforeunload = () => {
  // Prompt user before reloading if there are any results
  return haveSomeResults ? false : undefined;
};

type ResultStorage = {
  res?: LiveTestCaseResult,
  listeners: Set<(res: LiveTestCaseResult) => void>,
};

// TestResults is a basic map of leaf case query string to LiveTestCaseResult.
// Each entry also stores a set of listeners. The listener is called whenever
// a test result changes.
export class TestResults {
  private results: Map<string, ResultStorage> = new Map();

  public beginTestcase(name: string, res: LiveTestCaseResult) {
    haveSomeResults = true;
    const entry = this.ensureTestcaseResultStorage(name);
    entry.res = res;
    for (const l of entry.listeners) {
      l({ ...res });
    }
  }

  public publishTestcaseResult(name: string) {
    haveSomeResults = true;
    const entry = this.results.get(name);
    assert(entry !== undefined);
    assert(entry.res !== undefined);
    for (const l of entry.listeners) {
      l({ ...entry.res });
    }
  }

  // Hook to create a React state which will stay in sync with
  // |TestResults.results|.
  public use(name: string) {
    const entry = this.ensureTestcaseResultStorage(name);
    const [res, setRes] = useState<LiveTestCaseResult | undefined>(entry.res);
    useEffect(() => {
      entry.listeners.add(setRes);
      return () => {
        entry.listeners.delete(setRes)
      };
    }, []);
    return res;
  }

  private ensureTestcaseResultStorage(name: string) {
    if (!this.results.has(name)) {
      const entry: ResultStorage = {
        listeners: new Set(),
      };
      this.results.set(name, entry);
      return entry;
    }
    return this.results.get(name)!;
  }
};
