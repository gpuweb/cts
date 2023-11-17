# Building

Building the project is not usually needed for local development.
However, for exports to WPT, NodeJS, [or deployment](https://gpuweb.github.io/cts/),
files can be pre-generated.

## Build types

The project can be built three different ways, each with a different output directory:

### 1. `out` directory

**Built with**: `npm run standalone`

**Used by**: The standalone CTS runner. Build and run with: `npx grunt serve`.

### 2. `out-wpt` directory

**Built with**: `npm run wpt`

**Used by**: Web Testing Platform.

Contains:

- An adapter for running WebGPU CTS tests under WPT
- A copy of the needed files from `out/`
- A copy of any `.html` test cases from `src/`

### 3. `out-node` directory

**Built with**: `npm run node`

**Used by**: NodeJS test runners:

- [`src/common/runtime/cmdline.ts`](../src/common/runtime/cmdline.ts) - A command line interface test runner
- [`src/common/runtime/server.ts`](../src/common/runtime/server.ts) - An HTTP server for executing CTS tests with a REST interface

## Testing

To build and run all pre-submit checks (including type and lint checks and
unittests), use:

```sh
npm test
```

For checks only:

```sh
npm run check
```

## Run

To serve the built files (rather than using the dev server), run `npx grunt serve`.

## Export to WPT

Run `npm run wpt`.

Copy (or symlink) the `out-wpt/` directory as the `webgpu/` directory in your
WPT checkout or your browser's "internal" WPT test directory.
