import { assert } from './util/index.js';

let glslangPath: string | undefined;

export function getGlslangPath(): string | undefined {
  return glslangPath;
}

export function setGlslangPath(path: string): void {
  assert(path.startsWith('/'), 'glslang path must be absolute');
  glslangPath = path;
}
