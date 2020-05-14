# Writing Tests

The test suites are organized as a tree, both in the filesystem and further, within each file.

- _Suites_, e.g. `src/webgpu/`.
  - _READMEs_, e.g. `src/webgpu/README.txt`.
  - _Test Spec Files_, e.g. `src/webgpu/examples.spec.ts`.
    Identified by their file path.
    Each test spec file provides a description and a _Test Group_.
    A _Test Group_ defines a test fixture, and contains multiple:
    - _Tests_.
      Identified by a series of strings (e.g. `basic,async`).
      Defines a _test function_ and contains multiple:
      - _Test Cases_.
        Identified by a series of _Parameters_ (e.g. `x=1;y=2`).
        Each Test Case has the same test function but different Parameters.

## Suite

A suite of tests.
A single suite has a directory structure, and many _test spec files_
(`.spec.ts` files containing tests) and _READMEs_.
Each member of a suite is identified by its path within the suite.

**Example:** `src/webgpu/`

### README

**Example:** `src/webgpu/README.txt`

Describes (in prose) the contents of a subdirectory in a suite.

READMEs are only processed at build time, when generating the _Listing_ for a suite.

**Type:** `TestSuiteListingEntryReadme`

## Queries

A _Query_ is a structured object (which can be represented as a string).
Queries are used to:

- Identify the subtree of the full test tree, rooted an any arbitrary node.
- Identify individual cases (rooted at a leaf).
- Represent the list of tests that a test runner (standalone, wpt, or cmdline) should run.
- Identify subtrees which should not be "collapsed" during WPT `cts.html` generation,
  so that they can be individually suppressed.

There are four types of `TestQuery`:

- `TestQueryMultiFile` represents any subtree of the file hierarchy:
  - `suite:*`
  - `suite:path,to,*`
  - `suite:path,to,file,*`
- `TestQueryMultiTest` represents any subtree of the test hierarchy:
  - `suite:path,to,file:*`
  - `suite:path,to,file:path,to,*`
  - `suite:path,to,file:path,to,test,*`
- `TestQueryMultiCase` represents any subtree of the case hierarchy:
  - `suite:path,to,file:path,to,test:*`
  - `suite:path,to,file:path,to,test:my=0;*`
  - `suite:path,to,file:path,to,test:my=0;params="here";*`
- `TestQuerySingleCase` represents as single case:
  - `suite:path,to,file:path,to,test:my=0;params="here"`

Test Queries are a **weakly ordered set**: any query is _Unordered_, _Equal_, _StrictSuperset_, or _StrictSubset_ relative to any other.
This property is used to construct the complete tree of test cases.
In the examples above, every example query is a StrictSubset of the previous one.

In the WPT and standalone harnesses, the query is stored in the URL, e.g.
`index.html?q=q:u,e:r,y:*`.

Queries are selectively URL-encoded for readability and compatibility with browsers
(see `encodeURIComponentSelectively`).

**Type:** `TestQuery`

## Listing

A listing of the **test spec files** in a suite.

This can be generated only in Node, which has filesystem access (see `src/tools/crawl.ts`).
As part of the build step, a _listing file_ is generated (see `src/tools/gen.ts`) so that the
test files can be discovered by the web runner (since it does not have filesystem access).

**Type:** `TestSuiteListing`

### Listing File

**Example:** `out/webgpu/listing.js`

## Test Spec File

**Type:** `SpecFile`

**Example:** `src/webgpu/**/*.spec.ts`

## Test Group

A subtree of test cases. There is one Test Group per Test Spec File.

**Type:** `TestGroup`

## Test

One test. It has a single _test function_.

It may represent multiple _test cases_, each of which runs the same Test Function with different **parameters**.

A test is named using `TestGroup.test()`, which returns a `TestBuilder`.
`TestBuilder.params()` can optionally be used to parameterize the test.
Then, `TestBuilder.fn()` provides the Test Function.

### Test Function

When a test case is run, the Test Function receives an instance of the appropriate
_test fixture_, producing test results.

**Type:** `TestFn`

## Test Case / Case

A single case of a test. It is identified by a `TestCaseID`: a test name, and its parameters.

**Type:** During test run time, a case is encapsulated as a `RunCase`.

## Parameters / Params

## Test Fixture / Fixture

Test fixtures provide helpers for tests to use.
A new instance of the fixture is created for every run of every test case.

There is always one fixture class for a whole test group (though this may change).

The fixture is also how a test gets access to the _case recorder_,
which allows it to produce test results.

They are also how tests produce results: `.skip()`, `.fail()`, etc.

**Type:** `Fixture`

### `UnitTest` Fixture

Provides basic fixture utilities most useful in the `unittests` suite.

### `GPUTest` Fixture

Provides utilities useful in WebGPU CTS tests.

# Running Tests

- _Queries_ contain multiple:
  - _Filters_ (positive or negative).

### Filter

A filter matches a set of cases in a suite.

Each filter may match one of:

- `S:s` In one suite `S`, all specs whose paths start with `s` (which may be empty).
- `S:s:t` In one spec `S:s`, all tests whose names start with `t` (which may be empty).
- `S:s:t~c` In one test `S:s:t`, all cases whose params are a superset of `c`.
- `S:s:t=c` In one test `S:s:t`, the single case whose params equal `c` (empty string = `{}`).

**Type:** `TestFilter`

### Using filters to split expectations

A set of cases can be split using negative filters. For example, imagine you have one WPT test variant:

- `webgpu/cts.html?q=unittests:param_helpers:`

But one of the cases is failing. To be able to suppress the failing test without losing test coverage, the WPT test variant can be split into two variants:

- `webgpu/cts.html?q=unittests:param_helpers:&not=unittests:param_helpers:combine/mixed:`
- `webgpu/cts.html?q=unittests:param_helpers:combine/mixed:`

This runs the same set of cases, but in two separate page loads.

# Test Results

## Logger

A logger logs the results of a whole test run.

It saves an empty `LiveTestSpecResult` into its results map, then creates a
_test spec recorder_, which records the results for a group into the `LiveTestSpecResult`.

**Type:** `Logger`

### Test Case Recorder

Refers to a `LiveTestCaseResult` created by the logger.
Records the results of running a test case (its pass-status, run time, and logs) into it.

**Types:** `TestCaseRecorder`, `LiveTestCaseResult`

#### Test Case Status

The `status` of a `LiveTestCaseResult` can be one of:

- `'running'` (only while still running)
- `'pass'`
- `'skip'`
- `'warn'`
- `'fail'`

The "worst" result from running a case is always reported (fail > warn > skip > pass).
Note this means a test can still fail if it's "skipped", if it failed before
`.skip()` was called.

**Type:** `Status`

## Results Format

The results are returned in JSON format.

They are designed to be easily merged in JavaScript:
the `"results"` can be passed into the constructor of `Map` and merged from there.

(TODO: Write a merge tool, if needed.)

```js
{
  "version": "bf472c5698138cdf801006cd400f587e9b1910a5-dirty",
  "results": [
    [
      "unittests:async_mutex:basic:",
      { "status": "pass", "timems": 0.286, "logs": [] }
    ],
    [
      "unittests:async_mutex:serial:",
      { "status": "pass", "timems": 0.415, "logs": [] }
    ]
  ]
}
```
