# Introduction

If contributing conformance tests, the directory you'll work in is [`src/webgpu/`](../src/webgpu/).
This directory is organized according to the goal of the test (API validation behavior vs
actual results) and its target (API entry points and spec areas, e.g. texture sampling).

The contents of a test file (`src/webgpu/**/*.spec.ts`) are twofold:

- Documentation ("test plans") on what tests do, how they do it, and what cases they cover.
  Some test plans are unimplemented: they either contain "TODO:" in a file description or are
  `.unimplemented()`.
- Actual tests.

**Please read the following short documents before contributing.**

## 0. [Developing](developing.md)

## 1. [Adding or Editing Test Plans](plans.md)

## 2. [Implementing Tests](tests.md)

## [Additional Documentation](../)

- [Guidelines](https://github.com/gpuweb/gpuweb/wiki/WebGPU-CTS-guidelines) (TODO: migrate)
- [OBSOLETE planning guidelines](https://hackmd.io/@webgpu/H1MwoqqAU) (TODO: migrate)
