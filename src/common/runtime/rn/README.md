# React Native Runtime for WebGPU CTS

This directory contains a React Native compatible runtime for running WebGPU CTS tests.

## Why a Separate Runtime?

React Native (via Metro bundler) doesn't support dynamic `import()` statements, which the default CTS runtime relies on. This runtime uses pre-generated static imports instead.

## Setup

### 1. Generate Static Imports

Before using the runtime, you need to generate a file that statically imports all spec files. Create a build script or use the example below:

```typescript
// gen_rn_specs.ts - Run with ts-node or similar
import * as fs from 'fs';
import * as path from 'path';

const webgpuDir = path.join(__dirname, '../../webgpu');
const outputFile = path.join(__dirname, 'generated/all_specs.ts');

// Find all spec files
function findSpecs(dir: string, base: string = ''): string[] {
  const specs: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      specs.push(...findSpecs(path.join(dir, entry.name), relPath));
    } else if (entry.name.endsWith('.spec.ts')) {
      specs.push(relPath.replace(/\.spec\.ts$/, ''));
    }
  }
  return specs;
}

const specs = findSpecs(webgpuDir);

// Generate imports
let output = `/**
 * Auto-generated - DO NOT EDIT
 */
import { AllSpecs, SpecEntry } from '../loader.js';

`;

specs.forEach((spec, i) => {
  output += `import * as spec${i} from '../../../webgpu/${spec}.spec.js';\n`;
});

output += `\nconst webgpuSpecs: SpecEntry[] = [\n`;
specs.forEach((spec, i) => {
  const parts = spec.split('/').map(p => `'${p}'`).join(', ');
  output += `  { path: [${parts}], spec: spec${i} },\n`;
});
output += `];\n\n`;

output += `export const allSpecs: AllSpecs = new Map([
  ['webgpu', webgpuSpecs],
]);

export default allSpecs;
`;

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, output);
console.log(`Generated ${outputFile} with ${specs.length} specs`);
```

### 2. Polyfills Required

React Native doesn't have some Web APIs that the CTS uses. You'll need to polyfill:

- `Event`
- `EventTarget`
- `MessageEvent`

Example polyfill:

```typescript
// event-target-polyfill.ts - Import before using CTS
if (typeof globalThis.Event === 'undefined') {
  globalThis.Event = class Event {
    readonly type: string;
    readonly bubbles: boolean = false;
    readonly cancelable: boolean = false;
    readonly defaultPrevented: boolean = false;
    readonly timeStamp: number;

    constructor(type: string, init?: EventInit) {
      this.type = type;
      this.bubbles = init?.bubbles ?? false;
      this.cancelable = init?.cancelable ?? false;
      this.timeStamp = Date.now();
    }
    preventDefault() {}
    stopPropagation() {}
    stopImmediatePropagation() {}
  };
}

if (typeof globalThis.EventTarget === 'undefined') {
  globalThis.EventTarget = class EventTarget {
    private listeners = new Map<string, Function[]>();

    addEventListener(type: string, listener: Function) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type)!.push(listener);
    }

    removeEventListener(type: string, listener: Function) {
      const arr = this.listeners.get(type);
      if (arr) {
        const idx = arr.indexOf(listener);
        if (idx >= 0) arr.splice(idx, 1);
      }
    }

    dispatchEvent(event: Event): boolean {
      const arr = this.listeners.get(event.type);
      if (arr) arr.forEach(fn => fn.call(this, event));
      return true;
    }
  };
}

if (typeof globalThis.MessageEvent === 'undefined') {
  globalThis.MessageEvent = class MessageEvent<T = any> {
    readonly type: string;
    readonly data: T;
    readonly defaultPrevented = false;
    readonly timeStamp: number;

    constructor(type: string, init?: { data?: T }) {
      this.type = type;
      this.data = init?.data as T;
      this.timeStamp = Date.now();
    }
    preventDefault() {}
    stopPropagation() {}
  };
}
```

## Usage

### Basic Usage

```typescript
import { CTSRunner } from 'webgpu-cts/src/common/runtime/rn';
import { allSpecs } from 'webgpu-cts/src/common/runtime/rn/generated/all_specs';

const runner = new CTSRunner(allSpecs, {
  debug: false,
  compatibility: false,
});

const { summary, results } = await runner.runTests('webgpu:api,operation,adapter,*');

console.log(`Passed: ${summary.passed}/${summary.total}`);
```

### With Progress Callbacks

```typescript
const { summary, results } = await runner.runTests(
  'webgpu:api,operation,*',
  {
    onTestStart: (name, index, total) => {
      console.log(`[${index + 1}/${total}] Running: ${name}`);
    },
    onTestComplete: (result, index, total) => {
      console.log(`  ${result.status} (${result.timems.toFixed(1)}ms)`);
    },
    onRunComplete: (summary) => {
      console.log(`Done! ${summary.passed} passed, ${summary.failed} failed`);
    },
  }
);
```

### Stopping a Test Run

```typescript
const runner = new CTSRunner(allSpecs);

// Start tests
const promise = runner.runTests('webgpu:*', {
  shouldStop: () => runner.isStopRequested(),
});

// Later, request stop
runner.requestStop();

// Remaining tests will be marked as 'skip'
const { summary } = await promise;
```

### Standalone Functions

For simpler use cases without creating a runner instance:

```typescript
import { listTests, runTests, runSingleTest } from 'webgpu-cts/src/common/runtime/rn';
import { allSpecs } from 'webgpu-cts/src/common/runtime/rn/generated/all_specs';

// List matching tests
const tests = await listTests(allSpecs, 'webgpu:api,operation,adapter,*');
console.log(`Found ${tests.length} tests`);

// Run tests
const { summary } = await runTests(allSpecs, 'webgpu:api,operation,adapter,info:*');

// Run a single test
const result = await runSingleTest(allSpecs, 'webgpu:api,operation,adapter,info:*');
```

## Query Syntax

The CTS uses a hierarchical query syntax:

| Query | Description |
|-------|-------------|
| `webgpu:*` | All WebGPU tests |
| `webgpu:api,*` | All API tests |
| `webgpu:api,operation,*` | All operation tests |
| `webgpu:api,operation,adapter,*` | All adapter tests |
| `webgpu:api,operation,adapter,info:*` | Single test file |

## Configuration Options

```typescript
interface CTSConfig {
  /** Run in WebGPU compatibility mode */
  compatibility?: boolean;

  /** Force fallback adapter */
  forceFallbackAdapter?: boolean;

  /** Enforce default limits */
  enforceDefaultLimits?: boolean;

  /** Enable debug logging */
  debug?: boolean;

  /** Unroll const eval loops */
  unrollConstEvalLoops?: boolean;

  /** Custom GPU provider function */
  gpuProvider?: () => GPU;

  /** Power preference for adapter */
  powerPreference?: GPUPowerPreference;
}
```

## API Reference

### CTSRunner

Main class for running tests with full control.

```typescript
class CTSRunner {
  constructor(allSpecs: AllSpecs, config?: CTSConfig);

  listTests(query: string): Promise<string[]>;
  runTests(query: string, callbacks?: TestRunCallbacks): Promise<{ summary, results }>;

  requestStop(): void;
  isStopRequested(): boolean;
  resetStop(): void;

  getResultsJSON(space?: number): string;
}
```

### TestResult

```typescript
interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip' | 'warn';
  timems: number;
  logs?: string[];
}
```

### TestRunSummary

```typescript
interface TestRunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  warned: number;
  timems: number;
}
```

## Integration Example

See the [[react-native-webgpu](https://github.com/wcandillon/react-native-webgpu)](https://github.com/wcandillon/react-native-webgpu/pull/306) example app for a complete integration including:

- Sync script to copy CTS files for Metro bundler
- UI component for running tests
- Full polyfill implementations
